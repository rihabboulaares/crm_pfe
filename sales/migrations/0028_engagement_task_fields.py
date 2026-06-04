from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("agentEngagement", "0001_initial"),
        ("sales", "0027_prospect_engagement_subject_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="task",
            name="source",
            field=models.CharField(blank=True, max_length=60, null=True),
        ),
        migrations.AddField(
            model_name="task",
            name="linked_engagement_message",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="task",
            name="engagement_log",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="tasks",
                to="agentEngagement.engagementlog",
            ),
        ),
        migrations.AddField(
            model_name="task",
            name="prospect_company",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="tasks",
                to="sales.prospectcompany",
            ),
        ),
        migrations.AlterField(
            model_name="task",
            name="task_type",
            field=models.CharField(
                choices=[
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
                ],
                default="classic",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="task",
            name="status",
            field=models.CharField(
                choices=[
                    ("todo", "To Do"),
                    ("pending", "Pending"),
                    ("ready", "Ready"),
                    ("in_progress", "In Progress"),
                    ("done", "Done"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                    ("failed", "Failed"),
                ],
                default="todo",
                max_length=20,
            ),
        ),
    ]
