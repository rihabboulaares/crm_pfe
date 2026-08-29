from django.contrib import admin

from .models import ProspectQualification


@admin.register(ProspectQualification)
class ProspectQualificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "prospect",
        "qualification_mode",
        "score",
        "status",
        "opportunity_ready",
        "created_by",
        "created_at",
    )
    list_filter = ("qualification_mode", "status", "opportunity_ready", "created_at")
    search_fields = ("prospect__first_name", "prospect__last_name", "summary")
    readonly_fields = ("created_at",)

