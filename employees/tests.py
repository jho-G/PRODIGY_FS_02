from datetime import date, time, timedelta

from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status

from .models import (
    AttendanceRecord,
    Department,
    Employee,
    EmploymentEvent,
    Holiday,
    LeaveRequest,
    Notification,
    PerformanceReview,
    Payslip,
    UserProfile,
)


def _days_ago(days):
    return date.today() - timedelta(days=days)


def _user_with_role(username, role, employee=None):
    """Create a user with a UserProfile role and optional linked employee."""
    user = User.objects.create_user(username=username, password='pass12345')
    UserProfile.objects.create(user=user, role=role, employee=employee)
    return user


class EmployeeModelTests(APITestCase):
    def setUp(self):
        self.department = Department.objects.create(name='Engineering')

    def test_monthly_salary_derived_from_annual(self):
        employee = Employee.objects.create(
            first_name='Selam', last_name='Girma',
            email='selam.girma@example.com', date_of_birth=date(1995, 5, 10),
            gender='F', address='Addis Ababa', employee_id='EMP-9001',
            department=self.department, position='Software Engineer',
            salary=60000,
        )
        self.assertEqual(str(employee.salary_monthly), '5000.00')

    def test_years_of_service_from_hire_date(self):
        employee = Employee.objects.create(
            first_name='Yonas', last_name='Bekele',
            email='yonas.bekele@example.com', date_of_birth=date(1990, 1, 1),
            gender='M', address='Addis Ababa', employee_id='EMP-9002',
            department=self.department, position='DevOps Engineer',
            salary=90000,
        )
        Employee.objects.filter(pk=employee.pk).update(hire_date=_days_ago(800))
        employee.refresh_from_db()
        self.assertGreaterEqual(employee.years_of_service, 2)

    def test_effective_experience_includes_prior(self):
        employee = Employee(
            first_name='Liya', last_name='Tesfaye',
            email='liya.tesfaye@example.com', date_of_birth=date(1992, 3, 3),
            gender='F', address='Addis Ababa', employee_id='EMP-9003',
            department=self.department, position='Data Analyst',
            salary=70000, total_experience_years=5,
        )
        self.assertEqual(employee.effective_experience_years, 5 + employee.years_of_service)


class EmployeeAPITests(APITestCase):
    def setUp(self):
        self.user = _user_with_role('admin', 'ADMIN')
        self.client.force_authenticate(user=self.user)
        self.department = Department.objects.create(name='Finance')
        self.employee = Employee.objects.create(
            first_name='Meron', last_name='Alemu',
            email='meron.alemu@example.com', date_of_birth=date(1993, 7, 21),
            gender='F', address='Addis Ababa', employee_id='EMP-9101',
            department=self.department, position='Accountant',
            salary=72000,
        )

    def test_create_employee_sets_created_by(self):
        payload = {
            'first_name': 'Dawit', 'last_name': 'Negash',
            'email': 'dawit.negash@example.com', 'date_of_birth': '1994-02-14',
            'gender': 'M', 'address': 'Addis Ababa', 'employee_id': 'EMP-9102',
            'position': 'QA Engineer', 'salary': '65000',
        }
        response = self.client.post('/api/employees/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        employee = Employee.objects.get(employee_id='EMP-9102')
        self.assertEqual(employee.created_by, self.user)
        self.assertEqual(str(employee.salary_monthly), '5416.67')

    def test_soft_delete_and_restore(self):
        response = self.client.delete(f'/api/employees/{self.employee.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.employee.refresh_from_db()
        self.assertFalse(self.employee.is_active)

        response = self.client.post(f'/api/employees/{self.employee.id}/restore/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertTrue(self.employee.is_active)

    def test_stats_include_payroll_metrics(self):
        response = self.client.get('/api/employees/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_employees'], 1)
        self.assertGreater(float(response.data['total_monthly_payroll']), 0)

    def test_authentication_required(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/employees/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class LeaveWorkflowTests(APITestCase):
    def setUp(self):
        # The acting user is a manager with an employee record of their own;
        # the leave requester reports to them.
        self.manager_employee = Employee.objects.create(
            first_name='Tesfaye', last_name='Negash',
            email='tesfaye.negash@example.com', date_of_birth=date(1985, 2, 2),
            gender='M', address='Addis Ababa', employee_id='EMP-9200',
            position='HR Manager', salary=85000,
        )
        self.user = _user_with_role('manager', 'MANAGER', employee=self.manager_employee)
        self.client.force_authenticate(user=self.user)
        self.employee = Employee.objects.create(
            first_name='Hanna', last_name='Worku',
            email='hanna.worku@example.com', date_of_birth=date(1996, 9, 9),
            gender='F', address='Addis Ababa', employee_id='EMP-9201',
            position='HR Officer', salary=55000,
            manager=self.manager_employee,
        )
        self.leave = LeaveRequest.objects.create(
            employee=self.employee, leave_type='VL',
            start_date=_days_ago(-2), end_date=_days_ago(-5),
        )

    def test_days_count_is_inclusive(self):
        self.assertEqual(self.leave.days_count, 4)

    def test_approve_then_cancel(self):
        response = self.client.post(f'/api/leaves/{self.leave.id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.leave.refresh_from_db()
        self.assertEqual(self.leave.status, 'APPROVED')
        self.assertEqual(self.leave.reviewed_by, self.user)

        response = self.client.post(f'/api/leaves/{self.leave.id}/cancel/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.leave.refresh_from_db()
        self.assertEqual(self.leave.status, 'CANCELLED')

    def test_cannot_approve_twice(self):
        self.leave.status = 'APPROVED'
        self.leave.save()
        response = self.client.post(f'/api/leaves/{self.leave.id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PayslipTests(APITestCase):
    def setUp(self):
        self.user = _user_with_role('payroll', 'ADMIN')
        self.client.force_authenticate(user=self.user)
        self.employee = Employee.objects.create(
            first_name='Samuel', last_name='Getachew',
            email='samuel.getachew@example.com', date_of_birth=date(1988, 11, 2),
            gender='M', address='Addis Ababa', employee_id='EMP-9301',
            position='Financial Analyst', salary=96000,
        )

    def test_net_pay_derived_on_save(self):
        payslip = Payslip.objects.create(
            employee=self.employee, period_year=2026, period_month=8,
            basic_salary=8000, allowances=500, bonus=200,
            tax_deduction=1000, other_deductions=100,
        )
        self.assertEqual(str(payslip.net_pay), '7600.00')

    def test_bulk_generate_creates_payslips_for_active_employees(self):
        response = self.client.post('/api/payslips/generate/', {'year': 2026, 'month': 8})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['created'], 1)
        self.assertTrue(
            Payslip.objects.filter(employee=self.employee, period_year=2026, period_month=8).exists()
        )

    def test_generate_validates_month(self):
        response = self.client.post('/api/payslips/generate/', {'year': 2026, 'month': 13})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AttendanceTests(APITestCase):
    def setUp(self):
        self.user = _user_with_role('hr', 'HR')
        self.client.force_authenticate(user=self.user)
        self.employee = Employee.objects.create(
            first_name='Robel', last_name='Mulugeta',
            email='robel.mulugeta@example.com', date_of_birth=date(1997, 4, 18),
            gender='M', address='Addis Ababa', employee_id='EMP-9401',
            position='Sales Representative', salary=48000,
        )

    def test_late_arrival_auto_flagged(self):
        record = AttendanceRecord.objects.create(
            employee=self.employee, date=date.today(),
            status='PRESENT', check_in=time(9, 30),
        )
        self.assertEqual(record.status, 'LATE')

    def test_check_in_check_out_flow(self):
        record = AttendanceRecord.objects.create(employee=self.employee, date=date.today())

        response = self.client.post(f'/api/attendance/{record.id}/check_out/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(f'/api/attendance/{record.id}/check_in/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(f'/api/attendance/{record.id}/check_in/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(f'/api/attendance/{record.id}/check_out/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_monthly_summary(self):
        today = date.today()
        AttendanceRecord.objects.create(
            employee=self.employee, date=today, status='PRESENT',
            check_in=time(8, 45), check_out=time(17, 0),
        )
        response = self.client.get(
            f'/api/attendance/summary/?year={today.year}&month={today.month}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        summary = response.data['summary']
        self.assertEqual(len(summary), 1)
        self.assertEqual(summary[0]['present'], 1)


class PerformanceReviewTests(APITestCase):
    def setUp(self):
        self.user = _user_with_role('lead', 'MANAGER')
        self.client.force_authenticate(user=self.user)
        self.employee = Employee.objects.create(
            first_name='Kalkidan', last_name='Berhe',
            email='kalkidan.berhe@example.com', date_of_birth=date(1991, 6, 25),
            gender='F', address='Addis Ababa', employee_id='EMP-9501',
            position='UI/UX Designer', salary=84000,
        )
        self.review = PerformanceReview.objects.create(
            employee=self.employee, review_period='2026-Q3',
            productivity=5, quality=4, teamwork=5, communication=4, leadership=3,
        )

    def test_overall_rating_is_average(self):
        self.assertEqual(self.review.overall_rating, 4.2)
        self.assertEqual(self.review.rating_label, 'Exceeds Expectations')

    def test_complete_then_acknowledge(self):
        response = self.client.post(f'/api/performance-reviews/{self.review.id}/complete/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.review.refresh_from_db()
        self.assertEqual(self.review.status, 'COMPLETED')
        self.assertEqual(self.review.reviewer, self.user)

        response = self.client.post(f'/api/performance-reviews/{self.review.id}/acknowledge/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.review.refresh_from_db()
        self.assertEqual(self.review.status, 'ACKNOWLEDGED')

    def test_cannot_acknowledge_draft(self):
        response = self.client.post(f'/api/performance-reviews/{self.review.id}/acknowledge/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_summary_counts_completed_reviews(self):
        self.review.status = 'COMPLETED'
        self.review.save()
        response = self.client.get('/api/performance-reviews/summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_reviews'], 1)
        self.assertEqual(response.data['average_overall_rating'], 4.2)


class RolePermissionTests(APITestCase):
    def setUp(self):
        self.department = Department.objects.create(name='Operations')
        self.admin = _user_with_role('admin_user', 'ADMIN')
        self.manager_employee = Employee.objects.create(
            first_name='Abel', last_name='Kebede',
            email='abel.kebede@example.com', date_of_birth=date(1980, 1, 15),
            gender='M', address='Addis Ababa', employee_id='EMP-9600',
            department=self.department, position='Ops Manager', salary=90000,
        )
        self.manager = _user_with_role('manager_user', 'MANAGER', employee=self.manager_employee)
        self.staff_employee = Employee.objects.create(
            first_name='Sara', last_name='Haile',
            email='sara.haile@example.com', date_of_birth=date(1994, 4, 4),
            gender='F', address='Addis Ababa', employee_id='EMP-9601',
            department=self.department, position='Ops Officer', salary=50000,
            manager=self.manager_employee,
        )
        self.employee = _user_with_role('employee_user', 'EMPLOYEE', employee=self.staff_employee)

    def test_employee_cannot_create_employees(self):
        self.client.force_authenticate(user=self.employee)
        payload = {
            'first_name': 'New', 'last_name': 'Person',
            'email': 'new.person@example.com', 'date_of_birth': '1990-01-01',
            'gender': 'F', 'address': 'Addis Ababa', 'employee_id': 'EMP-9602',
            'position': 'Intern', 'salary': '30000',
        }
        response = self.client.post('/api/employees/', payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_employee_cannot_delete_departments(self):
        self.client.force_authenticate(user=self.employee)
        response = self.client.delete(f'/api/departments/{self.department.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_cannot_approve_unrelated_leave(self):
        other_manager_emp = Employee.objects.create(
            first_name='Tola', last_name='Gudeta',
            email='tola.gudeta@example.com', date_of_birth=date(1982, 8, 8),
            gender='M', address='Addis Ababa', employee_id='EMP-9603',
            position='Team Lead', salary=80000,
        )
        leave = LeaveRequest.objects.create(
            employee=other_manager_emp, leave_type='VL',
            start_date=_days_ago(-1), end_date=_days_ago(-2),
        )
        self.client.force_authenticate(user=self.manager)
        # The unrelated leave is invisible to this manager (queryset scope),
        # so the API correctly answers 404 rather than leaking existence.
        response = self.client.post(f'/api/leaves/{leave.id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_manager_sees_only_own_and_direct_reports_leave(self):
        other_leave = LeaveRequest.objects.create(
            employee=Employee.objects.create(
                first_name='Other', last_name='Team',
                email='other.team@example.com', date_of_birth=date(1990, 1, 1),
                gender='F', address='Addis Ababa', employee_id='EMP-9604',
                position='Analyst', salary=60000,
            ),
            leave_type='SL', start_date=_days_ago(-1), end_date=_days_ago(-1),
        )
        own_leave = LeaveRequest.objects.create(
            employee=self.manager_employee, leave_type='VL',
            start_date=_days_ago(-3), end_date=_days_ago(-4),
        )
        report_leave = LeaveRequest.objects.create(
            employee=self.staff_employee, leave_type='VL',
            start_date=_days_ago(-5), end_date=_days_ago(-6),
        )
        self.client.force_authenticate(user=self.manager)
        response = self.client.get('/api/leaves/')
        ids = {row['id'] for row in response.data['results']}
        self.assertIn(own_leave.id, ids)
        self.assertIn(report_leave.id, ids)
        self.assertNotIn(other_leave.id, ids)

    def test_employee_sees_only_own_leave(self):
        LeaveRequest.objects.create(
            employee=self.manager_employee, leave_type='VL',
            start_date=_days_ago(-3), end_date=_days_ago(-4),
        )
        own_leave = LeaveRequest.objects.create(
            employee=self.staff_employee, leave_type='SL',
            start_date=_days_ago(-1), end_date=_days_ago(-2),
        )
        self.client.force_authenticate(user=self.employee)
        response = self.client.get('/api/leaves/')
        ids = {row['id'] for row in response.data['results']}
        self.assertEqual(ids, {own_leave.id})

    def test_payslip_scoping_for_employee(self):
        Payslip.objects.create(
            employee=self.manager_employee, period_year=2026, period_month=9,
            basic_salary=7500,
        )
        own_slip = Payslip.objects.create(
            employee=self.staff_employee, period_year=2026, period_month=9,
            basic_salary=4166,
        )
        self.client.force_authenticate(user=self.employee)
        response = self.client.get('/api/payslips/')
        ids = {row['id'] for row in response.data['results']}
        self.assertEqual(ids, {own_slip.id})

    def test_me_endpoint_requires_linked_employee(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_me_endpoint_returns_full_profile(self):
        LeaveRequest.objects.create(
            employee=self.staff_employee, leave_type='VL',
            start_date=_days_ago(-1), end_date=_days_ago(-2),
        )
        self.client.force_authenticate(user=self.employee)
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['employee']['id'], self.staff_employee.id)
        self.assertIn('leave_balance', response.data)
        self.assertIn('payslips', response.data)
        self.assertIn('employment_history', response.data)


class LeaveBalanceTests(APITestCase):
    def setUp(self):
        self.admin = _user_with_role('balance_admin', 'ADMIN')
        self.client.force_authenticate(user=self.admin)
        self.employee = Employee.objects.create(
            first_name='Balance', last_name='Tester',
            email='balance.tester@example.com', date_of_birth=date(1990, 6, 1),
            gender='F', address='Addis Ababa', employee_id='EMP-9700',
            position='Coordinator', salary=60000, annual_leave_days=10,
        )

    def test_leave_days_exclude_weekends(self):
        # 2026-01-05 is a Monday; span covers one weekend
        leave = LeaveRequest.objects.create(
            employee=self.employee, leave_type='VL',
            start_date=date(2026, 1, 5), end_date=date(2026, 1, 9),
        )
        self.assertEqual(leave.days_count, 5)
        self.assertEqual(leave.leave_days, 5)

        leave_weekend = LeaveRequest.objects.create(
            employee=self.employee, leave_type='VL',
            start_date=date(2026, 2, 6), end_date=date(2026, 2, 9),  # Fri to Mon
        )
        self.assertEqual(leave_weekend.days_count, 4)
        self.assertEqual(leave_weekend.leave_days, 2)

    def test_leave_days_exclude_holidays(self):
        Holiday.objects.create(name='Company Day', date=date(2026, 1, 6))
        leave = LeaveRequest.objects.create(
            employee=self.employee, leave_type='VL',
            start_date=date(2026, 1, 5), end_date=date(2026, 1, 9),
        )
        self.assertEqual(leave.leave_days, 4)

    def test_approval_rejects_insufficient_balance(self):
        leave = LeaveRequest.objects.create(
            employee=self.employee, leave_type='VL',
            start_date=date(2026, 3, 2), end_date=date(2026, 3, 20),
        )
        self.assertGreater(leave.leave_days, 10)
        response = self.client.post(f'/api/leaves/{leave.id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        leave.refresh_from_db()
        self.assertEqual(leave.status, 'PENDING')

    def test_remaining_balance_after_approval(self):
        leave = LeaveRequest.objects.create(
            employee=self.employee, leave_type='VL',
            start_date=date(2026, 3, 2), end_date=date(2026, 3, 6),
        )
        response = self.client.post(f'/api/leaves/{leave.id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.annual_leave_used(), 5)
        self.assertEqual(self.employee.annual_leave_remaining, 5)


class HolidayAPITests(APITestCase):
    def setUp(self):
        self.admin = _user_with_role('holiday_admin', 'ADMIN')
        self.employee_user = _user_with_role('holiday_employee', 'EMPLOYEE')

    def test_employee_cannot_create_holiday(self):
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post('/api/holidays/', {
            'name': 'Audit Day', 'date': '2026-12-16',
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_creates_and_duplicate_rejected(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/holidays/', {
            'name': 'Founders Day', 'date': '2026-12-16',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        response = self.client.post('/api/holidays/', {
            'name': 'Duplicate Day', 'date': '2026-12-16',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class EmploymentHistoryTests(APITestCase):
    def setUp(self):
        self.admin = _user_with_role('history_admin', 'ADMIN')
        self.client.force_authenticate(user=self.admin)
        self.employee = Employee.objects.create(
            first_name='History', last_name='Maker',
            email='history.maker@example.com', date_of_birth=date(1988, 3, 3),
            gender='M', address='Addis Ababa', employee_id='EMP-9800',
            position='Developer', salary=70000,
        )

    def test_hire_event_seeded_on_api_create(self):
        payload = {
            'first_name': 'Fresh', 'last_name': 'Hire',
            'email': 'fresh.hire@example.com', 'date_of_birth': '1992-02-02',
            'gender': 'F', 'address': 'Addis Ababa', 'employee_id': 'EMP-9801',
            'position': 'Analyst', 'salary': '62000',
        }
        response = self.client.post('/api/employees/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            EmploymentEvent.objects.filter(
                employee_id=response.data['id'], event_type='HIRED'
            ).exists()
        )

    def test_promotion_and_salary_events_recorded(self):
        response = self.client.patch(
            f'/api/employees/{self.employee.id}/',
            {'position': 'Senior Developer', 'salary': '85000'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        types = set(
            EmploymentEvent.objects.filter(employee=self.employee)
            .values_list('event_type', flat=True)
        )
        self.assertIn('PROMOTION', types)
        self.assertIn('SALARY_CHANGE', types)

    def test_exit_event_on_soft_delete(self):
        response = self.client.delete(f'/api/employees/{self.employee.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(
            EmploymentEvent.objects.filter(
                employee=self.employee, event_type='EXIT'
            ).exists()
        )


class NotificationFlowTests(APITestCase):
    def setUp(self):
        self.manager_employee = Employee.objects.create(
            first_name='Notif', last_name='Manager',
            email='notif.manager@example.com', date_of_birth=date(1979, 9, 9),
            gender='F', address='Addis Ababa', employee_id='EMP-9900',
            position='Director', salary=120000,
        )
        self.manager = _user_with_role('notif_manager', 'MANAGER', employee=self.manager_employee)
        self.staff_employee = Employee.objects.create(
            first_name='Notif', last_name='Staff',
            email='notif.staff@example.com', date_of_birth=date(1995, 5, 5),
            gender='F', address='Addis Ababa', employee_id='EMP-9901',
            position='Associate', salary=45000,
            manager=self.manager_employee,
        )
        self.staff = _user_with_role('notif_staff', 'EMPLOYEE', employee=self.staff_employee)

    def test_leave_submission_notifies_manager(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post('/api/leaves/', {
            'leave_type': 'VL',
            'start_date': str(_days_ago(-3)),
            'end_date': str(_days_ago(-5)),
        })
        self.assertIn(response.status_code, {status.HTTP_201_CREATED, status.HTTP_200_OK})
        self.assertTrue(
            Notification.objects.filter(recipient=self.manager).exists()
        )

    def test_leave_decision_notifies_employee(self):
        leave = LeaveRequest.objects.create(
            employee=self.staff_employee, leave_type='VL',
            start_date=_days_ago(-1), end_date=_days_ago(-2),
        )
        self.client.force_authenticate(user=self.manager)
        self.client.post(f'/api/leaves/{leave.id}/approve/')
        self.assertTrue(
            Notification.objects.filter(recipient=self.staff).exists()
        )

    def test_unread_count_and_mark_all_read(self):
        Notification.objects.create(recipient=self.staff, verb='Hello')
        Notification.objects.create(recipient=self.staff, verb='Again')
        self.client.force_authenticate(user=self.staff)
        response = self.client.get('/api/notifications/unread_count/')
        self.assertEqual(response.data['unread'], 2)
        response = self.client.post('/api/notifications/mark_all_read/')
        self.assertEqual(response.data['marked'], 2)
        response = self.client.get('/api/notifications/unread_count/')
        self.assertEqual(response.data['unread'], 0)
