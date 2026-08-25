# users/jwt.py
# Vue JWT custom pour accepter "email" + "password"
# Compatible avec USERNAME_FIELD = "email" dans le modèle User

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.exceptions import AuthenticationFailed


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Surcharge username_field → "email"
    Django Simple JWT lit automatiquement User.USERNAME_FIELD = "email"
    donc cette classe suffit sans rien d'autre.
    """
    username_field = "email"

    def validate(self, attrs):
        data = super().validate(attrs)

        if not self.user.is_verified:
            raise AuthenticationFailed(
                "Compte non vérifié. Veuillez saisir le code de vérification envoyé par email.",
                code="email_not_verified",
            )

        return data


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
