from django.contrib import admin
from .models import Department, Employee

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'description')
    search_fields = ('name',)

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'first_name', 'last_name', 'department', 'position', 'employment_status', 'is_active')
    list_filter = ('department', 'employment_status', 'is_active')
    search_fields = ('employee_id', 'first_name', 'last_name', 'email')
