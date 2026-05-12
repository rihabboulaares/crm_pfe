# subscriptions/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('plans/', views.SubscriptionPlansView.as_view(), name='subscription-plans'),
    path('current/', views.CurrentSubscriptionView.as_view(), name='current-subscription'),
    path('create-checkout-session/', views.CreateCheckoutSessionView.as_view(), name='create-checkout'),
    path('upgrade/', views.UpgradeSubscriptionView.as_view(), name='upgrade-subscription'),
    path('webhook/', views.stripe_webhook, name='stripe-webhook'),
]