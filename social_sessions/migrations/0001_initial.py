from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SocialSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("platform", models.CharField(choices=[("linkedin", "LinkedIn"), ("facebook", "Facebook"), ("instagram", "Instagram")], max_length=20)),
                ("status", models.CharField(choices=[("not_connected", "Non connecte"), ("connected", "Connecte"), ("expired", "Expire"), ("verification_required", "Verification requise"), ("error", "Erreur")], default="not_connected", max_length=30)),
                ("session_path", models.CharField(blank=True, max_length=500, null=True)),
                ("last_checked_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.TextField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "unique_together": {("user", "platform")},
            },
        ),
        migrations.AddIndex(
            model_name="socialsession",
            index=models.Index(fields=["user", "platform"], name="social_sess_user_id_4d9e7a_idx"),
        ),
        migrations.AddIndex(
            model_name="socialsession",
            index=models.Index(fields=["status", "updated_at"], name="social_sess_status_832da9_idx"),
        ),
    ]
