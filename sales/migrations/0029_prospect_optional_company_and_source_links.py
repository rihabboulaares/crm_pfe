from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0028_engagement_task_fields"),
    ]

    source_choices = [
        ("commercial", "Ajoute par un commercial"),
        ("agent_prospection", "Agent de prospection"),
        ("google_maps", "Google Maps"),
        ("linkedin", "LinkedIn"),
        ("instagram", "Instagram"),
        ("facebook", "Facebook"),
        ("web", "Web"),
        ("other", "Autre"),
    ]

    task_type_choices = [
        ("classic", "Tache classique"),
        ("quota", "Tache quota / objectif"),
        ("call", "Appel"),
        ("linkedin_message", "Message LinkedIn"),
        ("email", "Email"),
        ("facebook_message", "Message Facebook"),
        ("instagram_message", "Message Instagram"),
        ("follow_up", "Relance"),
        ("meeting", "RDV"),
        ("note", "Note"),
        ("other", "Autre"),
    ]

    operations = [
        migrations.AddField(
            model_name="prospect",
            name="google_maps_url",
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="notes",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="source_url",
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="prospect",
            name="prospect_company",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="prospects",
                to="sales.prospectcompany",
            ),
        ),
        migrations.AlterField(
            model_name="prospect",
            name="source",
            field=models.CharField(choices=source_choices, default="commercial", max_length=50),
        ),
        migrations.AlterField(
            model_name="prospectcompany",
            name="source",
            field=models.CharField(choices=source_choices, default="commercial", max_length=50),
        ),
        migrations.AlterField(
            model_name="task",
            name="task_type",
            field=models.CharField(choices=task_type_choices, default="classic", max_length=20),
        ),
    ]
