from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SocialSession
from .serializers import SocialSessionSerializer
from .services import SUPPORTED_PLATFORMS, SocialSessionService, normalize_platform


class SocialSessionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = []
        for platform in ("linkedin", "facebook", "instagram"):
            session, _ = SocialSessionService.get_or_create_session(request.user, platform)
            sessions.append(session)
        return Response(SocialSessionSerializer(sessions, many=True).data)


class SocialSessionUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, platform):
        try:
            platform = normalize_platform(platform)
        except ValueError as exc:
            return Response({"ok": False, "message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"ok": False, "platform": platform, "status": "error", "message": "Champ file manquant."}, status=400)

        result = SocialSessionService.save_uploaded_session(request.user, platform, uploaded_file)
        return Response(result, status=200 if result.get("ok") else 400)


class SocialSessionCheckView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, platform):
        try:
            result = SocialSessionService.check_session(request.user, platform)
        except ValueError as exc:
            return Response({"ok": False, "message": str(exc)}, status=400)
        return Response(result)


class SocialSessionDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, platform):
        try:
            result = SocialSessionService.delete_session(request.user, platform)
        except ValueError as exc:
            return Response({"ok": False, "message": str(exc)}, status=400)
        return Response(result)
