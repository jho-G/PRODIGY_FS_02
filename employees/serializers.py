from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from .models import Department, Employee


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

    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'employee_count']

    def get_employee_count(self, obj):
        return obj.employee_set.filter(is_active=True).count()


class EmployeeSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_detail = DepartmentSerializer(source='department', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()

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
            'salary',
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
