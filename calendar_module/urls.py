"""
calendar_module/urls.py
"""
from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import CalendarEventViewSet, CalendarTasksView

router = DefaultRouter()
router.register(r"calendar-events", CalendarEventViewSet, basename="calendar-event")
urlpatterns = router.urls
urlpatterns += [
    path("calendar/tasks/", CalendarTasksView.as_view(), name="calendar-tasks"),
]
