from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0021_prospect_facebook_url_prospect_linkedin_url_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="prospect",
            name="email",
            field=models.EmailField(blank=True, max_length=254, null=True, unique=True),
        ),
    ]
