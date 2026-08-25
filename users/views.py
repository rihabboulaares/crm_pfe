# users/views.py
import logging
import random
from smtplib import SMTPException

from rest_framework import generics, viewsets, status, filters
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password

from subscriptions.models import SubscriptionPlan, CompanySubscription
from subscriptions.utils import check_limits

from .models import User, Team, Invitation, Company, TransactionalEmailLog, PasswordResetCode
from .email_service import render_auth_email, send_transactional_email
from .serializers import (
    RegisterSerializer,
    UserSerializer,
    ChangePasswordSerializer,
    TeamSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from .permissions import IsAdmin

logger = logging.getLogger(__name__)


def send_mail_safely(*, subject, message, recipient_list):
    recipient = recipient_list[0] if recipient_list else ""
    email_sent, email_error, _ = send_transactional_email(
        email_type="invitation",
        recipient=recipient,
        subject=subject,
        text_body=message,
        html_body=render_auth_email(title=subject, body=message),
    )
    return email_sent, email_error


def auth_email_limited(email_type, recipient):
    now = timezone.now()
    recent_window = now - timedelta(seconds=settings.AUTH_EMAIL_RESEND_COOLDOWN_SECONDS)
    hourly_window = now - timedelta(hours=1)
    base_qs = TransactionalEmailLog.objects.filter(
        email_type=email_type,
        recipient__iexact=recipient,
        status=TransactionalEmailLog.Status.SENT,
    )

    if base_qs.filter(created_at__gte=recent_window).exists():
        return True, "Veuillez patienter avant de demander un nouveau code."

    if base_qs.filter(created_at__gte=hourly_window).count() >= settings.AUTH_EMAIL_MAX_PER_HOUR:
        return True, "Trop de demandes. Veuillez réessayer plus tard."

    return False, None


def generic_password_reset_response():
    return Response(
        {
            "message": (
                "Si un compte vérifié existe pour cet email, un code de réinitialisation a été envoyé."
            )
        }
    )


# =====================================================
# PAGINATION
# =====================================================
class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


# =====================================================
# REGISTER
# =====================================================
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


# =====================================================
# VERIFY EMAIL
# =====================================================
class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        code = request.data.get("code")
        try:
            user = User.objects.get(email=email, verification_code=code)
            if user.verification_code_sent_at:
                expires_at = user.verification_code_sent_at + timedelta(
                    minutes=settings.AUTH_VERIFICATION_CODE_TTL_MINUTES
                )
                if timezone.now() > expires_at:
                    return Response(
                        {"error": "Code expiré. Veuillez demander un nouveau code."},
                        status=400,
                    )
            user.is_verified = True
            user.verification_code = None
            user.verification_code_sent_at = None
            user.save(update_fields=["is_verified", "verification_code", "verification_code_sent_at"])
            return Response({"message": "Compte vérifié"})
        except User.DoesNotExist:
            return Response({"error": "Code invalide"}, status=400)


# =====================================================
# RESEND VERIFICATION CODE
# =====================================================
class ResendVerificationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        generic_response = {
            "message": "Si un compte non vérifié existe pour cet email, un nouveau code a été envoyé."
        }

        if not email:
            return Response({"error": "Email obligatoire"}, status=400)

        try:
            user = User.objects.get(email=email, is_verified=False)
        except User.DoesNotExist:
            return Response(generic_response)

        limited, limited_message = auth_email_limited(
            TransactionalEmailLog.EmailType.RESEND_VERIFICATION,
            user.email,
        )
        if limited:
            return Response({"error": limited_message}, status=429)

        code = str(random.randint(100000, 999999))
        email_sent, email_error, _ = send_transactional_email(
            email_type="resend_verification",
            recipient=user.email,
            subject="Nouveau code de vérification CRM",
            text_body=f"Bonjour {user.username}, votre nouveau code est : {code}",
            html_body=render_auth_email(
                title="Nouveau code de vérification",
                body="Utilisez ce nouveau code pour activer votre compte ViewiseCRM.",
                code=code,
            ),
            user=user,
            metadata={"reason": "manual_resend"},
        )

        if not email_sent:
            response = {
                "error": "Impossible d'envoyer le code de vérification. Veuillez réessayer plus tard."
            }
            if settings.DEBUG:
                response["email_error"] = email_error
            return Response(response, status=503)

        user.verification_code = code
        user.verification_code_sent_at = timezone.now()
        user.save(update_fields=["verification_code", "verification_code_sent_at"])
        return Response({"message": "Nouveau code de vérification envoyé."})


# =====================================================
# PASSWORD RESET
# =====================================================
class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        try:
            user = User.objects.get(email__iexact=email, is_active=True, is_verified=True)
        except User.DoesNotExist:
            return generic_password_reset_response()

        limited, limited_message = auth_email_limited(
            TransactionalEmailLog.EmailType.PASSWORD_RESET,
            user.email,
        )
        if limited:
            return Response({"error": limited_message}, status=429)

        code = str(random.randint(100000, 999999))
        expires_at = timezone.now() + timedelta(
            minutes=settings.AUTH_PASSWORD_RESET_CODE_TTL_MINUTES
        )
        email_sent, email_error, email_log = send_transactional_email(
            email_type=TransactionalEmailLog.EmailType.PASSWORD_RESET,
            recipient=user.email,
            subject="Code de réinitialisation ViewiseCRM",
            text_body=f"Bonjour {user.username}, votre code de réinitialisation est : {code}",
            html_body=render_auth_email(
                title="Réinitialisation de votre mot de passe",
                body=(
                    "Utilisez ce code pour choisir un nouveau mot de passe. "
                    f"Il expire dans {settings.AUTH_PASSWORD_RESET_CODE_TTL_MINUTES} minutes."
                ),
                code=code,
            ),
            user=user,
            metadata={"expires_at": expires_at.isoformat()},
        )

        if not email_sent:
            response = {"error": "Impossible d'envoyer le code. Veuillez réessayer plus tard."}
            if settings.DEBUG:
                response["email_error"] = email_error
            return Response(response, status=503)

        PasswordResetCode.objects.filter(user=user, used_at__isnull=True).update(
            used_at=timezone.now()
        )
        PasswordResetCode.objects.create(
            user=user,
            code_hash=make_password(code),
            email_log=email_log,
            expires_at=expires_at,
        )
        return generic_password_reset_response()


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        user = User.objects.filter(email__iexact=email, is_active=True, is_verified=True).first()
        serializer = PasswordResetConfirmSerializer(
            data=request.data,
            context={"user": user},
        )
        serializer.is_valid(raise_exception=True)

        if not user:
            return Response({"error": "Code invalide ou expiré."}, status=400)

        reset_code = (
            PasswordResetCode.objects.filter(
                user=user,
                used_at__isnull=True,
                expires_at__gte=timezone.now(),
            )
            .order_by("-created_at")
            .first()
        )

        if not reset_code or not check_password(serializer.validated_data["code"], reset_code.code_hash):
            return Response({"error": "Code invalide ou expiré."}, status=400)

        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        reset_code.used_at = timezone.now()
        reset_code.save(update_fields=["used_at"])
        return Response({"message": "Mot de passe réinitialisé avec succès."})


# =====================================================
# INVITE MEMBER
# =====================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def invite_member(request):
    company = request.user.company
    if not company:
        return Response({"error": "Aucune company"}, status=400)

    check_limits(company, "add_user")

    email = request.data.get("email")
    team_id = request.data.get("team_id")
    role = request.data.get("role", User.Role.COMMERCIAL)

    try:
        team = Team.objects.get(id=team_id, company=company)
    except Team.DoesNotExist:
        return Response({"error": "Équipe introuvable"}, status=404)

    invitation = Invitation.objects.create(
        email=email,
        team=team,
        invited_by=request.user,
        role=role,
    )

    link = f"http://localhost:3000/accept-invite/{invitation.token}"

    email_sent, email_error = send_mail_safely(
        subject="Invitation CRM",
        message=f"Vous avez ete invite a rejoindre la team {team.name}. Cliquez ici : {link}",
        recipient_list=[email],
    )

    response = {
        "message": "Invitation envoyee" if email_sent else "Invitation creee",
        "email_sent": email_sent,
        "token": str(invitation.token),
        "invite_link": link,
    }

    if not email_sent:
        response["warning"] = "Email non envoye: verifiez les identifiants SMTP Gmail."
        if settings.DEBUG:
            response["email_error"] = email_error

    return Response(response, status=status.HTTP_201_CREATED)


# =====================================================
# ACCEPT INVITATION
# =====================================================
@api_view(["POST"])
@permission_classes([AllowAny])
def accept_invite(request, token):
    try:
        invitation = Invitation.objects.get(token=token, accepted=False)
    except Invitation.DoesNotExist:
        return Response({"error": "Invitation invalide"}, status=400)

    if invitation.created_at < timezone.now() - timedelta(days=2):
        return Response({"error": "Invitation expirée"}, status=400)

    if User.objects.filter(email=invitation.email).exists():
        return Response({"error": "Cet email a déjà un compte"}, status=400)

    try:
        with transaction.atomic():
            serializer = RegisterSerializer(
                data={
                    "username": request.data["username"],
                    "email": invitation.email,
                    "password": request.data["password"],
                    "role": invitation.role,
                    "terms_accepted": request.data.get("terms_accepted"),
                },
                context={"send_verification_email": False},
            )

            serializer.is_valid(raise_exception=True)
            user = serializer.save()

            user.company = invitation.team.company
            user.save()

            invitation.team.members.add(user)
            invitation.accepted = True
            invitation.save()

            email_sent, email_error, email_log = send_transactional_email(
                email_type="verification",
                recipient=user.email,
                subject="Code de verification",
                text_body=f"Votre code de verification est : {user.verification_code}",
                html_body=render_auth_email(
                    title="Vérifiez votre adresse email",
                    body="Utilisez ce code pour finaliser votre invitation ViewiseCRM.",
                    code=user.verification_code,
                ),
                user=user,
                metadata={"invitation_id": invitation.id, "team_id": invitation.team_id},
            )

            if not email_sent:
                raise SMTPException(email_error or "Email verification sending failed")
            email_log.user = user
            email_log.save(update_fields=["user", "updated_at"])
            user.verification_code_sent_at = timezone.now()
            user.save(update_fields=["verification_code_sent_at"])
    except (SMTPException, OSError):
        return Response(
            {"error": "Impossible d'envoyer le code de vérification. Veuillez réessayer plus tard."},
            status=503,
        )

    return Response(
        {
            "message": "Compte créé avec succès",
            "email": user.email,
            "user_id": user.id,
            "email_sent": True,
        }
    )


# =====================================================
# USER CRUD
# =====================================================
class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["email", "username", "role"]
    ordering_fields = ["email", "username", "role"]

    def get_queryset(self):
        return User.objects.filter(company=self.request.user.company)

    @action(detail=False, methods=["get", "put"], permission_classes=[IsAuthenticated])
    def me(self, request):
        user = request.user

        if request.method == "GET":
            return Response(self.get_serializer(user).data)

        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["put"], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"user": request.user})
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response({"error": "Ancien mot de passe incorrect"}, status=400)

        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"message": "Mot de passe modifié"})


# =====================================================
# COMPLETE PROFILE
# =====================================================
class CompleteProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        user = request.user
        data = request.data

        user.phone_number = data.get("phone_number", user.phone_number)
        user.country = data.get("country", user.country)
        user.city = data.get("city", user.city)
        user.job_title = data.get("job_title", user.job_title)
        user.linkedin_url = data.get("linkedin_url", user.linkedin_url)
        if request.FILES.get("profile_picture"):
            user.profile_picture = request.FILES["profile_picture"]
        user.profile_completed = True
        user.save()

        company = user.company
        if not company:
            company = Company.objects.create(
                owner=user,
                name=data.get("name", f"{user.username} Company"),
                country=data.get("country", user.country),
                city=data.get("city", user.city),
                company_created=True,
            )
            user.company = company
            user.save()

        company.name = data.get("name", company.name)
        company.industry = data.get("industry", company.industry)
        company.number_of_employees = data.get("number_of_employees", company.number_of_employees)
        company.country = data.get("country", company.country)
        company.city = data.get("city", company.city)
        company.phone_number = data.get("phone_number", company.phone_number)
        company.founded_year = data.get("founded_year", company.founded_year)
        if request.FILES.get("logo"):
            company.logo = request.FILES["logo"]
        company.save()

        if not CompanySubscription.objects.filter(company=company).exists():
            starter_plan, _ = SubscriptionPlan.objects.get_or_create(
                name="starter",
                defaults={
                    "price": 20,
                    "max_users": 3,
                    "max_teams": 1,
                    "max_prospects": 50,
                    "description": "Plan Starter",
                },
            )
            today = timezone.now().date()
            CompanySubscription.objects.create(
                company=company,
                plan=starter_plan,
                start_date=today,
                end_date=today + timedelta(days=30),
                is_trial=True,
                trial_end_date=today + timedelta(days=15),
                is_active=True,
            )

        if not user.teams.exists():
            check_limits(company, "create_team")
            team = Team.objects.create(
                name=f"{company.name} Team",
                company=company,
                owner=user,
            )
            team.members.add(user)

        return Response(
            {
                "message": "Profil complété avec succès",
                "user": UserSerializer(user, context={"request": request}).data,
            }
        )


# =====================================================
# MY COMPANY
# =====================================================
class MyCompanyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = request.user.company
        if not company:
            return Response({"error": "Aucune société"}, status=404)

        return Response({
            "id": company.id,
            "name": company.name,
            "industry": company.industry,
            "city": company.city,
            "country": company.country,
            "phone_number": company.phone_number,
            "number_of_employees": company.number_of_employees,
            "founded_year": company.founded_year,
        })


# =====================================================
# UPDATE COMPANY
# =====================================================
class UpdateCompanyView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def put(self, request):
        company = request.user.company
        if not company:
            return Response({"error": "Aucune société"}, status=404)

        for field in [
            "name", "industry", "city", "country",
            "phone_number", "number_of_employees", "founded_year",
        ]:
            if field in request.data:
                setattr(company, field, request.data[field])

        company.save()
        return Response({"message": "Company mise à jour"})


# =====================================================
# TEAM MANAGEMENT
# =====================================================
class TeamViewSet(viewsets.ModelViewSet):
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Team.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != "ADMIN":
            raise PermissionDenied("Seul l'admin peut créer une team")
        check_limits(user.company, "create_team")
        team = serializer.save(owner=user, company=user.company)
        team.members.add(user)

    @action(detail=True, methods=["post"])
    def add_member(self, request, pk=None):
        team = self.get_object()
        if request.user.role != "ADMIN":
            return Response({"error": "Seul admin peut ajouter"}, status=403)
        check_limits(request.user.company, "add_user")
        user_id = request.data.get("user_id")
        try:
            user = User.objects.get(id=user_id, company=request.user.company)
        except User.DoesNotExist:
            return Response({"error": "Utilisateur introuvable"}, status=404)
        team.members.add(user)
        return Response({"message": "Membre ajouté"})

    @action(detail=True, methods=["post"])
    def remove_member(self, request, pk=None):
        team = self.get_object()
        user_id = request.data.get("user_id")
        try:
            user = User.objects.get(id=user_id, company=request.user.company)
        except User.DoesNotExist:
            return Response({"error": "Utilisateur introuvable"}, status=404)
        team.members.remove(user)
        return Response({"message": "Membre retiré"})


# =====================================================
# GET CURRENT USER  — GET /api/users/me/
# =====================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user, context={"request": request}).data)


# =====================================================
# MY TEAM
# =====================================================
class MyTeamView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        team = request.user.teams.first()
        if not team:
            return Response({"error": "Aucune team"}, status=404)
        return Response({
            "id": team.id,
            "name": team.name,
            "members_count": team.members.count(),
        })


# =====================================================
# TEAM MEMBERS
# =====================================================
class TeamMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, team_id):
        try:
            team = Team.objects.get(id=team_id, company=request.user.company)
        except Team.DoesNotExist:
            return Response({"error": "Équipe introuvable"}, status=404)

        members = team.members.all()
        return Response([
            {
                "id": m.id,
                "username": m.username,
                "email": m.email,
                "role": m.role,
            }
            for m in members
        ])


# =====================================================
# ASSIGNABLE USERS
# ✅ CORRIGÉ : retourne uniquement les COMMERCIAUX
#    Un prospect/tâche ne peut être assigné qu'à un commercial
#    — jamais à un Admin ou Manager
# =====================================================
class AssignableUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role == "ADMIN" or user.is_staff:
            # Admin voit TOUS les commerciaux de sa company
            users = User.objects.filter(
                company=user.company,
                role="COMMERCIAL",      # ✅ uniquement les commerciaux
                is_active=True,
            ).order_by("username")

        elif user.role == "MANAGER":
            # Manager voit uniquement les commerciaux de son équipe
            users = User.objects.filter(
                teams__in=user.teams.all(),
                company=user.company,
                role="COMMERCIAL",      # ✅ uniquement les commerciaux
                is_active=True,
            ).distinct().order_by("username")

        else:
            # Commercial → liste vide (il ne peut pas choisir)
            users = User.objects.none()

        return Response([
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "role": u.role,
            }
            for u in users
        ])
