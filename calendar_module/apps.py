"""
calendar_module/apps.py
Enregistrement des signaux au démarrage de l'application.
"""
from django.apps import AppConfig


class CalendarModuleConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "calendar_module"
    verbose_name = "Calendrier CRM"

    def ready(self):
        import calendar_module.signals  # noqa: F401 — déclenche l'enregistrement des receivers