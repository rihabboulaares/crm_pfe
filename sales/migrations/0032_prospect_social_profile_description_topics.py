from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0031_prospect_description_social_profile_analysis"),
    ]

    operations = [
        migrations.AddField(
            model_name="prospect",
            name="social_profile_description",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="social_profile_topics",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
