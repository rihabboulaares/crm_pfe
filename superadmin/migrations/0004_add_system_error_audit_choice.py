from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("superadmin", "0003_rename_superadmin__company_8ecb1d_idx_superadmin__company_17a479_idx_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="superadminauditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("create", "Create"),
                    ("update", "Update"),
                    ("delete", "Delete"),
                    ("login", "Login"),
                    ("logout", "Logout"),
                    ("launch_agent", "Launch agent"),
                    ("send_message", "Send message"),
                    ("subscription_change", "Subscription change"),
                    ("toggle_user", "Toggle user"),
                    ("toggle_company", "Toggle company"),
                    ("system_error", "System error"),
                ],
                max_length=40,
            ),
        ),
    ]

