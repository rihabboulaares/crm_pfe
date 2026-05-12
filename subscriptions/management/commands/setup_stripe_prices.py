# subscriptions/management/commands/setup_stripe_prices.py
from django.core.management.base import BaseCommand
from subscriptions.models import SubscriptionPlan
import stripe
from django.conf import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

class Command(BaseCommand):
    help = 'Configure les prix Stripe pour les plans'

    def handle(self, *args, **options):
        self.stdout.write("🚀 Configuration des prix Stripe...")

        # Mapping des plans vers les prix en cents
        plans_config = [
            {'name': 'starter', 'price': 2000, 'desc': 'Starter Plan'},
            {'name': 'pro', 'price': 5000, 'desc': 'Pro Plan'},
            {'name': 'enterprise', 'price': 10000, 'desc': 'Enterprise Plan'},
        ]

        for config in plans_config:
            try:
                # Récupérer ou créer le plan
                plan, created = SubscriptionPlan.objects.get_or_create(
                    name=config['name'],
                    defaults={
                        'price': config['price'] / 100,
                        'description': config['desc'],
                        'duration_days': 30,
                    }
                )

                # Si le plan a déjà un stripe_price_id, vérifier s'il est valide
                if plan.stripe_price_id:
                    try:
                        price = stripe.Price.retrieve(plan.stripe_price_id)
                        self.stdout.write(f"✅ {plan.name}: déjà configuré ({price.id})")
                        continue
                    except:
                        self.stdout.write(f"⚠️  {plan.name}: price ID invalide, recréation...")

                # Créer le produit Stripe
                product = stripe.Product.create(
                    name=config['desc'],
                    metadata={'plan_name': plan.name}
                )

                # Créer le prix
                price = stripe.Price.create(
                    product=product.id,
                    unit_amount=config['price'],
                    currency='usd',
                    recurring={'interval': 'month'},
                    metadata={'plan_name': plan.name}
                )

                # Sauvegarder l'ID
                plan.stripe_price_id = price.id
                plan.save()

                self.stdout.write(self.style.SUCCESS(
                    f"✅ {plan.name}: {price.id} (${config['price']/100}/mois)"
                ))

            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f"❌ Erreur pour {config['name']}: {e}"
                ))

        self.stdout.write(self.style.SUCCESS("🎉 Configuration terminée!"))