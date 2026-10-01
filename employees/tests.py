from datetime import date, time, timedelta

from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status

from .models import (
    AttendanceRecord,
    Department,
    Employee,
    LeaveRequest,
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
