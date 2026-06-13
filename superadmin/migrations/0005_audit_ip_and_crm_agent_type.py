from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("superadmin", "0004_add_system_error_audit_choice"),
    ]

    operations = [
        migrations.AddField(
            model_name="superadminauditlog",
            name="ip_address",
            field=models.GenericIPAddressField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="aiagentrun",
            name="agent_type",
            field=models.CharField(
                choices=[
                    ("prospection", "Prospection"),
                    ("engagement", "Engagement"),
                    ("crm", "CRM"),
                ],
                max_length=30,
            ),
        ),
    ]

