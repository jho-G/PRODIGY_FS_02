"""
Management command to populate the database with realistic mock employee data.

Usage:
    python manage.py seed_employees             # seeds if DB is empty
    python manage.py seed_employees --force     # wipes and reseeds
    python manage.py seed_employees --count 60  # custom employee count
"""
import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from employees.models import Department, Employee, LeaveRequest


FIRST_NAMES = [
    'Abebe', 'Kebede', 'Selam', 'Hanna', 'Yonas', 'Meron', 'Dawit', 'Tsion',
    'Samuel', 'Liya', 'Nahom', 'Bethlehem', 'Kalkidan', 'Eyob', 'Marta',
    'Robel', 'Mahlet', 'Fikru', 'Genet', 'Tewodros', 'Amanuel', 'Rahel',
    'Bereket', 'Lidya', 'Solomon', 'Helen', 'Mussie', 'Sara', 'Naol', 'Eden',
    'James', 'Maria', 'Chen', 'Priya', 'Ahmed', 'Fatima', 'John', 'Aisha',
    'Michael', 'Grace', 'Daniel', 'Lucy', 'Omar', 'Nadia', 'Peter', 'Ruth',
]

LAST_NAMES = [
    'Bekele', 'Haile', 'Tesfaye', 'Girma', 'Assefa', 'Mengistu', 'Alemu',
    'Desta', 'Negash', 'Tadesse', 'Getachew', 'Abebe', 'Wolde', 'Kebede',
    'Mulugeta', 'Worku', 'Berhe', 'Gebre', 'Smith', 'Johnson', 'Wang',
    'Patel', 'Hassan', 'Kim', 'Okafor', 'Silva', 'Nguyen', 'Garcia', 'Brown',
    'Miller', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas',
]

# position -> (base annual salary range, typical prior experience range)
POSITIONS = [
    ('Software Engineer', (70000, 120000), (1, 10)),
    ('Senior Software Engineer', (110000, 160000), (5, 15)),
    ('DevOps Engineer', (85000, 135000), (3, 12)),
    ('Data Analyst', (60000, 95000), (1, 8)),
    ('QA Engineer', (55000, 90000), (1, 8)),
    ('Product Manager', (95000, 150000), (4, 14)),
    ('UI/UX Designer', (60000, 100000), (1, 10)),
    ('HR Officer', (45000, 70000), (1, 10)),
    ('HR Manager', (70000, 105000), (5, 15)),
    ('Accountant', (50000, 85000), (2, 12)),
    ('Financial Analyst', (65000, 100000), (2, 10)),
    ('Sales Representative', (40000, 75000), (0, 8)),
    ('Sales Manager', (80000, 125000), (5, 15)),
    ('Marketing Specialist', (50000, 85000), (1, 8)),
    ('Customer Support Agent', (35000, 55000), (0, 6)),
    ('Operations Coordinator', (45000, 75000), (1, 8)),
    ('Administrative Assistant', (32000, 50000), (0, 8)),
    ('Intern', (18000, 26000), (0, 0)),
]

DEPARTMENTS = [
    ('Engineering', 'Software development, architecture, and infrastructure.'),
    ('Human Resources', 'Recruitment, employee relations, and organizational culture.'),
    ('Finance', 'Accounting, budgeting, payroll, and financial planning.'),
    ('Sales', 'Client acquisition, account management, and revenue growth.'),
    ('Marketing', 'Brand strategy, campaigns, and market research.'),
    ('Customer Service', 'Customer support, success, and issue resolution.'),
    ('Operations', 'Facilities, logistics, and internal process coordination.'),
]

GENDERS = ['M', 'F', 'O']
GENDER_WEIGHTS = [45, 45, 10]
STATUS_WEIGHTS = [75, 10, 10, 5]  # FT, PT, CT, IN


class Command(BaseCommand):
    help = 'Seeds the database with mock departments, employees, and leave requests.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count', type=int, default=40,
            help='Number of employees to create (default: 40).',
        )
        parser.add_argument(
            '--force', action='store_true',
            help='Delete existing employees/departments/leaves before seeding.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        count = max(1, options['count'])
        force = options['force']

        if force:
            LeaveRequest.objects.all().delete()
            Employee.objects.all().delete()
            Department.objects.all().delete()
            self.stdout.write(self.style.WARNING('Existing data wiped (--force).'))

        if Employee.objects.exists() and not force:
            self.stdout.write(self.style.NOTICE(
                'Database already has employees. Use --force to reseed.'
            ))
            return

        # --- Departments -------------------------------------------------
        departments = {}
        for name, desc in DEPARTMENTS:
            dept, _ = Department.objects.get_or_create(
                name=name, defaults={'description': desc}
            )
            departments[name] = dept

        # --- Employees ----------------------------------------------------
        used_emails = set()
        used_employee_ids = set()
        employees = []
        hire_offsets = []

        # Grab an admin user for created_by attribution when available
        from django.contrib.auth.models import User
        admin_user = User.objects.filter(is_superuser=True).first()

        # Everyone gets a hire date; on first run hire_date is auto_now_add,
        # so we create then update hire dates in a second pass.
        for i in range(count):
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)

            # Unique email
            base_email = f'{first}.{last}'.lower()
            email = f'{base_email}@company.com'
            suffix = 1
            while email in used_emails:
                email = f'{base_email}{suffix}@company.com'
                suffix += 1
            used_emails.add(email)

            # Unique employee id (EMP-1001, EMP-1002, ...)
            emp_num = 1001 + i
            while f'EMP-{emp_num}' in used_employee_ids:
                emp_num += 1
            employee_id = f'EMP-{emp_num}'
            used_employee_ids.add(employee_id)

            position, (sal_lo, sal_hi), (exp_lo, exp_hi) = random.choice(POSITIONS)

            # Interns always intern status; others weighted
            if position == 'Intern':
                employment_status = 'IN'
            else:
                employment_status = random.choices(
                    ['FT', 'PT', 'CT', 'IN'], weights=STATUS_WEIGHTS
                )[0]

            annual_salary = random.randint(sal_lo, sal_hi)
            monthly_salary = round(annual_salary / 12, 2)
            prior_experience = random.randint(exp_lo, exp_hi)

            dob_year = random.randint(1965, 2003)
            date_of_birth = date(dob_year, random.randint(1, 12), random.randint(1, 28))

            # Compute once so service years stay consistent with prior experience
            hire_years_ago = random.randint(0, min(12, max(1, prior_experience + 1)))
            hire_offsets.append(365 * hire_years_ago + random.randint(0, 300))

            employees.append(Employee(
                employee_id=employee_id,
                first_name=first,
                last_name=last,
                email=email,
                phone_number=f'+2519{random.randint(10000000, 99999999)}',
                date_of_birth=date_of_birth,
                gender=random.choices(GENDERS, weights=GENDER_WEIGHTS)[0],
                address=f'{random.randint(1, 500)} {random.choice(["Main St", "Bole Rd", "Ringo Rd", "Summit", "CMC", "Gerji", "Piazza", "Kality"])} Ave, Addis Ababa',
                emergency_contact_name=f'{random.choice(FIRST_NAMES)} {last}',
                emergency_contact_phone=f'+2519{random.randint(10000000, 99999999)}',
                emergency_contact_relation=random.choice(
                    ['Spouse', 'Parent', 'Sibling', 'Friend', 'Guardian']
                ),
                department=random.choice(list(departments.values())),
                position=position,
                employment_status=employment_status,
                salary=annual_salary,
                salary_monthly=monthly_salary,
                currency='USD',
                bank_account=f'BANK{random.randint(1000000000, 9999999999)}',
                total_experience_years=prior_experience,
                annual_leave_days=random.choice([20, 22, 25, 30]),
                created_by=admin_user,
            ))

        Employee.objects.bulk_create(employees, batch_size=50)

        # Second pass: set explicit hire dates (auto_now_add overrode them).
        # Reuse the offsets captured at creation so experience math stays consistent.
        for emp, offset in zip(employees, hire_offsets):
            emp.hire_date = date.today() - timedelta(days=offset)
        Employee.objects.bulk_update(employees, ['hire_date'], batch_size=50)

        # --- Leave requests -----------------------------------------------
        statuses = ['PENDING'] * 6 + ['APPROVED'] * 5 + ['REJECTED'] * 2 + ['CANCELLED'] * 2
        leave_requests = []
        for emp in random.sample(employees, k=min(15, len(employees))):
            start_offset = random.randint(-60, 45)
            start = date.today() + timedelta(days=start_offset)
            end = start + timedelta(days=random.randint(1, 10))
            leave_requests.append(LeaveRequest(
                employee=emp,
                leave_type=random.choice(['VL', 'SL', 'PL', 'ML', 'UL']),
                start_date=start,
                end_date=end,
                reason=random.choice([
                    'Annual family vacation.', 'Medical appointment.',
                    'Personal matters.', 'Family event abroad.',
                    'Recovering from illness.', 'Wedding ceremony.',
                ]),
                status=random.choice(statuses),
            ))
        LeaveRequest.objects.bulk_create(leave_requests, batch_size=50)

        # Mark some approved leaves with reviewer info
        admin = admin_user
        LeaveRequest.objects.filter(status__in=['APPROVED', 'REJECTED']).update(
            reviewed_by=admin
        )

        self.stdout.write(self.style.SUCCESS(
            f'Seeded {len(departments)} departments, {len(employees)} employees, '
            f'and {len(leave_requests)} leave requests.'
        ))
