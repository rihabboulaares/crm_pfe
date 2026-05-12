# subscriptions/views.py — VERSION CORRIGÉE
import stripe
import logging
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
from django.core.mail import send_mail

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes

from .models import SubscriptionPlan, CompanySubscription

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY


class SubscriptionPlansView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plans = SubscriptionPlan.objects.all().order_by("price")
        data = []
        for plan in plans:
            data.append({
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
            })
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

        return Response({
            "plan": subscription.plan.name if subscription.plan else None,
            "price": float(subscription.plan.price) if subscription.plan else 0,
            "is_trial": subscription.is_trial,
            "trial_end_date": subscription.trial_end_date,
            "start_date": subscription.start_date,
            "end_date": subscription.end_date,
            "is_active": subscription.is_active,
            "expired": subscription.expired,
            "days_until_expiry": subscription.days_until_expiry(),
            "can_change_plan": subscription.can_change_plan(),
            "is_blocked": subscription.is_blocked(),
        })


class CreateCheckoutSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        company = getattr(user, "company", None)

        if not company:
            return Response({"error": "Aucune société trouvée"}, status=404)

        if user.role != "ADMIN":
            return Response({"error": "Seul l'admin peut gérer l'abonnement"}, status=403)

        plan_name = request.data.get("plan")
        if not plan_name:
            return Response({"error": "Plan manquant"}, status=400)

        try:
            plan = SubscriptionPlan.objects.get(name=plan_name)
        except SubscriptionPlan.DoesNotExist:
            return Response({"error": "Plan inexistant"}, status=400)

        if not plan.stripe_price_id:
            return Response({
                "error": "Ce plan n'a pas de price Stripe configuré",
                "fallback": True
            }, status=400)

        # ✅ FIX : get_or_create AVANT de contacter Stripe
        # pour garantir que la subscription existe quand le webhook arrive
        subscription, _ = CompanySubscription.objects.get_or_create(company=company)

        try:
            # Créer ou récupérer le customer Stripe
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
                    # Customer supprimé sur Stripe → en recréer un
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

            # ✅ FIX : passer aussi plan_id en metadata pour lookup robuste
            session = stripe.checkout.Session.create(
                customer=customer.id,
                payment_method_types=["card"],
                line_items=[{"price": plan.stripe_price_id, "quantity": 1}],
                mode="subscription",
                success_url=f"{settings.FRONTEND_URL}/subscriptions?success=true&plan={plan_name}",
                cancel_url=f"{settings.FRONTEND_URL}/subscriptions?cancelled=true",
                metadata={
                    "company_id": str(company.id),   # ← utilisé par le webhook
                    "plan_name": plan_name,           # ← utilisé par le webhook
                    "plan_id": str(plan.id),          # ← fallback robuste
                    "user_id": str(user.id),
                },
            )

            return Response({
                "checkout_url": session.url,
                "session_id": session.id,
            })

        except stripe.error.InvalidRequestError as e:
            logger.error(f"[STRIPE] InvalidRequestError: {e}")
            return Response({"error": str(e), "fallback": True}, status=400)

        except stripe.error.StripeError as e:
            logger.error(f"[STRIPE] StripeError: {e}")
            return Response({"error": str(e), "fallback": True}, status=400)

        except Exception as e:
            logger.exception(f"[STRIPE] Unexpected error")
            return Response({"error": f"Erreur serveur: {str(e)}"}, status=500)


class UpgradeSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        company = getattr(user, "company", None)

        if not company:
            return Response({"error": "Aucune société trouvée"}, status=404)

        if user.role != "ADMIN":
            return Response({"error": "Seul l'admin peut gérer l'abonnement"}, status=403)

        plan_name = request.data.get("plan")
        if not plan_name:
            return Response({"error": "Plan manquant"}, status=400)

        try:
            plan = SubscriptionPlan.objects.get(name=plan_name)
        except SubscriptionPlan.DoesNotExist:
            return Response({"error": "Plan inexistant"}, status=400)

        subscription, _ = CompanySubscription.objects.get_or_create(company=company)

        if not subscription.expired and subscription.plan and subscription.plan.name != plan_name and not subscription.can_change_plan():
            days_left = subscription.days_until_expiry()
            return Response({
                "error": f"Vous pourrez changer d'abonnement dans {days_left} jours."
            }, status=400)

        today = timezone.now().date()
        subscription.plan = plan
        subscription.start_date = today
        subscription.end_date = today + timedelta(days=plan.duration_days)
        subscription.is_active = True
        subscription.is_trial = False
        subscription.save()

        subscription.send_payment_success()

        return Response({
            "message": f"Abonnement activé : {plan.name}",
            "start_date": str(subscription.start_date),
            "end_date": str(subscription.end_date),
        })


# ──────────────────────────────────────────────────────────────────────────────
# WEBHOOK STRIPE — VERSION CORRIGÉE
# ──────────────────────────────────────────────────────────────────────────────

@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_webhook(request):
    """
    Webhook Stripe.

    Corrections apportées :
    1. Lookup de la subscription via stripe_customer_id en fallback
       (au cas où company_id serait absent des metadata).
    2. Lookup du plan via plan_id (int) en priorité → plan_name en fallback.
    3. Log systématique pour débogage.
    4. Jamais de 500 silencieux : on retourne 200 même en cas d'erreur métier
       pour que Stripe n'envoie pas l'event indéfiniment.
    """
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        logger.error(f"[WEBHOOK] Signature invalide: {e}")
        return HttpResponse(status=400)

    event_type = event["type"]
    logger.info(f"[WEBHOOK] Événement reçu: {event_type}")

    # ── checkout.session.completed ─────────────────────────────────────────
    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        _handle_checkout_completed(session)

    # ── invoice.payment_succeeded ──────────────────────────────────────────
    elif event_type == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        _handle_invoice_paid(invoice)

    # ── customer.subscription.deleted ─────────────────────────────────────
    elif event_type == "customer.subscription.deleted":
        stripe_sub = event["data"]["object"]
        _handle_subscription_cancelled(stripe_sub)

    return HttpResponse(status=200)


def _handle_checkout_completed(session):
    """Paiement initial validé → active l'abonnement."""
    metadata = session.get("metadata", {})
    company_id = metadata.get("company_id")
    plan_name  = metadata.get("plan_name")
    plan_id    = metadata.get("plan_id")
    customer_id     = session.get("customer")
    stripe_sub_id   = session.get("subscription")

    logger.info(
        f"[WEBHOOK] checkout.completed — company_id={company_id} "
        f"plan={plan_name} customer={customer_id} sub={stripe_sub_id}"
    )

    # ── 1. Trouver la subscription ────────────────────────────────────────
    subscription = _find_subscription(company_id, customer_id)
    if not subscription:
        logger.error(
            f"[WEBHOOK] ❌ Subscription introuvable "
            f"(company_id={company_id}, customer={customer_id})"
        )
        return

    # ── 2. Trouver le plan ────────────────────────────────────────────────
    plan = _find_plan(plan_id, plan_name)
    if not plan:
        logger.error(f"[WEBHOOK] ❌ Plan introuvable (id={plan_id}, name={plan_name})")
        return

    # ── 3. Mettre à jour l'abonnement ─────────────────────────────────────
    today = timezone.now().date()
    subscription.plan                  = plan
    subscription.start_date            = today
    subscription.end_date              = today + timedelta(days=plan.duration_days)
    subscription.is_active             = True
    subscription.is_trial              = False
    subscription.stripe_subscription_id = stripe_sub_id or subscription.stripe_subscription_id
    subscription.stripe_customer_id    = customer_id or subscription.stripe_customer_id
    subscription.save()

    subscription.send_payment_success()
    logger.info(
        f"[WEBHOOK] ✅ Abonnement activé — {subscription.company.name} "
        f"→ {plan.name} jusqu'au {subscription.end_date}"
    )


def _handle_invoice_paid(invoice):
    """Renouvellement automatique → prolonge la date de fin."""
    stripe_sub_id = invoice.get("subscription")
    customer_id   = invoice.get("customer")

    logger.info(
        f"[WEBHOOK] invoice.paid — sub={stripe_sub_id} customer={customer_id}"
    )

    if not stripe_sub_id:
        return

    # Trouver la subscription par stripe_subscription_id
    try:
        subscription = CompanySubscription.objects.get(
            stripe_subscription_id=stripe_sub_id
        )
    except CompanySubscription.DoesNotExist:
        # Fallback : chercher par customer
        subscription = _find_subscription(None, customer_id)
        if not subscription:
            logger.error(
                f"[WEBHOOK] ❌ Subscription introuvable pour renouvellement "
                f"(sub={stripe_sub_id})"
            )
            return

    # Récupérer la nouvelle date de fin depuis Stripe
    try:
        stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
        new_end_date = timezone.datetime.fromtimestamp(
            stripe_sub.current_period_end,
            tz=timezone.get_current_timezone(),
        ).date()
    except Exception as e:
        logger.error(f"[WEBHOOK] Impossible de récupérer la sub Stripe: {e}")
        # Fallback : prolonger selon le plan actuel
        if subscription.plan:
            new_end_date = timezone.now().date() + timedelta(days=subscription.plan.duration_days)
        else:
            return

    subscription.end_date  = new_end_date
    subscription.is_active = True
    subscription.stripe_subscription_id = stripe_sub_id
    subscription.save()

    subscription.send_payment_success()
    logger.info(
        f"[WEBHOOK] ✅ Renouvellement — {subscription.company.name} "
        f"jusqu'au {subscription.end_date}"
    )


def _handle_subscription_cancelled(stripe_sub):
    """L'abonnement Stripe est annulé → désactiver côté Django."""
    stripe_sub_id = stripe_sub.get("id")
    customer_id   = stripe_sub.get("customer")

    logger.info(
        f"[WEBHOOK] subscription.deleted — sub={stripe_sub_id}"
    )

    try:
        subscription = CompanySubscription.objects.get(
            stripe_subscription_id=stripe_sub_id
        )
    except CompanySubscription.DoesNotExist:
        subscription = _find_subscription(None, customer_id)
        if not subscription:
            logger.error(f"[WEBHOOK] ❌ Subscription introuvable pour annulation")
            return

    subscription.is_active = False
    subscription.save(update_fields=["is_active"])
    logger.info(f"[WEBHOOK] ✅ Abonnement annulé — {subscription.company.name}")


# ── Helpers ────────────────────────────────────────────────────────────────

def _find_subscription(company_id: str | None, customer_id: str | None):
    """
    Cherche une CompanySubscription :
    1. Par company_id (metadata)
    2. Par stripe_customer_id (fallback fiable)
    """
    if company_id:
        try:
            return CompanySubscription.objects.select_related(
                "company__owner", "plan"
            ).get(company_id=company_id)
        except CompanySubscription.DoesNotExist:
            logger.warning(f"[WEBHOOK] company_id={company_id} introuvable, fallback customer")

    if customer_id:
        try:
            return CompanySubscription.objects.select_related(
                "company__owner", "plan"
            ).get(stripe_customer_id=customer_id)
        except CompanySubscription.DoesNotExist:
            pass

    return None


def _find_plan(plan_id: str | None, plan_name: str | None):
    """
    Cherche un SubscriptionPlan :
    1. Par ID (plus fiable)
    2. Par nom (fallback)
    """
    if plan_id:
        try:
            return SubscriptionPlan.objects.get(id=int(plan_id))
        except (SubscriptionPlan.DoesNotExist, ValueError):
            logger.warning(f"[WEBHOOK] plan_id={plan_id} introuvable, fallback name")

    if plan_name:
        try:
            return SubscriptionPlan.objects.get(name=plan_name)
        except SubscriptionPlan.DoesNotExist:
            pass

    return None