# users/jwt.py
# Vue JWT custom pour accepter "email" + "password"
# Compatible avec USERNAME_FIELD = "email" dans le modèle User

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Surcharge username_field → "email"
    Django Simple JWT lit automatiquement User.USERNAME_FIELD = "email"
    donc cette classe suffit sans rien d'autre.
    """
    username_field = "email"


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer