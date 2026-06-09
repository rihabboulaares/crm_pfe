from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0036_add_engagement_pending_validation_statuses"),
    ]

    origin_choices = [
        ("agent_prospection", "Agent de prospection"),
        ("website", "Website"),
        ("facebook", "Facebook"),
        ("instagram", "Instagram"),
        ("linkedin", "LinkedIn"),
        ("google_maps", "Google Maps"),
        ("referral", "Referral"),
    ]

    operations = [
        migrations.AddField(
            model_name="prospectcompany",
            name="address",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospectcompany",
            name="google_maps_url",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
        migrations.AddField(
            model_name="prospectcompany",
            name="latitude",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospectcompany",
            name="longitude",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="address",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="latitude",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="longitude",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="prospect",
            name="google_maps_url",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
        migrations.AlterField(
            model_name="prospect",
            name="origin",
            field=models.CharField(
                blank=True,
                choices=origin_choices,
                max_length=50,
                null=True,
            ),
        ),
    ]
