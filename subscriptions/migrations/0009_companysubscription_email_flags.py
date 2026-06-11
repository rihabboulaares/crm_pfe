from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0008_remove_companysubscription_stripe_checkout_session_id_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="companysubscription",
            name="expiration_email_sent",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="companysubscription",
            name="reminder_7_days_sent",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="companysubscription",
            name="trial_end_email_sent",
            field=models.BooleanField(default=False),
        ),
    ]
