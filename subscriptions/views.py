import logging
from datetime import timedelta

import stripe
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CompanySubscription, SubscriptionPlan

logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_SECRET_KEY


def is_company_admin(user):
    return str(getattr(user, "role", "")).upper() == "ADMIN"


class SubscriptionPlansView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        plans = SubscriptionPlan.objects.all().order_by("price")
        data = []
        for plan in plans:
            data.append(
                {
                    "id": plan.id,
                    "name": plan.name,
                    "price": float(plan.price),
                    "max_users": plan.max_users,
                    "max_teams": plan.max_teams,
                    "max_prospects": plan.max_prospects,
                    "description": plan.description,
                    "duration_days": plan.duration_days,
                    "premium_features": plan.premium_features,
                    "stripe_price_id": plan.stripe_price_id,
                }
            )
        return Response(data)


class CurrentSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = getattr(request.user, "company", None)
        if not company:
            return Response({"error": "Aucune société"}, status=404)

        try:
            subscription = company.subscription
        except CompanySubscription.DoesNotExist:
            return Response({"error": "Aucun abonnement"}, status=404)

        from sales.models import Prospect

        plan = subscription.plan

        return Response(
            {
                "plan": plan.name if plan else None,
                "plan_key": subscription.get_plan_key(),
                "price": float(plan.price) if plan else 0,
                "is_trial": subscription.is_trial,
                "trial_end_date": subscription.trial_end_date,
                "start_date": subscription.start_date,
                "end_date": subscription.end_date,
                "is_active": subscription.is_active,
                "expired": subscription.expired,
                "days_until_expiry": subscription.days_until_expiry(),
                "can_change_plan": subscription.can_change_plan(),
                "is_blocked": subscription.is_blocked(),
                "allowed_features": subscription.get_allowed_features(),
                "max_users": plan.max_users if plan else None,
                "max_teams": plan.max_teams if plan else None,
                "max_prospects": plan.max_prospects if plan else None,
                "users_count": company.users.count(),
                "teams_count": company.teams.count(),
                "prospects_count": Prospect.objects.filter(company=company).count(),
            }
        )


class CreateCheckoutSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        company = getattr(user, "company", None)

        if not company:
            return Response({"error": "Aucune société trouvée"}, status=404)

        if not is_company_admin(user):
            return Response({"error": "Seul l'admin peut gérer l'abonnement"}, status=403)

        plan_name = request.data.get("plan")
        if not plan_name:
            return Response({"error": "Plan manquant"}, status=400)

        try:
            plan = SubscriptionPlan.objects.get(name=plan_name)
        except SubscriptionPlan.DoesNotExist:
            return Response({"error": "Plan inexistant"}, status=400)

        if not plan.stripe_price_id:
            return Response(
                {"error": "Ce plan n'a pas de price Stripe configuré", "fallback": True},
                status=400,
            )

        subscription, _ = CompanySubscription.objects.get_or_create(company=company)

        try:
            if not subscription.stripe_customer_id:
                customer = stripe.Customer.create(
                    email=user.email,
                    name=company.name,
                    metadata={
                        "company_id": str(company.id),
                        "user_id": str(user.id),
                        "company_name": company.name,
                    },
                )
                subscription.stripe_customer_id = customer.id
                subscription.save(update_fields=["stripe_customer_id"])
            else:
                try:
                    customer = stripe.Customer.retrieve(subscription.stripe_customer_id)
                except stripe.error.InvalidRequestError:
                    customer = stripe.Customer.create(
                        email=user.email,
                        name=company.name,
                        metadata={
                            "company_id": str(company.id),
                            "user_id": str(user.id),
                        },
                    )
                    subscription.stripe_customer_id = customer.id
                    subscription.save(update_fields=["stripe_customer_id"])

            session = stripe.checkout.Session.create(
                customer=customer.id,
                payment_method_types=["card"],
                line_items=[{"price": plan.stripe_price_id, "quantity": 1}],
                mode="subscription",
                success_url=f"{settings.FRONTEND_URL}/subscriptions?success=true&plan={plan_name}",
                cancel_url=f"{settings.FRONTEND_URL}/subscriptions?cancelled=true",
                metadata={
                    "company_id": str(company.id),
                    "plan_name": plan_name,
                    "plan_id": str(plan.id),
                    "user_id": str(user.id),
                },
            )

            return Response({"checkout_url": session.url, "session_id": session.id})

        except stripe.error.InvalidRequestError as e:
            logger.error("[STRIPE] InvalidRequestError: %s", e)
            return Response({"error": str(e), "fallback": True}, status=400)
        except stripe.error.StripeError as e:
            logger.error("[STRIPE] StripeError: %s", e)
            return Response({"error": str(e), "fallback": True}, status=400)
        except Exception as e:
            logger.exception("[STRIPE] Unexpected error")
            return Response({"error": f"Erreur serveur: {str(e)}"}, status=500)


class UpgradeSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        company = getattr(user, "company", None)

        if not company:
            return Response({"error": "Aucune société trouvée"}, status=404)

        if not is_company_admin(user):
            return Response({"error": "Seul l'admin peut gérer l'abonnement"}, status=403)

        plan_name = request.data.get("plan")
        if not plan_name:
            return Response({"error": "Plan manquant"}, status=400)

        try:
            plan = SubscriptionPlan.objects.get(name=plan_name)
        except SubscriptionPlan.DoesNotExist:
            return Response({"error": "Plan inexistant"}, status=400)

        subscription, _ = CompanySubscription.objects.get_or_create(company=company)

        if (
            not subscription.expired
            and subscription.plan
            and subscription.plan.name != plan_name
            and not subscription.can_change_plan()
        ):
            days_left = subscription.days_until_expiry()
            return Response(
                {"error": f"Vous pourrez changer d'abonnement dans {days_left} jours."},
                status=400,
            )

        today = timezone.now().date()
        subscription.plan = plan
        subscription.start_date = today
        subscription.end_date = today + timedelta(days=plan.duration_days)
        subscription.is_active = True
        subscription.is_trial = False
        subscription.reset_notification_flags()
        subscription.save(
            update_fields=[
                "plan",
                "start_date",
                "end_date",
                "is_active",
                "is_trial",
                "reminder_7_days_sent",
                "expiration_email_sent",
                "trial_end_email_sent",
            ]
        )

        subscription.send_payment_success()

        return Response(
            {
                "message": f"Abonnement activé : {plan.name}",
                "start_date": str(subscription.start_date),
                "end_date": str(subscription.end_date),
            }
        )


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        logger.error("[WEBHOOK] Signature invalide: %s", e)
        return HttpResponse(status=400)

    event_type = event["type"]
    logger.info("[WEBHOOK] Événement reçu: %s", event_type)

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(event["data"]["object"])
    elif event_type == "invoice.payment_succeeded":
        _handle_invoice_paid(event["data"]["object"])
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_cancelled(event["data"]["object"])

    return HttpResponse(status=200)


def _handle_checkout_completed(session):
    metadata = session.get("metadata", {})
    company_id = metadata.get("company_id")
    plan_name = metadata.get("plan_name")
    plan_id = metadata.get("plan_id")
    customer_id = session.get("customer")
    stripe_sub_id = session.get("subscription")

    subscription = _find_subscription(company_id, customer_id)
    if not subscription:
        logger.error(
            "[WEBHOOK] Subscription introuvable (company_id=%s, customer=%s)",
            company_id,
            customer_id,
        )
        return

    plan = _find_plan(plan_id, plan_name)
    if not plan:
        logger.error("[WEBHOOK] Plan introuvable (id=%s, name=%s)", plan_id, plan_name)
        return

    today = timezone.now().date()
    subscription.plan = plan
    subscription.start_date = today
    subscription.end_date = today + timedelta(days=plan.duration_days)
    subscription.is_active = True
    subscription.is_trial = False
    subscription.stripe_subscription_id = stripe_sub_id or subscription.stripe_subscription_id
    subscription.stripe_customer_id = customer_id or subscription.stripe_customer_id
    subscription.reset_notification_flags()
    subscription.save(
        update_fields=[
            "plan",
            "start_date",
            "end_date",
            "is_active",
            "is_trial",
            "stripe_subscription_id",
            "stripe_customer_id",
            "reminder_7_days_sent",
            "expiration_email_sent",
            "trial_end_email_sent",
        ]
    )

    subscription.send_payment_success()
    logger.info(
        "[WEBHOOK] Abonnement activé - %s -> %s jusqu'au %s",
        subscription.company.name,
        plan.name,
        subscription.end_date,
    )


def _handle_invoice_paid(invoice):
    stripe_sub_id = invoice.get("subscription")
    customer_id = invoice.get("customer")

    if not stripe_sub_id:
        return

    try:
        subscription = CompanySubscription.objects.get(stripe_subscription_id=stripe_sub_id)
    except CompanySubscription.DoesNotExist:
        subscription = _find_subscription(None, customer_id)
        if not subscription:
            logger.error("[WEBHOOK] Subscription introuvable pour renouvellement")
            return

    try:
        stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
        new_end_date = timezone.datetime.fromtimestamp(
            stripe_sub.current_period_end,
            tz=timezone.get_current_timezone(),
        ).date()
    except Exception as e:
        logger.error("[WEBHOOK] Impossible de récupérer la sub Stripe: %s", e)
        if subscription.plan:
            new_end_date = timezone.now().date() + timedelta(days=subscription.plan.duration_days)
        else:
            return

    subscription.end_date = new_end_date
    subscription.is_active = True
    subscription.stripe_subscription_id = stripe_sub_id
    subscription.reset_notification_flags()
    subscription.save(
        update_fields=[
            "end_date",
            "is_active",
            "stripe_subscription_id",
            "reminder_7_days_sent",
            "expiration_email_sent",
            "trial_end_email_sent",
        ]
    )

    subscription.send_payment_success()
    logger.info("[WEBHOOK] Renouvellement - %s jusqu'au %s", subscription.company.name, subscription.end_date)


def _handle_subscription_cancelled(stripe_sub):
    stripe_sub_id = stripe_sub.get("id")
    customer_id = stripe_sub.get("customer")

    try:
        subscription = CompanySubscription.objects.get(stripe_subscription_id=stripe_sub_id)
    except CompanySubscription.DoesNotExist:
        subscription = _find_subscription(None, customer_id)
        if not subscription:
            logger.error("[WEBHOOK] Subscription introuvable pour annulation")
            return

    subscription.is_active = False
    subscription.save(update_fields=["is_active"])
    logger.info("[WEBHOOK] Abonnement annulé - %s", subscription.company.name)


def _find_subscription(company_id: str | None, customer_id: str | None):
    if company_id:
        try:
            return CompanySubscription.objects.select_related("company__owner", "plan").get(
                company_id=company_id
            )
        except CompanySubscription.DoesNotExist:
            logger.warning("[WEBHOOK] company_id=%s introuvable, fallback customer", company_id)

    if customer_id:
        try:
            return CompanySubscription.objects.select_related("company__owner", "plan").get(
                stripe_customer_id=customer_id
            )
        except CompanySubscription.DoesNotExist:
            pass

    return None


def _find_plan(plan_id: str | None, plan_name: str | None):
    if plan_id:
        try:
            return SubscriptionPlan.objects.get(id=int(plan_id))
        except (SubscriptionPlan.DoesNotExist, ValueError):
            logger.warning("[WEBHOOK] plan_id=%s introuvable, fallback name", plan_id)

    if plan_name:
        try:
            return SubscriptionPlan.objects.get(name=plan_name)
        except SubscriptionPlan.DoesNotExist:
            pass

    return None
