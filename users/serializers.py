# users/serializers.py
from rest_framework import serializers
from .models import User, Team, Company
import re
import random
from django.core.mail import send_mail


# ===============================
# REGISTER SERIALIZER
# ===============================
class RegisterSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = ["username", "email", "password", "role"]
        extra_kwargs = {
            "password": {"write_only": True},
            "role": {"required": False}
        }

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

        return value

    # -----------------------
    # CREATE USER
    # -----------------------
    def create(self, validated_data):

        role = validated_data.get("role", User.Role.ADMIN)

        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            role=role,
        )

        # Générer code verification
        code = str(random.randint(100000, 999999))

        user.verification_code = code
        user.is_verified = False
        user.profile_completed = False
        user.save()

        # Envoi email
        send_mail(
            subject="Code de vérification CRM",
            message=f"Bonjour {user.username}, votre code est : {code}",
            from_email="noreply@crm.com",
            recipient_list=[user.email],
            fail_silently=True,
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

        return {
            "id": c.id,
            "name": c.name,
            "industry": c.industry,
            "number_of_employees": c.number_of_employees,
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