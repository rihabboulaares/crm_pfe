from django.contrib import admin

from agentProspection.models import DiscoveryRun


@admin.register(DiscoveryRun)
class DiscoveryRunAdmin(admin.ModelAdmin):
    list_display = ("id", "company", "launched_by", "status", "started_at", "duration_seconds")
    list_filter = ("status", "company", "started_at")
    search_fields = ("query", "company__name", "launched_by__email", "launched_by__username")
    readonly_fields = ("created_at",)
