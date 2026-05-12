# subscriptions/management/commands/create_recurring_prices_simple.py
from django.core.management.base import BaseCommand
from subscriptions.models import SubscriptionPlan
import stripe
from django.conf import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

class Command(BaseCommand):
    help = 'Version simple - Crée les prix récurrents Stripe'

    def handle(self, *args, **options):
        self.stdout.write("🚀 Création des prix récurrents (version simple)...")
        
        # Configuration manuelle
        # Tu dois remplacer ces IDs par ceux que tu obtiens du dashboard Stripe
        # Va sur https://dashboard.stripe.com/prices et crée les prix manuellement
        
        price_ids = {
            'starter': 'price_1TBat5FQnlvscCidXXXXXXXX',  # À remplacer
            'pro': 'price_1TBat5FQnlvscCidYYYYYYYY',      # À remplacer
            'enterprise': 'price_1TBat5FQnlvscCidZZZZZZZZ', # À remplacer
        }
        
        for plan_name, price_id in price_ids.items():
            try:
                plan = SubscriptionPlan.objects.get(name=plan_name)
                old_id = plan.stripe_price_id
                plan.stripe_price_id = price_id
                plan.save()
                
                self.stdout.write(self.style.SUCCESS(
                    f"✅ {plan_name}: {old_id} → {price_id}"
                ))
                
            except SubscriptionPlan.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"❌ Plan {plan_name} non trouvé"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"❌ Erreur: {e}"))