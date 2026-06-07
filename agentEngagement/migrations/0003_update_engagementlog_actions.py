from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agentEngagement", "0002_rename_agentengag_company_58f518_idx_agentengage_company_9af815_idx_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="engagementlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("message_generated", "Message generated"),
                    ("message_updated", "Message updated"),
                    ("message_sent", "Message sent"),
                    ("send_error", "Send error"),
                    ("message_rejected", "Message rejected"),
                    ("agent_launched", "Agent launched"),
                    ("replied", "Replied"),
                    ("follow_up_created", "Follow-up created"),
                    ("campaign_created", "Campaign created"),
                ],
                default="message_generated",
                max_length=40,
            ),
        ),
    ]
