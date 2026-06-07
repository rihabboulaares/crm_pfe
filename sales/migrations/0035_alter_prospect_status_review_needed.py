from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0034_fix_missing_social_profile_columns"),
    ]

    operations = [
        migrations.AlterField(
            model_name="prospect",
            name="status",
            field=models.CharField(
                choices=[
                    ("new", "New"),
                    ("review_needed", "Review Needed"),
                    ("contacted", "Contacted"),
                    ("qualified", "Qualified"),
                    ("lost", "Lost"),
                    ("won", "Won"),
                ],
                default="new",
                max_length=20,
            ),
        ),
    ]
