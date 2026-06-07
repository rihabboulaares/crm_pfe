try:
    from celery import shared_task
except ImportError:
    shared_task = None

from users.models import Company, User

from .runner import launch_engagement_agent


if shared_task:

    @shared_task(bind=True, max_retries=2)
    def launch_engagement_agent_task(self, company_id, user_id, limit=25, scrape=True, auto_send=False):
        user = User.objects.get(pk=user_id)
        company = Company.objects.get(pk=company_id)
        return launch_engagement_agent(
            company=company,
            user=user,
            limit=limit,
            scrape=scrape,
            auto_send=auto_send,
        )

else:
    launch_engagement_agent_task = None
