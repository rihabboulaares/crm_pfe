from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0035_alter_prospect_status_review_needed"),
    ]

    operations = [
        migrations.AlterField(
            model_name="prospect",
            name="engagement_status",
            field=models.CharField(
                choices=[
                    ("new", "New"),
                    ("preparing", "Preparing"),
                    ("pending_validation", "Pending Validation"),
                    ("message_ready", "Message Ready"),
                    ("sending", "Sending"),
                    ("message_sent", "Message Sent"),
                    ("message_failed", "Message Failed"),
                    ("replied", "Replied"),
                    ("follow_up_required", "Follow-up Required"),
                    ("closed", "Closed"),
                    ("rejected", "Rejected"),
                    ("queued", "Queued"),
                    ("analyzing", "Analyzing"),
                    ("qualified", "Qualified"),
                    ("not_qualified", "Not Qualified"),
                    ("task_created", "Task Created"),
                    ("contacted", "Contacted"),
                    ("waiting_reply", "Waiting Reply"),
                    ("failed", "Failed"),
                ],
                default="new",
                max_length=30,
            ),
        ),
    ]
