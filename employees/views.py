from rest_framework import viewsets, permissions, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.authtoken.models import Token
from django.db.models import Count, Q
from django.contrib.auth import login, logout

from .models import Employee, Department
from .serializers import (
    EmployeeSerializer,
    DepartmentSerializer,
    UserSerializer,
    LoginSerializer,
)


class LoginAPIView(APIView):
    """
    User login endpoint returning Token for API authentication.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        login(request, user)
        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            'token': token.key,
            'user': UserSerializer(user).data,
            'message': 'Login successful.',
        }, status=status.HTTP_200_OK)


class LogoutAPIView(APIView):
    """
    User logout endpoint destroying current token.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Delete token if exists
        try:
            request.user.auth_token.delete()
        except (AttributeError, Token.DoesNotExist):
            pass

        logout(request)
        return Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)


class CurrentUserAPIView(APIView):
    """
    Retrieve authenticated user details.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class DepartmentViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Departments.
    """
    queryset = Department.objects.all().order_by('name')
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'id']


class EmployeeViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Employees with search, filtering, soft-delete, and statistics.
    """
    serializer_class = EmployeeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['first_name', 'last_name', 'employee_id', 'email', 'position']
    ordering_fields = ['first_name', 'last_name', 'hire_date', 'salary', 'created_at', 'employee_id']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = Employee.objects.select_related('department', 'created_by').all()

        # Department filter
        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(department_id=department)

        # Employment status filter
        employment_status = self.request.query_params.get('employment_status')
        if employment_status:
            queryset = queryset.filter(employment_status=employment_status)

        # Active status filter (defaults to active employees only unless specified)
        show_all = self.request.query_params.get('all', '').lower() == 'true'
        is_active_param = self.request.query_params.get('is_active')

        if not show_all:
            if is_active_param is not None:
                queryset = queryset.filter(is_active=is_active_param.lower() == 'true')
            else:
                queryset = queryset.filter(is_active=True)

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        hard_delete = self.request.query_params.get('hard', '').lower() == 'true'
        if hard_delete:
            instance.delete()
        else:
            # Soft delete by deactivating
            instance.is_active = False
            instance.save()

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Restore a soft-deleted employee."""
        employee = self.get_object()
        employee.is_active = True
        employee.save()
        return Response({
            'message': f'Employee {employee.full_name} restored successfully.',
            'employee': EmployeeSerializer(employee).data,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Aggregate statistical metrics for dashboard presentation."""
        total_employees = Employee.objects.count()
        active_employees = Employee.objects.filter(is_active=True).count()
        inactive_employees = total_employees - active_employees
        departments_count = Department.objects.count()

        # Breakdown by department
        dept_breakdown = (
            Department.objects.annotate(
                active_count=Count('employee', filter=Q(employee__is_active=True))
            ).values('id', 'name', 'active_count')
        )

        # Breakdown by employment status
        status_breakdown = {
            'FT': Employee.objects.filter(is_active=True, employment_status='FT').count(),
            'PT': Employee.objects.filter(is_active=True, employment_status='PT').count(),
            'CT': Employee.objects.filter(is_active=True, employment_status='CT').count(),
            'IN': Employee.objects.filter(is_active=True, employment_status='IN').count(),
        }

        return Response({
            'total_employees': total_employees,
            'active_employees': active_employees,
            'inactive_employees': inactive_employees,
            'departments_count': departments_count,
            'department_breakdown': list(dept_breakdown),
            'status_breakdown': status_breakdown,
        }, status=status.HTTP_200_OK)