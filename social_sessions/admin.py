from django.contrib import admin

from .models import SocialSession


@admin.register(SocialSession)
class SocialSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "status", "last_checked_at", "updated_at")
    list_filter = ("platform", "status")
    search_fields = ("user__email", "user__username", "platform")
