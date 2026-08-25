from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from agentProspection.services.session_lock_service import SessionBusyError, SessionLockService
from social_sessions.health_checker import SocialSessionHealthChecker
from social_sessions.models import SocialSession
from social_sessions.services_constants import normalize_platform
from users.models import Company, User


class Command(BaseCommand):
    help = "Diagnostique une session sociale sans afficher cookies ni storage_state."

    def add_arguments(self, parser):
        parser.add_argument("--user-id", type=int, required=True)
        parser.add_argument("--tenant-id", type=int, required=True)
        parser.add_argument("--platform", choices=["linkedin", "facebook", "instagram"], required=True)

    def handle(self, *args, **options):
        user_id = options["user_id"]
        tenant_id = options["tenant_id"]
        platform = normalize_platform(options["platform"])
        if not self._user_belongs_to_tenant(user_id, tenant_id):
            raise CommandError("USER_TENANT_MISMATCH")

        session = SocialSession.objects.filter(user_id=user_id, platform=platform).first()
        session_found = bool(session)
        path = Path(session.session_path) if session and session.session_path else None
        file_present = bool(path and path.exists())
        file_size = path.stat().st_size if file_present else 0
        lock_released = False
        result = None
        try:
            with SessionLockService().acquire(user_id=user_id, tenant_id=tenant_id, platform=platform):
                result = SocialSessionHealthChecker().check(str(path) if path else "", platform)
        except SessionBusyError as exc:
            result = None
            self.stdout.write(f"error_code=SESSION_BUSY")
            self.stdout.write(f"message={str(exc)}")
        finally:
            lock_released = True

        if session and result:
            session.status = SocialSession.CONNECTED if result.ok else result.status
            session.last_checked_at = timezone.now()
            session.last_error = None if result.ok else result.message
            session.save(update_fields=["status", "last_checked_at", "last_error", "updated_at"])

        self.stdout.write(f"session_found={session_found}")
        self.stdout.write(f"file_present={file_present}")
        self.stdout.write(f"file_size={file_size}")
        self.stdout.write(f"stored_status={(session.status if session else 'absent')}")
        if result:
            self.stdout.write(f"health_status={result.status}")
            self.stdout.write(f"final_url={result.final_url}")
            self.stdout.write(f"error_code={result.error_code}")
            self.stdout.write(f"message={result.message}")
            self.stdout.write(f"browser_closed={result.browser_closed}")
        self.stdout.write(f"lock_released={lock_released}")

    def _user_belongs_to_tenant(self, user_id, tenant_id):
        return Company.objects.filter(id=tenant_id, owner_id=user_id).exists() or User.objects.filter(
            id=user_id,
            company_id=tenant_id,
        ).exists()
