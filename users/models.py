from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
import uuid


# -----------------------
# Gestionnaire de User
# -----------------------
class UserManager(BaseUserManager):

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email obligatoire")

        email = self.normalize_email(email)

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, email, password=None, **extra_fields):

        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_verified", True)

        return self.create_user(email, password, **extra_fields)


# -----------------------
# User
# -----------------------
class User(AbstractBaseUser, PermissionsMixin):

    class Role(models.TextChoices):
        SUPERADMIN = "SUPERADMIN"
        ADMIN = "ADMIN"
        MANAGER = "MANAGER"
        COMMERCIAL = "COMMERCIAL"

    email = models.EmailField(unique=True)
    username = models.CharField(max_length=100, unique=True)

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.COMMERCIAL
    )

    # Relation vers Company (tous les membres de l'entreprise)
    company = models.ForeignKey(
        "Company",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users"
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)

    verification_code = models.CharField(max_length=6, null=True, blank=True)

    # -----------------------
    # Profil
    # -----------------------

    phone_number = models.CharField(max_length=20, blank=True, null=True)

    country = models.CharField(max_length=50, blank=True, null=True)

    city = models.CharField(max_length=50, blank=True, null=True)

    job_title = models.CharField(max_length=100, blank=True, null=True)

    profile_picture = models.ImageField(
        upload_to="profile_pics/",
        blank=True,
        null=True
    )

    linkedin_url = models.URLField(blank=True, null=True)

    profile_completed = models.BooleanField(default=False)

    USERNAME_FIELD = "email"

    REQUIRED_FIELDS = ["username"]

    objects = UserManager()

    def __str__(self):
        return self.email


# -----------------------
# Company
# -----------------------
class Company(models.Model):

    owner = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="owned_company"   # ✅ corrigé
    )

    name = models.CharField(max_length=200)

    industry = models.CharField(max_length=100, blank=True, null=True)

    number_of_employees = models.PositiveIntegerField(blank=True, null=True)

    logo = models.ImageField(
        upload_to="company_logos/",
        blank=True,
        null=True
    )

    country = models.CharField(max_length=50, blank=True, null=True)

    city = models.CharField(max_length=50, blank=True, null=True)

    phone_number = models.CharField(max_length=20, blank=True, null=True)

    founded_year = models.PositiveIntegerField(blank=True, null=True)

    company_created = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or f"Company of {self.owner.username}"


# -----------------------
# Team
# -----------------------
class Team(models.Model):

    name = models.CharField(max_length=100)

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="teams"
    )

    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="owned_teams"
    )

    members = models.ManyToManyField(
        User,
        related_name="teams",
        blank=True
    )

    def save(self, *args, **kwargs):

        is_new = self.pk is None

        super().save(*args, **kwargs)

        # Ajouter automatiquement le owner comme membre
        if is_new and self.owner:
            self.members.add(self.owner)

    def __str__(self):
        return f"{self.name} ({self.company.name})"


# -----------------------
# Invitation
# -----------------------
class Invitation(models.Model):

    email = models.EmailField()

    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True
    )

    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="invitations"
    )

    invited_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    role = models.CharField(
        max_length=20,
        choices=User.Role.choices,
        default=User.Role.COMMERCIAL
    )

    accepted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invitation for {self.email} to {self.team.name}"