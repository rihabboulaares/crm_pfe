from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0022_alter_prospect_email"),
    ]

    operations = [
        migrations.RenameField(
            model_name="prospectcompany",
            old_name="osm_place_id",
            new_name="google_place_id",
        ),
        migrations.AlterField(
            model_name="prospectcompany",
            name="google_place_id",
            field=models.CharField(blank=True, max_length=150, null=True),
        ),
    ]
