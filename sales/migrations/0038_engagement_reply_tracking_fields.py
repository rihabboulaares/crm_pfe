from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0037_maps_location_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="prospect",
            name="conversation_status",
            field=models.CharField(default="not_contacted", max_length=40),
        ),
        migrations.AddField(
            model_name="prospect",
            name="generated_followup_message",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="last_message_sent",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="last_message_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="last_reply_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="last_reply_checked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="last_reply_text",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="next_recommended_action",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="reply_sentiment",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="prospect",
            name="reply_summary",
            field=models.TextField(blank=True, null=True),
        ),
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
                    ("reply_detected", "Reply Detected"),
                    ("followup_generated", "Follow-up Generated"),
                    ("opportunity_ready", "Opportunity Ready"),
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
