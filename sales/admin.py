from django.contrib import admin
from .models import PerformanceScore, ManagerFeedback, PerformanceGoal, CommercialBadge

@admin.register(PerformanceScore)
class PerformanceScoreAdmin(admin.ModelAdmin):
    list_display = ["commercial", "year", "month", "score", "penalty_points"]
    list_filter  = ["year", "month"]

@admin.register(ManagerFeedback)
class ManagerFeedbackAdmin(admin.ModelAdmin):
    list_display = ["given_by", "commercial", "rating", "year", "month"]

@admin.register(PerformanceGoal)
class PerformanceGoalAdmin(admin.ModelAdmin):
    list_display = ["commercial", "goal_type", "current_value", "target_value", "status"]

@admin.register(CommercialBadge)
class CommercialBadgeAdmin(admin.ModelAdmin):
    list_display = ["commercial", "badge_type", "year", "month"]