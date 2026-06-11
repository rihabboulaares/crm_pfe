from django.test import TestCase

from agentEngagement.permissions import get_engagement_queryset_for_user, get_task_queryset_for_user
from sales.models import (
    Contact,
    Opportunity,
    OpportunityPipeline,
    Pipeline,
    PipelineAlert,
    PipelineStage,
    Prospect,
    Task,
    TaskActivity,
)
from sales.visibility import get_visible_users
from users.models import Company, Team, User


class SalesVisibilityTests(TestCase):
    def setUp(self):
        self.admin_a = self._user("admin-a", "ADMIN")
        self.company_a = Company.objects.create(owner=self.admin_a, name="Company A")
        self.admin_a.company = self.company_a
        self.admin_a.save(update_fields=["company"])

        self.manager_a = self._user("manager-a", "MANAGER", self.company_a)
        self.commercial_a1 = self._user("commercial-a1", "COMMERCIAL", self.company_a)
        self.commercial_a2 = self._user("commercial-a2", "COMMERCIAL", self.company_a)

        self.admin_b = self._user("admin-b", "ADMIN")
        self.company_b = Company.objects.create(owner=self.admin_b, name="Company B")
        self.admin_b.company = self.company_b
        self.admin_b.save(update_fields=["company"])

        self.team = Team.objects.create(name="Team A", company=self.company_a, owner=self.manager_a)
        self.team.members.add(self.commercial_a1, self.commercial_a2)

        self.prospect_admin = self._prospect("Admin", self.admin_a, self.company_a)
        self.prospect_manager = self._prospect("Manager", self.manager_a, self.company_a)
        self.prospect_c1 = self._prospect("Commercial1", self.commercial_a1, self.company_a)
        self.prospect_c2 = self._prospect("Commercial2", self.commercial_a2, self.company_a)
        self.prospect_b = self._prospect("OtherCompany", self.admin_b, self.company_b)

        self.contact_admin = self._contact("Admin", self.admin_a, self.company_a)
        self.contact_manager = self._contact("Manager", self.manager_a, self.company_a)
        self.contact_c1 = self._contact("Commercial1", self.commercial_a1, self.company_a)
        self.contact_c2 = self._contact("Commercial2", self.commercial_a2, self.company_a)
        self.contact_b = self._contact("OtherCompany", self.admin_b, self.company_b)

        self.opp_admin = self._opportunity("Admin", self.admin_a, self.company_a)
        self.opp_manager = self._opportunity("Manager", self.manager_a, self.company_a)
        self.opp_c1 = self._opportunity("Commercial1", self.commercial_a1, self.company_a)
        self.opp_c2 = self._opportunity("Commercial2", self.commercial_a2, self.company_a)
        self.opp_b = self._opportunity("OtherCompany", self.admin_b, self.company_b)

        self.task_admin = self._task("Admin", self.admin_a, self.prospect_admin, self.opp_admin, self.company_a)
        self.task_manager = self._task("Manager", self.manager_a, self.prospect_manager, self.opp_manager, self.company_a)
        self.task_c1 = self._task("Commercial1", self.commercial_a1, self.prospect_c1, self.opp_c1, self.company_a)
        self.task_c2 = self._task("Commercial2", self.commercial_a2, self.prospect_c2, self.opp_c2, self.company_a)
        self.task_b = self._task("OtherCompany", self.admin_b, self.prospect_b, self.opp_b, self.company_b)

        self.activity_admin = self._activity(self.task_admin, self.prospect_admin)
        self.activity_manager = self._activity(self.task_manager, self.prospect_manager)
        self.activity_c1 = self._activity(self.task_c1, self.prospect_c1)
        self.activity_c2 = self._activity(self.task_c2, self.prospect_c2)
        self.activity_b = self._activity(self.task_b, self.prospect_b)

        pipeline = Pipeline.objects.create(name="Pipeline A", company=self.company_a, created_by=self.admin_a)
        stage = PipelineStage.objects.create(pipeline=pipeline, name="New", order=1, company=self.company_a)
        self.op_pipeline_admin = self._op_pipeline(self.opp_admin, pipeline, stage)
        self.op_pipeline_manager = self._op_pipeline(self.opp_manager, pipeline, stage)
        self.op_pipeline_c1 = self._op_pipeline(self.opp_c1, pipeline, stage)
        self.op_pipeline_c2 = self._op_pipeline(self.opp_c2, pipeline, stage)

        pipeline_b = Pipeline.objects.create(name="Pipeline B", company=self.company_b, created_by=self.admin_b)
        stage_b = PipelineStage.objects.create(pipeline=pipeline_b, name="New", order=1, company=self.company_b)
        self.op_pipeline_b = self._op_pipeline(self.opp_b, pipeline_b, stage_b)

        self.alert_admin = self._alert(self.op_pipeline_admin, self.admin_a, self.company_a)
        self.alert_manager = self._alert(self.op_pipeline_manager, self.manager_a, self.company_a)
        self.alert_c1 = self._alert(self.op_pipeline_c1, self.commercial_a1, self.company_a)
        self.alert_c2 = self._alert(self.op_pipeline_c2, self.commercial_a2, self.company_a)
        self.alert_b = self._alert(self.op_pipeline_b, self.admin_b, self.company_b)

    def _user(self, username, role, company=None):
        return User.objects.create_user(
            email=f"{username}@example.com",
            username=username,
            password="password",
            role=role,
            company=company,
            is_active=True,
        )

    def _prospect(self, name, assigned_to, company):
        return Prospect.objects.create(
            first_name=name,
            last_name="Prospect",
            email=f"{name.lower()}-{company.pk}@example.com",
            assigned_to=assigned_to,
            company=company,
        )

    def _contact(self, name, assigned_to, company):
        return Contact.objects.create(
            first_name=name,
            last_name="Contact",
            email=f"{name.lower()}-contact-{company.pk}@example.com",
            assigned_to=assigned_to,
            company=company,
        )

    def _opportunity(self, name, assigned_to, company):
        return Opportunity.objects.create(
            name=f"{name} opportunity",
            amount=1000,
            assigned_to=assigned_to,
            company=company,
        )

    def _task(self, name, assigned_to, prospect, opportunity, company):
        return Task.objects.create(
            title=f"{name} task",
            assigned_to=assigned_to,
            created_by=assigned_to,
            prospect=prospect,
            opportunity=opportunity,
            company=company,
        )

    def _activity(self, task, prospect):
        return TaskActivity.objects.create(task=task, prospect=prospect, activity_type="note")

    def _op_pipeline(self, opportunity, pipeline, stage):
        return OpportunityPipeline.objects.create(
            opportunity=opportunity,
            pipeline=pipeline,
            current_stage=stage,
            company=opportunity.company,
        )

    def _alert(self, op_pipeline, assigned_to, company):
        return PipelineAlert.objects.create(
            opportunity_pipeline=op_pipeline,
            alert_type="at_risk",
            severity="warning",
            message="Alert",
            assigned_to=assigned_to,
            company=company,
        )

    def assert_ids(self, qs, expected):
        self.assertEqual(set(qs.values_list("id", flat=True)), {obj.id for obj in expected})

    def test_visible_users_by_role(self):
        self.assert_ids(
            get_visible_users(self.admin_a),
            [self.admin_a, self.manager_a, self.commercial_a1, self.commercial_a2],
        )
        self.assert_ids(
            get_visible_users(self.manager_a),
            [self.manager_a, self.commercial_a1, self.commercial_a2],
        )
        self.assert_ids(get_visible_users(self.commercial_a1), [self.commercial_a1])

    def test_prospect_and_task_visibility(self):
        manager_expected = [self.prospect_manager, self.prospect_c1, self.prospect_c2]
        self.assert_ids(get_engagement_queryset_for_user(self.admin_a), [
            self.prospect_admin,
            self.prospect_manager,
            self.prospect_c1,
            self.prospect_c2,
        ])
        self.assert_ids(get_engagement_queryset_for_user(self.manager_a), manager_expected)
        self.assert_ids(get_engagement_queryset_for_user(self.commercial_a1), [self.prospect_c1])

        self.assert_ids(get_task_queryset_for_user(self.manager_a), [
            self.task_manager,
            self.task_c1,
            self.task_c2,
        ])
        self.assert_ids(get_task_queryset_for_user(self.commercial_a1), [self.task_c1])

    def test_related_model_visibility_filters(self):
        visible = get_visible_users(self.manager_a)

        self.assert_ids(
            Contact.objects.filter(company=self.company_a, assigned_to__in=visible),
            [self.contact_manager, self.contact_c1, self.contact_c2],
        )
        self.assert_ids(
            Opportunity.objects.filter(company=self.company_a, assigned_to__in=visible),
            [self.opp_manager, self.opp_c1, self.opp_c2],
        )
        self.assert_ids(
            TaskActivity.objects.filter(task__company=self.company_a, task__assigned_to__in=visible),
            [self.activity_manager, self.activity_c1, self.activity_c2],
        )
        self.assert_ids(
            OpportunityPipeline.objects.filter(company=self.company_a, opportunity__assigned_to__in=visible),
            [self.op_pipeline_manager, self.op_pipeline_c1, self.op_pipeline_c2],
        )
        self.assert_ids(
            PipelineAlert.objects.filter(company=self.company_a, assigned_to__in=visible),
            [self.alert_manager, self.alert_c1, self.alert_c2],
        )
