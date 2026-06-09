from django.db import migrations, models


def backfill_lead_origin(apps, schema_editor):
    Prospect = apps.get_model("sales", "Prospect")
    source_to_origin = {
        "agent_prospection": "prospection_agent",
        "google_maps": "google_maps",
        "linkedin": "linkedin",
        "facebook": "facebook",
        "instagram": "instagram",
        "web": "website",
        "website": "website",
    }

    for prospect in Prospect.objects.all().only("id", "source", "origin", "lead_origin"):
        source = (prospect.source or "").strip().lower()
        origin = (prospect.origin or "").strip().lower()
        lead_origin = source_to_origin.get(origin) or source_to_origin.get(source) or "manual"
        Prospect.objects.filter(pk=prospect.pk).update(lead_origin=lead_origin)


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0038_engagement_reply_tracking_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="prospect",
            name="lead_origin",
            field=models.CharField(
                choices=[
                    ("manual", "Manual"),
                    ("prospection_agent", "Prospection Agent"),
                    ("google_maps", "Google Maps"),
                    ("linkedin", "LinkedIn"),
                    ("facebook", "Facebook"),
                    ("instagram", "Instagram"),
                    ("website", "Website"),
                ],
                default="manual",
                max_length=50,
            ),
        ),
        migrations.RunPython(backfill_lead_origin, migrations.RunPython.noop),
    ]
