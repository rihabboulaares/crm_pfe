from django.contrib import admin
from .models import User, Company, Team, Invitation, TransactionalEmailLog, PasswordResetCode

admin.site.register(User)
admin.site.register(Company)
admin.site.register(Team)
admin.site.register(Invitation)


@admin.register(TransactionalEmailLog)
class TransactionalEmailLogAdmin(admin.ModelAdmin):
    list_display = ("email_type", "recipient", "status", "attempts", "created_at", "sent_at")
    list_filter = ("email_type", "status", "created_at")
    search_fields = ("recipient", "subject", "error_message")
    readonly_fields = (
        "email_type",
        "recipient",
        "subject",
        "status",
        "attempts",
        "error_message",
        "user",
        "metadata",
        "created_at",
        "sent_at",
        "updated_at",
    )


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "used_at", "created_at")
    list_filter = ("used_at", "expires_at", "created_at")
    search_fields = ("user__email", "user__username")
    readonly_fields = ("user", "code_hash", "email_log", "expires_at", "used_at", "created_at")
