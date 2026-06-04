from django.contrib import admin

from .models import EngagementCampaign, EngagementLog


@admin.register(EngagementLog)
class EngagementLogAdmin(admin.ModelAdmin):
    list_display = ("prospect", "action", "channel", "status", "company", "created_at")
    list_filter = ("action", "channel", "status", "company")
    search_fields = ("prospect__first_name", "prospect__last_name", "message", "error")


@admin.register(EngagementCampaign)
class EngagementCampaignAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "company", "created_by", "created_at")
    list_filter = ("status", "company")
    search_fields = ("name", "description")
