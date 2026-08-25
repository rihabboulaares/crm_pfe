# users/serializers.py
from rest_framework import serializers
from .models import User, Team, Company
import re
import random
from smtplib import SMTPException
from django.db import transaction
from django.contrib.auth.password_validation import validate_password as django_validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from django.conf import settings

from .email_service import render_auth_email, send_transactional_email


# ===============================
# REGISTER SERIALIZER
# ===============================
class RegisterSerializer(serializers.ModelSerializer):
    terms_accepted = serializers.BooleanField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "role", "terms_accepted"]
        extra_kwargs = {
            "password": {"write_only": True},
            "role": {"required": False}
        }

    def validate_terms_accepted(self, value):
        if value is not True:
            raise serializers.ValidationError(
                "Vous devez accepter les conditions d'utilisation."
            )
        return value

    # -----------------------
    # Validation email
    # -----------------------
    def validate_email(self, value):
        if not re.match(r"[^@]+@[^@]+\.[^@]+", value):
            raise serializers.ValidationError("Adresse email invalide")

        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Cet email est déjà utilisé")

        return value

    # -----------------------
    # Validation password
    # -----------------------
    def validate_password(self, value):

        if len(value) < 8:
            raise serializers.ValidationError(
                "Le mot de passe doit contenir au moins 8 caractères"
            )

        if not re.search(r"[A-Z]", value):
            raise serializers.ValidationError(
                "Le mot de passe doit contenir au moins une majuscule"
            )

        if not re.search(r"\d", value):
            raise serializers.ValidationError(
                "Le mot de passe doit contenir au moins un chiffre"
            )

        if not re.search(r"[!@#$%^&*()_+]", value):
            raise serializers.ValidationError(
                "Le mot de passe doit contenir un caractère spécial"
            )

        try:
            django_validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))

        return value

    # -----------------------
    # CREATE USER
    # -----------------------
    def create(self, validated_data):

        role = validated_data.get("role", User.Role.ADMIN)
        validated_data.pop("terms_accepted", None)
        code = str(random.randint(100000, 999999))

        try:
            email_log = None
            if self.context.get("send_verification_email", True):
                email_sent, email_error, email_log = send_transactional_email(
                    email_type="verification",
                    recipient=validated_data["email"],
                    subject="Code de vérification CRM",
                    text_body=f"Bonjour {validated_data['username']}, votre code est : {code}",
                    html_body=render_auth_email(
                        title="Vérifiez votre adresse email",
                        body="Utilisez ce code pour activer votre compte ViewiseCRM.",
                        code=code,
                    ),
                    metadata={"username": validated_data["username"]},
                )
                if not email_sent:
                    raise SMTPException(email_error or "Email verification sending failed")

            with transaction.atomic():
                user = User.objects.create_user(
                    username=validated_data["username"],
                    email=validated_data["email"],
                    password=validated_data["password"],
                    role=role,
                )

                user.verification_code = code
                user.verification_code_sent_at = timezone.now()
                user.terms_accepted_at = timezone.now()
                user.terms_version = settings.AUTH_TERMS_VERSION
                user.is_verified = False
                user.profile_completed = False
                user.save()

                if email_log:
                    email_log.user = user
                    email_log.save(update_fields=["user", "updated_at"])
        except (SMTPException, OSError):
            raise serializers.ValidationError(
                {
                    "email": [
                        "Impossible d'envoyer le code de vérification. Veuillez réessayer plus tard."
                    ]
                }
            )

        return user


# ===============================
# USER PROFILE SERIALIZER
# ===============================
class UserSerializer(serializers.ModelSerializer):

    teams = serializers.SerializerMethodField()
    company = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "role",
            "phone_number",
            "country",
            "city",
            "job_title",
            "linkedin_url",
            "profile_picture",
            "profile_completed",
            "is_active",
            "teams",
            "company",
        ]

        read_only_fields = [
            "id",
            "email",
            "role",
            "is_active",
            "teams",
            "company",
        ]

    # -----------------------
    # Teams
    # -----------------------
    def get_teams(self, obj):

        return [
            {
                "id": t.id,
                "name": t.name
            }
            for t in obj.teams.all()
        ]

    # -----------------------
    # Company
    # -----------------------
    def get_company(self, obj):

        c = obj.company

        if not c:
            return None

        request = self.context.get("request")
        logo = None
        if c.logo:
            logo = request.build_absolute_uri(c.logo.url) if request else c.logo.url

        return {
            "id": c.id,
            "name": c.name,
            "industry": c.industry,
            "number_of_employees": c.number_of_employees,
            "logo": logo,
            "city": c.city,
            "country": c.country,
            "phone_number": c.phone_number,
            "founded_year": c.founded_year,
            "company_created": c.company_created,
    }


# ===============================
# CHANGE PASSWORD
# ===============================
class ChangePasswordSerializer(serializers.Serializer):

    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

    def validate_new_password(self, value):

        if len(value) < 8:
            raise serializers.ValidationError(
                "Le nouveau mot de passe doit contenir au moins 8 caractères"
            )
        try:
            django_validate_password(value, self.context.get("user"))
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))

        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    code = serializers.CharField(required=True, min_length=6, max_length=6)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("Code invalide")
        return value

    def validate_new_password(self, value):
        user = self.context.get("user")
        if len(value) < 8:
            raise serializers.ValidationError(
                "Le mot de passe doit contenir au moins 8 caractères"
            )
        try:
            django_validate_password(value, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


# ===============================
# TEAM SERIALIZER
# ===============================
class TeamSerializer(serializers.ModelSerializer):

    owner = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "company",
            "owner",
            "members"
        ]

        read_only_fields = [
            "company",
            "owner",
            "members"
        ]

    # -----------------------
    # Owner
    # -----------------------
    def get_owner(self, obj):

        return {
            "id": obj.owner.id,
            "username": obj.owner.username,
            "email": obj.owner.email
        }

    # -----------------------
    # Members
    # -----------------------
    def get_members(self, obj):

        members = obj.members.all()

        return [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role
            }
            for user in members
        ]
