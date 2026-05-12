# users/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .jwt import EmailTokenObtainPairView          # ← login avec email
from .views import (
    RegisterView,
    VerifyEmailView,
    UserViewSet,
    TeamViewSet,
    invite_member,
    accept_invite,
    CompleteProfileView,
    MyCompanyView,
    UpdateCompanyView,
    MyTeamView,
    TeamMembersView,
    me_view,
    AssignableUsersView,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"teams", TeamViewSet, basename="teams")

urlpatterns = [

    # ── Authentification ──────────────────────────────────────
    # POST { email, password } → { access, refresh }
    path("login/",        EmailTokenObtainPairView.as_view(), name="login"),
    # POST { refresh } → { access }
    path("refresh/",      TokenRefreshView.as_view(),         name="refresh"),

    path("register/",     RegisterView.as_view(),             name="register"),
    path("verify-email/", VerifyEmailView.as_view(),          name="verify-email"),

    # ── Profil courant ────────────────────────────────────────
    # GET → données de l'utilisateur connecté (utilisé par le frontend après login)
    path("me/", me_view, name="me"),

    # ── Invitations ───────────────────────────────────────────
    path("invite-member/",              invite_member,  name="invite-member"),
    path("accept-invite/<uuid:token>/", accept_invite,  name="accept-invite"),

    # ── Profil & Company ──────────────────────────────────────
    path("complete-profile/", CompleteProfileView.as_view(), name="complete-profile"),
    path("company/me/",       MyCompanyView.as_view(),       name="my-company"),
    path("company/update/",   UpdateCompanyView.as_view(),   name="update-company"),

    # ── Équipe ────────────────────────────────────────────────
    path("team/me/",                     MyTeamView.as_view(),     name="my-team"),
    path("teams/<int:team_id>/members/", TeamMembersView.as_view(), name="team-members"),

    # ── Assignation ───────────────────────────────────────────
    path("assignable-users/", AssignableUsersView.as_view(), name="assignable-users"),

    # ── Router (UserViewSet + TeamViewSet) ────────────────────
    # Génère : /users/, /users/<pk>/, /users/me/, /users/change_password/
    #          /teams/, /teams/<pk>/, /teams/<pk>/add_member/, etc.
    path("", include(router.urls)),
]