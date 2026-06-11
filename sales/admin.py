from django.contrib import admin
from .models import (
    Account, ProspectCompany, Prospect, Contact,
    Opportunity, Task, TaskActivity, TaskComment,
    Pipeline, PipelineStage, OpportunityPipeline,
    PipelineAlert, PipelineStageTask,
)
admin.site.register(Account)
admin.site.register(ProspectCompany)
admin.site.register(Prospect)
admin.site.register(Contact)
admin.site.register(Opportunity)
admin.site.register(Task)
admin.site.register(TaskActivity)
admin.site.register(TaskComment)
admin.site.register(Pipeline)
admin.site.register(PipelineStage)
admin.site.register(OpportunityPipeline)
admin.site.register(PipelineAlert)
admin.site.register(PipelineStageTask)