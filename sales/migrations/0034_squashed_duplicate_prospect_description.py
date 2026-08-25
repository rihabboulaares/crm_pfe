from django.db import migrations, models


class Migration(migrations.Migration):
    replaces = [
        ("sales", "0031_prospect_description_social_profile_analysis"),
        ("sales", "0032_prospect_social_profile_description_topics"),
        ("sales", "0033_merge_20260604_1709"),
        ("sales", "0034_fix_missing_social_profile_columns"),
    ]

    dependencies = [
        ("sales", "0031_prospect_description_and_more"),
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
