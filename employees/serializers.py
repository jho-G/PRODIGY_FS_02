from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from .models import AttendanceRecord, Department, Employee, LeaveRequest, Payslip


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


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
            'reason',
            'status',
            'reviewed_by',
            'reviewed_by_username',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'days_count', 'status', 'reviewed_by', 'reviewed_by_username',
            'reviewed_at', 'created_at', 'updated_at',
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
