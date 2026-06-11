from django.contrib import admin
from .models import User, Company, Team, Invitation

admin.site.register(User)
admin.site.register(Company)
admin.site.register(Team)
admin.site.register(Invitation)