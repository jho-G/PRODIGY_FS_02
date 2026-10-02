from rest_framework import viewsets, permissions, status, filters
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.db.models import Count, Q, Sum, Avg, Max, F, Value, DecimalField
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from datetime import datetime, timezone as dt_timezone

from .permissions import (
    IsAuthenticatedReadOnlyOrStaff,
    IsHROrAdmin,
    ROLE_EMPLOYEE,
    ROLE_MANAGER,
    get_role,
    is_direct_manager,
    is_hr_or_above,
    is_manager_or_above,
)
from .notifications import (
    notify_document_uploaded,
    notify_leave_decision,
    notify_leave_submitted,
    notify_payslip_generated,
    notify_review_completed,
)

from .models import (
    AttendanceRecord,
    Employee,
    Department,
    EmployeeDocument,
    EmploymentEvent,
    Holiday,
    LeaveRequest,
    Notification,
    PerformanceReview,
    Payslip,
)
from .serializers import (
    AttendanceRecordSerializer,
    EmployeeSerializer,
    DepartmentSerializer,
    EmployeeDocumentSerializer,
    EmploymentEventSerializer,
    HolidaySerializer,
    NotificationSerializer,
    PerformanceReviewSerializer,
    PayslipSerializer,
    UserSerializer,
    LoginSerializer,
    LeaveRequestSerializer,
)


class LoginAPIView(APIView):
    """
    User login endpoint.
    Returns a JWT access token (short-lived) and a refresh token (long-lived).
    The client should store the refresh token securely and use it to obtain
    new access tokens via /api/auth/token/refresh/ before expiry.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        # Generate JWT token pair for the authenticated user
        refresh = RefreshToken.for_user(user)
        access = refresh.access_token

        return Response({
            'access': str(access),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
            'message': 'Login successful.',
        }, status=status.HTTP_200_OK)


class MeAPIView(APIView):
    """
    Employee self-service: the logged-in user's own profile, leave history,
    leave balance, payslips, reviews, documents, and employment timeline.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        employee = profile.employee if profile else None
        if not employee:
            return Response(
                {'detail': 'No employee record is linked to this account.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        leave_requests = employee.leave_requests.all()[:20]
        payslips = employee.payslips.all()[:12]
        reviews = employee.performance_reviews.all()[:10]
        documents = employee.documents.all()[:20]
        events = employee.employment_events.all()[:20]

        return Response({
            'employee': EmployeeSerializer(employee).data,
            'leave_balance': {
                'entitlement': employee.annual_leave_days,
                'used': employee.annual_leave_used(),
                'remaining': employee.annual_leave_remaining,
            },
            'leave_requests': LeaveRequestSerializer(leave_requests, many=True).data,
            'payslips': PayslipSerializer(payslips, many=True).data,
            'reviews': PerformanceReviewSerializer(reviews, many=True).data,
            'documents': EmployeeDocumentSerializer(documents, many=True).data,
            'employment_history': EmploymentEventSerializer(events, many=True).data,
            'manager': (
                {
                    'id': employee.manager.id,
                    'name': employee.manager.full_name,
                    'position': employee.manager.position,
                }
                if employee.manager else None
            ),
        })


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    In-app notifications for the logged-in user: list, unread count,
    mark one as read, and mark all as read.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'is_read']
    ordering = ['-created_at']

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread': count})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'marked': updated})


class LogoutAPIView(APIView):
    """
    User logout endpoint.
    Expects the client to send the refresh token in the request body.
    The refresh token is blacklisted, preventing any further token refreshes.
    The client must also discard the stored access token.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'detail': 'Refresh token is required for logout.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
    Reads: any authenticated user. Writes: manager+. Deletes: HR/admin only.
    """
    queryset = Department.objects.all().order_by('name')
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrStaff]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'id']


class HolidayViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for company holidays.
    Reads: any authenticated user. Writes: HR/admin only.
    """
    queryset = Holiday.objects.all().order_by('date')
    serializer_class = HolidaySerializer
    permission_classes = [permissions.IsAuthenticated, IsHROrAdmin]
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['date', 'name']

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """List the next N holidays from today (default 5)."""
        from datetime import date as dt_date
        try:
            limit = int(request.query_params.get('limit', 5))
        except (TypeError, ValueError):
            limit = 5
        limit = max(1, min(limit, 50))
        today = dt_date.today()
        holidays = self.get_queryset().filter(date__gte=today)[:limit]
        return Response(HolidaySerializer(holidays, many=True).data)


def _filtered_employees(request):
    """Shared employee queryset filtering for list + export endpoints."""
    queryset = Employee.objects.select_related('department', 'created_by').all()

    department = request.query_params.get('department')
    if department:
        queryset = queryset.filter(department_id=department)

    employment_status = request.query_params.get('employment_status')
    if employment_status:
        queryset = queryset.filter(employment_status=employment_status)

    # Salary range filters
    min_salary = request.query_params.get('min_salary')
    if min_salary:
        queryset = queryset.filter(salary__gte=min_salary)
    max_salary = request.query_params.get('max_salary')
    if max_salary:
        queryset = queryset.filter(salary__lte=max_salary)

    # Experience filters (effective = prior + service)
    min_experience = request.query_params.get('min_experience')
    if min_experience:
        try:
            years = int(min_experience)
            today = datetime.now().date()
            cutoff = today.replace(year=today.year - years)
            queryset = queryset.filter(hire_date__lte=cutoff)
        except (ValueError, TypeError):
            pass

    search = request.query_params.get('search')
    if search:
        queryset = queryset.filter(
            Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(employee_id__icontains=search)
            | Q(email__icontains=search)
            | Q(position__icontains=search)
        )

    show_all = request.query_params.get('all', '').lower() == 'true'
    is_active_param = request.query_params.get('is_active')

    if not show_all:
        if is_active_param is not None:
            queryset = queryset.filter(is_active=is_active_param.lower() == 'true')
        else:
            queryset = queryset.filter(is_active=True)

    ordering = request.query_params.get('ordering')
    allowed_orderings = {
        'salary', '-salary', 'salary_monthly', '-salary_monthly',
        'hire_date', '-hire_date', 'created_at', '-created_at',
        'first_name', '-first_name', 'last_name', '-last_name',
        'employee_id', '-employee_id',
    }
    if ordering in allowed_orderings:
        queryset = queryset.order_by(ordering)
    else:
        queryset = queryset.order_by('-created_at')

    return queryset


class EmployeeViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Employees with search, filtering, soft-delete, statistics,
    payroll metrics, and CSV export.
    Reads: any authenticated user (company directory).
    Writes: manager+. Deletes: HR/admin only.
    """
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrStaff]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['first_name', 'last_name', 'hire_date', 'salary', 'created_at', 'employee_id']
    ordering = ['-created_at']

    def get_queryset(self):
        if self.action == 'restore':
            # Soft-deleted employees are hidden by the default is_active filter,
            # so bypass it when locating a record to restore.
            return Employee.objects.select_related('department', 'created_by').all()
        return _filtered_employees(self.request)

    def perform_create(self, serializer):
        employee = serializer.save(created_by=self.request.user)
        # Seed the employment history timeline with the hire event
        EmploymentEvent.objects.create(
            employee=employee,
            event_type='HIRED',
            effective_date=employee.hire_date,
            new_department=employee.department,
            new_position=employee.position,
            new_salary=employee.salary,
            notes=f"Joined as {employee.position}.",
            created_by=self.request.user,
        )

    def perform_update(self, serializer):
        """Persist changes and record promotion/transfer/salary events."""
        original = Employee.objects.get(pk=serializer.instance.pk)
        employee = serializer.save()
        events = []

        if original.department_id != employee.department_id:
            events.append(EmploymentEvent(
                employee=employee,
                event_type='TRANSFER',
                previous_department=original.department,
                new_department=employee.department,
                notes=(
                    f"Moved from {original.department.name if original.department else 'Unassigned'} "
                    f"to {employee.department.name if employee.department else 'Unassigned'}."
                ),
                created_by=self.request.user,
            ))

        if original.position != employee.position:
            events.append(EmploymentEvent(
                employee=employee,
                event_type='PROMOTION',
                previous_position=original.position,
                new_position=employee.position,
                notes=f"{original.position} → {employee.position}.",
                created_by=self.request.user,
            ))

        if original.salary != employee.salary:
            events.append(EmploymentEvent(
                employee=employee,
                event_type='SALARY_CHANGE',
                previous_salary=original.salary,
                new_salary=employee.salary,
                notes=f"Annual salary changed from {original.salary} to {employee.salary}.",
                created_by=self.request.user,
            ))

        EmploymentEvent.objects.bulk_create(events)

    def perform_destroy(self, instance):
        hard_delete = self.request.query_params.get('hard', '').lower() == 'true'
        if hard_delete:
            instance.delete()
        else:
            # Soft delete by deactivating, recording the exit on the timeline
            instance.is_active = False
            instance.save()
            EmploymentEvent.objects.create(
                employee=instance,
                event_type='EXIT',
                notes="Deactivated (soft-deleted) in the system.",
                created_by=self.request.user,
            )

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

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """Export the current (filtered) employee directory as a CSV file."""
        import csv

        employees = _filtered_employees(request).order_by('employee_id')

        response = HttpResponse(content_type='text/csv')
        filename = f"employees_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        header = [
            'Employee ID', 'First Name', 'Last Name', 'Email', 'Phone',
            'Department', 'Position', 'Employment Status',
            'Annual Salary', 'Monthly Salary', 'Currency',
            'Total Experience (years)', 'Years of Service',
            'Hire Date', 'Annual Leave Days', 'Active',
        ]
        writer.writerow(header)

        for emp in employees:
            writer.writerow([
                emp.employee_id,
                emp.first_name,
                emp.last_name,
                emp.email,
                emp.phone_number,
                emp.department.name if emp.department else '',
                emp.position,
                emp.get_employment_status_display(),
                emp.salary,
                emp.salary_monthly,
                emp.currency,
                emp.effective_experience_years,
                emp.years_of_service,
                emp.hire_date,
                emp.annual_leave_days,
                'Yes' if emp.is_active else 'No',
            ])

        return response

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Aggregate statistical metrics for dashboard presentation."""
        money_field = DecimalField(max_digits=12, decimal_places=2)

        total_employees = Employee.objects.count()
        active_qs = Employee.objects.filter(is_active=True)
        active_employees = active_qs.count()
        inactive_employees = total_employees - active_employees
        departments_count = Department.objects.count()

        payroll_agg = active_qs.aggregate(
            total_monthly=Coalesce(Sum('salary_monthly'), Value(0), output_field=money_field),
            total_annual=Coalesce(Sum('salary'), Value(0), output_field=money_field),
            avg_monthly=Coalesce(Avg('salary_monthly'), Value(0), output_field=money_field),
            max_monthly=Coalesce(Max('salary_monthly'), Value(0), output_field=money_field),
        )
        highest_paid = (
            active_qs.order_by('-salary_monthly').first()
        )
        avg_service = 0
        for emp in active_qs:
            avg_service += emp.years_of_service
        if active_employees:
            avg_service = round(avg_service / active_employees, 1)

        # Breakdown by department (headcount + payroll)
        dept_breakdown = (
            Department.objects.annotate(
                active_count=Count('employee', filter=Q(employee__is_active=True)),
                monthly_payroll=Coalesce(
                    Sum('employee__salary_monthly',
                        filter=Q(employee__is_active=True)),
                    Value(0), output_field=money_field,
                ),
            ).values('id', 'name', 'active_count', 'monthly_payroll')
        )

        # Breakdown by employment status
        status_breakdown = {
            'FT': active_qs.filter(employment_status='FT').count(),
            'PT': active_qs.filter(employment_status='PT').count(),
            'CT': active_qs.filter(employment_status='CT').count(),
            'IN': active_qs.filter(employment_status='IN').count(),
        }

        return Response({
            'total_employees': total_employees,
            'active_employees': active_employees,
            'inactive_employees': inactive_employees,
            'departments_count': departments_count,
            'total_monthly_payroll': float(payroll_agg['total_monthly'] or 0),
            'total_annual_payroll': float(payroll_agg['total_annual'] or 0),
            'average_monthly_salary': float(payroll_agg['avg_monthly'] or 0),
            'highest_paid_employee': {
                'name': highest_paid.full_name if highest_paid else None,
                'position': highest_paid.position if highest_paid else None,
                'monthly_salary': float(highest_paid.salary_monthly) if highest_paid else 0,
            },
            'average_years_of_service': avg_service,
            'department_breakdown': list(dept_breakdown),
            'status_breakdown': status_breakdown,
        }, status=status.HTTP_200_OK)


class EmploymentEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only employment history timeline per employee. Seeded automatically
    from employee create/update/delete operations.
    """
    serializer_class = EmploymentEventSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['effective_date', 'created_at', 'event_type']
    ordering = ['-effective_date', '-created_at']

    def get_queryset(self):
        queryset = EmploymentEvent.objects.select_related(
            'employee', 'previous_department', 'new_department', 'created_by'
        ).all()
        employee = self.request.query_params.get('employee')
        if employee:
            queryset = queryset.filter(employee_id=employee)
        event_type = self.request.query_params.get('event_type')
        if event_type:
            queryset = queryset.filter(event_type=event_type.upper())
        return queryset


class EmployeeDocumentViewSet(viewsets.ModelViewSet):
    """
    Upload and manage employee documents (contracts, IDs, certificates).
    Multipart uploads; HR/admin and the owning employee can manage.
    """
    serializer_class = EmployeeDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['uploaded_at', 'title', 'document_type']
    ordering = ['-uploaded_at']

    def get_queryset(self):
        queryset = EmployeeDocument.objects.select_related(
            'employee', 'uploaded_by'
        ).all()
        employee = self.request.query_params.get('employee')
        if employee:
            queryset = queryset.filter(employee_id=employee)
        doc_type = self.request.query_params.get('document_type')
        if doc_type:
            queryset = queryset.filter(document_type=doc_type.upper())
        return queryset

    def perform_create(self, serializer):
        document = serializer.save(uploaded_by=self.request.user)
        notify_document_uploaded(document)


class LeaveRequestViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for employee leave requests with approval workflow.

    Visibility: employees see their own requests; managers see their own plus
    their direct reports'; HR/admin see everything.
    Approval: HR/admin, or the employee's direct manager.
    """
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'employee__first_name', 'employee__last_name',
        'employee__employee_id', 'reason',
    ]
    ordering_fields = ['start_date', 'end_date', 'created_at', 'status']
    ordering = ['-created_at']

    def _own_employee(self):
        profile = getattr(self.request.user, 'profile', None)
        return profile.employee if profile else None

    def get_queryset(self):
        queryset = LeaveRequest.objects.select_related(
            'employee', 'employee__department', 'reviewed_by'
        ).all()

        employee = self.request.query_params.get('employee')
        if employee:
            queryset = queryset.filter(employee_id=employee)

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param.upper())

        leave_type = self.request.query_params.get('leave_type')
        if leave_type:
            queryset = queryset.filter(leave_type=leave_type)

        # Role-based visibility scoping
        role = get_role(self.request.user)
        own_employee = self._own_employee()
        if role == ROLE_EMPLOYEE:
            queryset = (
                queryset.filter(employee=own_employee)
                if own_employee else queryset.none()
            )
        elif role == ROLE_MANAGER:
            if own_employee:
                queryset = queryset.filter(
                    Q(employee=own_employee) | Q(employee__manager=own_employee)
                )
            else:
                queryset = queryset.none()

        return queryset

    def _can_review(self, leave):
        """HR/admin can review anyone; managers only their direct reports."""
        user = self.request.user
        if is_hr_or_above(user):
            return True
        if get_role(user) == ROLE_MANAGER:
            own_employee = self._own_employee()
            return bool(own_employee and leave.employee.manager_id == own_employee.id)
        return False

    def _perform_review(self, leave, new_status):
        leave.status = new_status
        # Only manager-level reviewers are recorded as the decision maker
        if self._can_review(leave):
            leave.reviewed_by = self.request.user
            leave.reviewed_at = datetime.now()
        leave.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])
        return leave

    def perform_create(self, serializer):
        """Auto-assign the employee for self-service requests, then notify."""
        employee_param = self.request.data.get('employee')
        role = get_role(self.request.user)
        own_employee = self._own_employee()

        if employee_param and role == ROLE_EMPLOYEE:
            if not own_employee or int(employee_param) != own_employee.id:
                raise ValidationError(
                    {'employee': 'You can only submit leave requests for yourself.'}
                )

        if not employee_param:
            if not own_employee:
                raise ValidationError(
                    {'employee': 'No employee record is linked to your account; '
                                 'pass an explicit employee id.'}
                )
            leave = serializer.save(employee=own_employee)
        else:
            leave = serializer.save()
        notify_leave_submitted(leave)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a pending leave request (manager of the employee, HR, or admin)."""
        leave = self.get_object()
        if not self._can_review(leave):
            return Response(
                {'detail': 'You can only approve leave for your direct reports.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if leave.status != 'PENDING':
            return Response(
                {'detail': f'Only pending requests can be approved (current: {leave.status}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Enforce the employee's annual vacation entitlement before approving
        if leave.leave_type == 'VL':
            employee = leave.employee
            already_used = employee.annual_leave_used()
            if leave.leave_days > employee.annual_leave_days - already_used:
                return Response(
                    {
                        'detail': (
                            f'Insufficient leave balance: {leave.leave_days} working days requested, '
                            f'{employee.annual_leave_days - already_used} of '
                            f'{employee.annual_leave_days} remaining.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        leave = self._perform_review(leave, 'APPROVED')
        notify_leave_decision(leave)
        return Response(LeaveRequestSerializer(leave).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a pending leave request (manager of the employee, HR, or admin)."""
        leave = self.get_object()
        if not self._can_review(leave):
            return Response(
                {'detail': 'You can only reject leave for your direct reports.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if leave.status != 'PENDING':
            return Response(
                {'detail': f'Only pending requests can be rejected (current: {leave.status}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        leave = self._perform_review(leave, 'REJECTED')
        notify_leave_decision(leave)
        return Response(LeaveRequestSerializer(leave).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel an approved leave request (owner, manager of the owner, HR, or admin)."""
        leave = self.get_object()
        own_employee = self._own_employee()
        is_owner = own_employee and leave.employee_id == own_employee.id
        if not (is_owner or self._can_review(leave)):
            return Response(
                {'detail': 'You can only cancel your own leave or that of your direct reports.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if leave.status != 'APPROVED':
            return Response(
                {'detail': f'Only approved requests can be cancelled (current: {leave.status}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        leave = self._perform_review(leave, 'CANCELLED')
        notify_leave_decision(leave)
        return Response(LeaveRequestSerializer(leave).data, status=status.HTTP_200_OK)


class AttendanceViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for daily attendance records with check-in/out actions.
    Employees are scoped to their own records; manager+ see everyone's.
    """
    serializer_class = AttendanceRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['date', 'status', 'check_in']
    ordering = ['-date']

    def get_queryset(self):
        queryset = AttendanceRecord.objects.select_related('employee').all()

        employee = self.request.query_params.get('employee')
        if employee:
            queryset = queryset.filter(employee_id=employee)

        # Employees see only their own attendance
        if get_role(self.request.user) == ROLE_EMPLOYEE:
            profile = getattr(self.request.user, 'profile', None)
            own_employee = profile.employee if profile else None
            queryset = queryset.filter(employee=own_employee) if own_employee else queryset.none()

        date_param = self.request.query_params.get('date')
        if date_param:
            queryset = queryset.filter(date=date_param)

        date_after = self.request.query_params.get('date_after')
        if date_after:
            queryset = queryset.filter(date__gte=date_after)

        date_before = self.request.query_params.get('date_before')
        if date_before:
            queryset = queryset.filter(date__lte=date_before)

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param.upper())

        return queryset

    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        """Record a check-in time for an attendance record."""
        record = self.get_object()
        if record.check_in:
            return Response(
                {'detail': 'Check-in already recorded for this date.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        record.check_in = datetime.now().time()
        record.save()
        return Response(AttendanceRecordSerializer(record).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def check_out(self, request, pk=None):
        """Record a check-out time for an attendance record."""
        record = self.get_object()
        if not record.check_in:
            return Response(
                {'detail': 'Cannot check out before checking in.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if record.check_out:
            return Response(
                {'detail': 'Check-out already recorded for this date.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        record.check_out = datetime.now().time()
        record.save()
        return Response(AttendanceRecordSerializer(record).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Per-employee attendance counts for a given month (default: current)."""
        today = datetime.now().date()
        try:
            year = int(request.query_params.get('year', today.year))
            month = int(request.query_params.get('month', today.month))
        except (TypeError, ValueError):
            return Response(
                {'detail': 'year and month must be integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        records = AttendanceRecord.objects.filter(
            date__year=year, date__month=month
        ).values('employee_id').annotate(
            present=Count('id', filter=Q(status='PRESENT')),
            late=Count('id', filter=Q(status='LATE')),
            absent=Count('id', filter=Q(status='ABSENT')),
            on_leave=Count('id', filter=Q(status='LEAVE')),
            remote=Count('id', filter=Q(status='REMOTE')),
            total_days=Count('id'),
        )

        employee_ids = [r['employee_id'] for r in records]
        employees = {
            e.id: e for e in Employee.objects.filter(id__in=employee_ids)
        }

        summary = []
        for row in records:
            emp = employees.get(row['employee_id'])
            if not emp:
                continue
            summary.append({
                'employee': emp.id,
                'employee_name': emp.full_name,
                'employee_id_code': emp.employee_id,
                'present': row['present'],
                'late': row['late'],
                'absent': row['absent'],
                'on_leave': row['on_leave'],
                'remote': row['remote'],
                'total_days': row['total_days'],
            })

        summary.sort(key=lambda r: r['employee_name'])
        return Response({'year': year, 'month': month, 'summary': summary})


class PayslipViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for monthly payslips with bulk payroll generation.
    Employees are scoped to their own payslips; manager+ see everyone's.
    """
    serializer_class = PayslipSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['period_year', 'period_month', 'net_pay', 'generated_at']
    ordering = ['-period_year', '-period_month']

    def get_queryset(self):
        queryset = Payslip.objects.select_related(
            'employee', 'employee__department'
        ).all()

        employee = self.request.query_params.get('employee')
        if employee:
            queryset = queryset.filter(employee_id=employee)

        # Employees see only their own payslips
        if get_role(self.request.user) == ROLE_EMPLOYEE:
            profile = getattr(self.request.user, 'profile', None)
            own_employee = profile.employee if profile else None
            queryset = queryset.filter(employee=own_employee) if own_employee else queryset.none()

        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(employee__department_id=department)

        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(period_year=year)

        month = self.request.query_params.get('month')
        if month:
            queryset = queryset.filter(period_month=month)

        return queryset

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        """Generate (or refresh) payslips for all active employees for a month.

        Basic salary comes from each employee's monthly salary. Existing payslips
        for the period are recalculated, so allowanes/bonuses/deductions entered
        manually are overwritten — pass them per-payslip afterwards if needed.
        """
        from django.utils import timezone

        today = timezone.now().date()
        try:
            year = int(request.data.get('year', today.year))
            month = int(request.data.get('month', today.month))
        except (TypeError, ValueError):
            return Response(
                {'detail': 'year and month must be integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not 1 <= month <= 12:
            return Response(
                {'detail': 'month must be between 1 and 12.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_count = 0
        updated_count = 0
        for emp in Employee.objects.filter(is_active=True):
            basic = emp.salary_monthly or (emp.salary or 0) / 12
            payslip, created = Payslip.objects.update_or_create(
                employee=emp,
                period_year=year,
                period_month=month,
                defaults={
                    'basic_salary': basic,
                    'currency': emp.currency or 'USD',
                },
            )
            notify_payslip_generated(payslip)
            created_count += 1 if created else 0
            updated_count += 0 if created else 1
        
        return Response({
            'detail': f'Payroll generated for {year}-{month:02d}.',
            'created': created_count,
            'updated': updated_count,
            'total': created_count + updated_count,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """Export payslips (filtered by year/month/department) as CSV."""
        import csv

        payslips = self.get_queryset().order_by('period_year', 'period_month', 'employee__employee_id')

        response = HttpResponse(content_type='text/csv')
        filename = f"payroll_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow([
            'Employee ID', 'Employee Name', 'Department', 'Period',
            'Basic Salary', 'Allowances', 'Bonus', 'Gross Pay',
            'Tax', 'Other Deductions', 'Total Deductions',
            'Net Pay', 'Currency', 'Generated At',
        ])
        for slip in payslips:
            writer.writerow([
                slip.employee.employee_id,
                slip.employee.full_name,
                slip.employee.department.name if slip.employee.department else '',
                slip.period_label,
                slip.basic_salary,
                slip.allowances,
                slip.bonus,
                slip.gross_pay,
                slip.tax_deduction,
                slip.other_deductions,
                slip.total_deductions,
                slip.net_pay,
                slip.currency,
                slip.generated_at.strftime('%Y-%m-%d %H:%M'),
            ])
        return response

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Aggregate payroll totals for a given period (default: latest year)."""
        from django.utils import timezone as dj_timezone

        today = dj_timezone.now().date()
        try:
            year = int(request.query_params.get('year', today.year))
        except (TypeError, ValueError):
            return Response(
                {'detail': 'year must be an integer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        month_param = request.query_params.get('month')
        filters = {'period_year': year}
        if month_param:
            try:
                filters['period_month'] = int(month_param)
            except (TypeError, ValueError):
                return Response(
                    {'detail': 'month must be an integer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        money_field = DecimalField(max_digits=12, decimal_places=2)
        agg = Payslip.objects.filter(**filters).aggregate(
            total_net=Coalesce(Sum('net_pay'), Value(0), output_field=money_field),
            total_gross=Coalesce(
                Sum('basic_salary') + Sum('allowances') + Sum('bonus'),
                Value(0), output_field=money_field,
            ),
            total_tax=Coalesce(Sum('tax_deduction'), Value(0), output_field=money_field),
            payslip_count=Count('id'),
        )

        return Response({'year': year, **agg})


class PerformanceReviewViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for performance reviews with completion/acknowledgement
    workflow and aggregate rating analytics.
    """
    serializer_class = PerformanceReviewSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'employee__first_name', 'employee__last_name',
        'employee__employee_id', 'review_period',
        'strengths', 'areas_for_improvement', 'goals',
    ]
    ordering_fields = ['review_date', 'review_period', 'status', 'created_at']
    ordering = ['-review_date']

    def get_queryset(self):
        queryset = PerformanceReview.objects.select_related(
            'employee', 'employee__department', 'reviewer'
        ).all()

        employee = self.request.query_params.get('employee')
        if employee:
            queryset = queryset.filter(employee_id=employee)

        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(employee__department_id=department)

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param.upper())

        period = self.request.query_params.get('review_period')
        if period:
            queryset = queryset.filter(review_period__icontains=period)

        # Employees see only their own reviews
        if get_role(self.request.user) == ROLE_EMPLOYEE:
            profile = getattr(self.request.user, 'profile', None)
            own_employee = profile.employee if profile else None
            queryset = queryset.filter(employee=own_employee) if own_employee else queryset.none()

        return queryset

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark a draft review as completed; records the reviewer."""
        review = self.get_object()
        if review.status != 'DRAFT':
            return Response(
                {'detail': f'Only draft reviews can be completed (current: {review.status}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        review.status = 'COMPLETED'
        review.reviewer = request.user
        review.save(update_fields=['status', 'reviewer', 'updated_at'])
        notify_review_completed(review)
        return Response(PerformanceReviewSerializer(review).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Employee acknowledgement of a completed review."""
        review = self.get_object()
        if review.status != 'COMPLETED':
            return Response(
                {'detail': f'Only completed reviews can be acknowledged (current: {review.status}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        review.status = 'ACKNOWLEDGED'
        review.save(update_fields=['status', 'updated_at'])
        return Response(PerformanceReviewSerializer(review).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Aggregate review analytics: averages, distribution, top performers."""
        reviews = list(
            PerformanceReview.objects.select_related(
                'employee', 'employee__department'
            ).filter(status__in=['COMPLETED', 'ACKNOWLEDGED'])
        )

        total = len(reviews)
        if total == 0:
            return Response({
                'total_reviews': 0,
                'average_overall_rating': 0,
                'distribution': {},
                'top_performers': [],
                'department_averages': [],
            })

        label_order = [
            'Outstanding', 'Exceeds Expectations', 'Meets Expectations',
            'Needs Improvement', 'Unsatisfactory',
        ]
        distribution = {label: 0 for label in label_order}
        rating_sum = 0.0

        by_employee = {}
        by_department = {}

        for review in reviews:
            rating = review.overall_rating
            rating_sum += rating
            distribution[review.rating_label] = distribution.get(review.rating_label, 0) + 1

            emp = review.employee
            by_employee.setdefault(emp.id, {
                'employee': emp.id,
                'employee_name': emp.full_name,
                'employee_id_code': emp.employee_id,
                'position': emp.position,
                'department': emp.department.name if emp.department else None,
                'ratings': [],
            })['ratings'].append(rating)

            dept_name = emp.department.name if emp.department else 'Unassigned'
            by_department.setdefault(dept_name, []).append(rating)

        top_performers = sorted(
            (
                {
                    **data,
                    'average_rating': round(sum(data['ratings']) / len(data['ratings']), 2),
                    'review_count': len(data['ratings']),
                }
                for data in by_employee.values()
            ),
            key=lambda d: d['average_rating'],
            reverse=True,
        )[:5]
        for performer in top_performers:
            performer.pop('ratings', None)

        department_averages = sorted(
            (
                {
                    'department': dept,
                    'average_rating': round(sum(ratings) / len(ratings), 2),
                    'review_count': len(ratings),
                }
                for dept, ratings in by_department.items()
            ),
            key=lambda d: d['average_rating'],
            reverse=True,
        )

        return Response({
            'total_reviews': total,
            'average_overall_rating': round(rating_sum / total, 2),
            'distribution': distribution,
            'top_performers': top_performers,
            'department_averages': department_averages,
        })
