from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0033_merge_20260604_1709"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE sales_prospect
            ADD COLUMN IF NOT EXISTS social_profile_description text;

            ALTER TABLE sales_prospect
            ADD COLUMN IF NOT EXISTS social_profile_topics jsonb NOT NULL DEFAULT '[]'::jsonb;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
