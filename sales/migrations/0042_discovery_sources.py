from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0041_prospect_analysis_error_message_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="prospectcompany",
            name="discovery_sources",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="prospect",
            name="discovery_sources",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
