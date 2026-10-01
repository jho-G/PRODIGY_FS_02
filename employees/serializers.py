from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from .models import (
    AttendanceRecord,
    Department,
    Employee,
    EmployeeDocument,
    EmploymentEvent,
    Holiday,
    LeaveRequest,
    PerformanceReview,
    Payslip,
)
from .permissions import get_role


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    employee_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'employee_id']

    def get_role(self, obj):
        return get_role(obj)

    def get_employee_id(self, obj):
        """Employee record id linked to this login (null for pure admins)."""
        profile = getattr(obj, 'profile', None)
        if profile and profile.employee_id:
            return profile.employee_id
        return None


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        if username and password:
            user = authenticate(username=username, password=password)
            if not user:
                raise serializers.ValidationError('Invalid username or password.')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled.')
            attrs['user'] = user
            return attrs
        raise serializers.ValidationError('Must include "username" and "password".')


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    uploaded_by_username = serializers.CharField(source='uploaded_by.username', read_only=True)
    file_name = serializers.CharField(source='file.name', read_only=True)
    file_size = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeDocument
        fields = [
            'id', 'employee', 'employee_name', 'document_type', 'title',
            'file', 'file_name', 'file_size', 'file_url',
            'uploaded_by', 'uploaded_by_username', 'uploaded_at',
        ]
        read_only_fields = [
            'id', 'file_name', 'file_size', 'file_url',
            'uploaded_by', 'uploaded_by_username', 'uploaded_at',
        ]

    def get_file_size(self, obj):
        try:
            return obj.file.size
        except (ValueError, OSError):
            return 0

    def get_file_url(self, obj):
        try:
            return obj.file.url
        except ValueError:
            return None

    def validate_file(self, value):
        """Restrict uploads to common document formats and 10 MB."""
        max_bytes = 10 * 1024 * 1024
        allowed = {
            'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx',
        }
        ext = value.name.rsplit('.', 1)[-1].lower() if '.' in value.name else ''
        if ext not in allowed:
            raise serializers.ValidationError(
                f'Unsupported file type "-{ext}". Allowed: {", ".join(sorted(allowed))}.'
            )
        if value.size > max_bytes:
            raise serializers.ValidationError('File exceeds the 10 MB limit.')
        return value


class EmploymentEventSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    previous_department_name = serializers.CharField(
        source='previous_department.name', read_only=True
    )
    new_department_name = serializers.CharField(
        source='new_department.name', read_only=True
    )
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = EmploymentEvent
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_code',
            'event_type', 'effective_date', 'notes',
            'previous_department', 'previous_department_name',
            'new_department', 'new_department_name',
            'previous_position', 'new_position',
            'previous_salary', 'new_salary',
            'created_by', 'created_by_username', 'created_at',
        ]
        read_only_fields = [field for field in fields]


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ['id', 'name', 'date', 'description', 'created_at']
        read_only_fields = ['created_at']

    def validate_date(self, value):
        instance = getattr(self, 'instance', None)
        query = Holiday.objects.filter(date=value)
        if instance:
            query = query.exclude(pk=instance.pk)
        if query.exists():
            raise serializers.ValidationError("A holiday already exists on this date.")
        return value


class DepartmentSerializer(serializers.ModelSerializer):
    employee_count = serializers.SerializerMethodField()
    total_monthly_payroll = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'employee_count', 'total_monthly_payroll']

    def get_employee_count(self, obj):
        return obj.employee_set.filter(is_active=True).count()

    def get_total_monthly_payroll(self, obj):
        from django.db.models import Sum
        total = obj.employee_set.filter(is_active=True).aggregate(
            t=Sum('salary_monthly')
        )['t']
        return float(total or 0)


class EmployeeSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_detail = DepartmentSerializer(source='department', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    years_of_service = serializers.ReadOnlyField()
    effective_experience_years = serializers.ReadOnlyField()
    annual_leave_remaining = serializers.ReadOnlyField()
    monthly_salary = serializers.DecimalField(
        source='salary_monthly', max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = Employee
        fields = [
            'id',
            'employee_id',
            'first_name',
            'last_name',
            'full_name',
            'email',
            'phone_number',
            'date_of_birth',
            'age',
            'gender',
            'address',
            'emergency_contact_name',
            'emergency_contact_phone',
            'emergency_contact_relation',
            'department',
            'department_name',
            'department_detail',
            'position',
            'hire_date',
            'employment_status',
            'salary',              # annual
            'monthly_salary',      # per month
            'salary_monthly',      # writable alias
            'currency',
            'bank_account',
            'total_experience_years',
            'years_of_service',
            'effective_experience_years',
            'annual_leave_days',
            'annual_leave_remaining',
            'created_by',
            'created_by_username',
            'created_at',
            'updated_at',
            'is_active',
        ]
        read_only_fields = [
            'id',
            'full_name',
            'age',
            'years_of_service',
            'effective_experience_years',
            'annual_leave_remaining',
            'department_name',
            'department_detail',
            'created_by',
            'created_by_username',
            'created_at',
            'updated_at',
        ]

    def validate_employee_id(self, value):
        instance = getattr(self, 'instance', None)
        query = Employee.objects.filter(employee_id=value)
        if instance:
            query = query.exclude(pk=instance.pk)
        if query.exists():
            raise serializers.ValidationError("An employee with this Employee ID already exists.")
        return value

    def validate_email(self, value):
        instance = getattr(self, 'instance', None)
        query = Employee.objects.filter(email=value)
        if instance:
            query = query.exclude(pk=instance.pk)
        if query.exists():
            raise serializers.ValidationError("An employee with this email already exists.")
        return value


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_id_code',
            'leave_type',
            'start_date',
            'end_date',
            'days_count',
            'leave_days',
            'reason',
            'status',
            'reviewed_by',
            'reviewed_by_username',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'days_count', 'leave_days', 'status', 'reviewed_by',
            'reviewed_by_username', 'reviewed_at', 'created_at', 'updated_at',
        ]

    def validate(self, attrs):
        start = attrs.get('start_date')
        end = attrs.get('end_date')
        instance = getattr(self, 'instance', None)
        if instance:
            start = start or instance.start_date
            end = end or instance.end_date
        if start and end and end < start:
            raise serializers.ValidationError(
                {'end_date': 'End date cannot be before the start date.'}
            )
        return attrs


class AttendanceRecordSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    work_hours = serializers.ReadOnlyField()

    class Meta:
        model = AttendanceRecord
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_id_code',
            'date',
            'status',
            'check_in',
            'check_out',
            'work_hours',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'work_hours', 'created_at', 'updated_at']

    def validate(self, attrs):
        check_in = attrs.get('check_in')
        check_out = attrs.get('check_out')
        instance = getattr(self, 'instance', None)
        if instance:
            check_in = check_in or instance.check_in
            check_out = check_out or instance.check_out
        if check_in and check_out and check_out <= check_in:
            raise serializers.ValidationError(
                {'check_out': 'Check-out must be after check-in.'}
            )
        return attrs


class PerformanceReviewSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    position = serializers.CharField(source='employee.position', read_only=True)
    reviewer_username = serializers.CharField(source='reviewer.username', read_only=True)
    overall_rating = serializers.ReadOnlyField()
    rating_label = serializers.ReadOnlyField()

    class Meta:
        model = PerformanceReview
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_id_code',
            'department_name',
            'position',
            'reviewer',
            'reviewer_username',
            'review_period',
            'review_date',
            'productivity',
            'quality',
            'teamwork',
            'communication',
            'leadership',
            'overall_rating',
            'rating_label',
            'strengths',
            'areas_for_improvement',
            'goals',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'overall_rating', 'rating_label',
            'reviewer_username', 'created_at', 'updated_at',
        ]

    def validate(self, attrs):
        """Reviewer is set automatically on completion unless provided."""
        return attrs


class PayslipSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    position = serializers.CharField(source='employee.position', read_only=True)
    gross_pay = serializers.ReadOnlyField()
    total_deductions = serializers.ReadOnlyField()
    period_label = serializers.ReadOnlyField()

    class Meta:
        model = Payslip
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_id_code',
            'department_name',
            'position',
            'period_year',
            'period_month',
            'period_label',
            'basic_salary',
            'allowances',
            'bonus',
            'tax_deduction',
            'other_deductions',
            'gross_pay',
            'total_deductions',
            'net_pay',
            'currency',
            'notes',
            'generated_at',
        ]
        read_only_fields = [
            'id', 'gross_pay', 'total_deductions', 'net_pay',
            'generated_at',
        ]
