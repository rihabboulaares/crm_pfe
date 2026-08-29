from django.contrib import admin

from .models import EngagementCampaign, EngagementLog, ProspectEngagementMemory, UserEmailConnection


@admin.register(UserEmailConnection)
class UserEmailConnectionAdmin(admin.ModelAdmin):
    list_display = ("email", "provider", "user", "is_active", "last_verified_at", "updated_at")
    list_filter = ("provider", "is_active")
    search_fields = ("email", "display_name", "user__email")
    readonly_fields = ("created_at", "updated_at")


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


@admin.register(ProspectEngagementMemory)
class ProspectEngagementMemoryAdmin(admin.ModelAdmin):
    list_display = ("prospect", "interest_level", "current_solution", "next_direction", "updated_at")
    list_filter = ("interest_level", "next_direction")
    search_fields = ("prospect__first_name", "prospect__last_name", "current_solution", "relationship_summary")
    readonly_fields = ("created_at", "updated_at")
