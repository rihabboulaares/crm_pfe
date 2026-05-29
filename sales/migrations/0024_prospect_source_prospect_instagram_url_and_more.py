from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0023_rename_osm_place_id_to_google_place_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="prospect",
            name="source",
            field=models.CharField(
                choices=[
                    ("commercial", "Ajouté par un commercial"),
                    ("agent_prospection", "Agent de prospection"),
                ],
                default="commercial",
                max_length=50,
            ),
        ),
        migrations.AddField(
            model_name="prospect",
            name="instagram_url",
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="website",
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospectcompany",
            name="linkedin_url",
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="prospectcompany",
            name="source",
            field=models.CharField(
                choices=[
                    ("commercial", "Ajouté par un commercial"),
                    ("agent_prospection", "Agent de prospection"),
                ],
                default="commercial",
                max_length=50,
            ),
        ),
    ]
