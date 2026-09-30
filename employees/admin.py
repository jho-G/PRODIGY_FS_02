from django.contrib import admin
from .models import (
    AttendanceRecord,
    Department,
    Employee,
    LeaveRequest,
    Payslip,
    PerformanceReview,
)

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'employee_count')
    search_fields = ('name',)

    def employee_count(self, obj):
        return obj.employee_set.filter(is_active=True).count()

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'full_name_display', 'department', 'position',
                    'employment_status', 'salary', 'salary_monthly',
                    'total_experience_years', 'is_active')
    list_filter = ('department', 'employment_status', 'is_active', 'gender')
    search_fields = ('employee_id', 'first_name', 'last_name', 'email', 'position')
    readonly_fields = ('years_of_service', 'effective_experience_years')

    def full_name_display(self, obj):
        return obj.full_name
    full_name_display.short_description = 'Name'

@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = ('employee', 'period_year', 'period_month', 'gross_pay',
                    'total_deductions', 'net_pay', 'currency')
    list_filter = ('period_year', 'period_month', 'currency')
    search_fields = ('employee__first_name', 'employee__last_name', 'employee__employee_id')

@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ('employee', 'date', 'status', 'check_in', 'check_out', 'notes')
    list_filter = ('status', 'date')
    search_fields = ('employee__first_name', 'employee__last_name', 'employee__employee_id')

@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ('employee', 'leave_type', 'start_date', 'end_date',
                    'days_count', 'status', 'reviewed_by')
    list_filter = ('status', 'leave_type')
    search_fields = ('employee__first_name', 'employee__last_name', 'employee__employee_id')

@admin.register(PerformanceReview)
class PerformanceReviewAdmin(admin.ModelAdmin):
    list_display = ('employee', 'review_period', 'review_date', 'overall_rating',
                    'rating_label', 'status', 'reviewer')
    list_filter = ('status', 'review_period', 'review_date')
    search_fields = ('employee__first_name', 'employee__last_name',
                     'employee__employee_id', 'review_period', 'strengths',
                     'areas_for_improvement', 'goals')
    readonly_fields = ('overall_rating', 'rating_label')
