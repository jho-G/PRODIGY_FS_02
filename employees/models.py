from django.db import models
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator, EmailValidator
from django.contrib.auth.models import User
from datetime import date, datetime, time as datetime_time, timedelta
from decimal import Decimal


def _years_between(start, end):
    """Whole years elapsed between two dates (age-style calculation)."""
    if start is None or end is None or end < start:
        return 0
    return end.year - start.year - ((end.month, end.day) < (start.month, start.day))


class UserProfile(models.Model):
    """
    Role-based access control profile attached to each Django user.
    Links the login account to the Employee record for self-service.
    """

    ROLE_CHOICES = [
        ('ADMIN', 'Administrator'),
        ('HR', 'HR'),
        ('MANAGER', 'Manager'),
        ('EMPLOYEE', 'Employee'),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='profile'
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='EMPLOYEE')
    employee = models.OneToOneField(
        'Employee',
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='user_account',
        help_text="Employee record belonging to this login (for self-service).",
    )
    phone_number = models.CharField(max_length=17, blank=True)

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"


class Department(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class Employee(models.Model):
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]
    
    EMPLOYMENT_STATUS = [
        ('FT', 'Full-time'),
        ('PT', 'Part-time'),
        ('CT', 'Contract'),
        ('IN', 'Intern'),
    ]
    
    # Personal Information
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    email = models.EmailField(unique=True, validators=[EmailValidator()])
    phone_regex = RegexValidator(regex=r'^\+?1?\d{9,15}$', message="Phone number must be entered in format: '+999999999'. Up to 15 digits allowed.")
    phone_number = models.CharField(validators=[phone_regex], max_length=17, blank=True)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    address = models.TextField()

    # Emergency contact
    emergency_contact_name = models.CharField(max_length=100, blank=True)
    emergency_contact_phone = models.CharField(
        validators=[phone_regex], max_length=17, blank=True,
        help_text="Phone number of the emergency contact.",
    )
    emergency_contact_relation = models.CharField(
        max_length=50, blank=True,
        help_text="Relationship to the employee, e.g. Spouse, Parent, Sibling.",
    )
    
    # Employment Details
    employee_id = models.CharField(max_length=20, unique=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True)
    manager = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='direct_reports',
        help_text="Direct supervisor responsible for approving this employee's leave.",
    )
    position = models.CharField(max_length=100)
    hire_date = models.DateField(auto_now_add=True)
    employment_status = models.CharField(max_length=2, choices=EMPLOYMENT_STATUS, default='FT')
    salary = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)], help_text="Annual gross salary")

    # Compensation details
    salary_monthly = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        validators=[MinValueValidator(0)],
        help_text="Monthly salary (auto-derived from annual salary if not provided)",
    )
    bank_account = models.CharField(max_length=34, blank=True)
    currency = models.CharField(max_length=3, default='USD')

    # Experience
    total_experience_years = models.PositiveIntegerField(
        default=0, validators=[MaxValueValidator(60)],
        help_text="Prior work experience at time of hire (years)",
    )

    # Leave entitlement
    annual_leave_days = models.PositiveIntegerField(default=20)

    # System Fields
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    def save(self, *args, **kwargs):
        # Keep the denormalized monthly salary in sync with the annual salary
        if self.salary and (not self.salary_monthly or self.salary_monthly == 0):
            # Coerce to Decimal first: salary may arrive as float/int from JSON
            annual = self.salary if isinstance(self.salary, Decimal) else Decimal(str(self.salary))
            self.salary_monthly = (annual / 12).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee_id} - {self.first_name} {self.last_name}"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def age(self):
        today = date.today()
        return today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))

    @property
    def years_of_service(self):
        """Years worked at the company, derived from hire_date."""
        return _years_between(self.hire_date, date.today())

    @property
    def effective_experience_years(self):
        """Prior experience at hire plus years served in the company."""
        return self.total_experience_years + self.years_of_service


def working_days_between(start_date, end_date, holiday_dates=None):
    """
    Count inclusive working days between two dates, skipping weekends
    (Sat/Sun) and any provided company holiday dates.
    """
    if start_date is None or end_date is None or end_date < start_date:
        return 0
    holidays = set(holiday_dates or [])
    days = 0
    current = start_date
    while current <= end_date:
        if current.weekday() < 5 and current not in holidays:
            days += 1
        current += timedelta(days=1)
    return days


class LeaveRequest(models.Model):
    """
    Employee leave/vacation requests with manager approval workflow.
    """

    LEAVE_TYPES = [
        ('VL', 'Vacation'),
        ('SL', 'Sick'),
        ('PL', 'Personal'),
        ('ML', 'Maternity/Paternity'),
        ('UL', 'Unpaid'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='leave_requests'
    )
    leave_type = models.CharField(max_length=2, choices=LEAVE_TYPES, default='VL')
    start_date = models.DateField()
    end_date = models.DateField()
    # Stored raw calendar-span days; leave_days holds the working-day count
    days_count = models.PositiveIntegerField(editable=False, default=0)
    leave_days = models.PositiveIntegerField(editable=False, default=0)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_leave_requests'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        # Calendar-span days and working-day count (excludes weekends and
        # company holidays falling inside the range)
        if self.start_date and self.end_date and self.end_date >= self.start_date:
            delta = self.end_date - self.start_date
            self.days_count = delta.days + 1
            self.leave_days = working_days_between(
                self.start_date, self.end_date,
                holiday_dates=Holiday.objects.filter(
                    date__gte=self.start_date, date__lte=self.end_date
                ).values_list('date', flat=True),
            )
        else:
            self.days_count = 0
            self.leave_days = 0
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee} - {self.get_leave_type_display()} ({self.status})"

    @property
    def is_active_leave(self):
        today = date.today()
        return (
            self.status == 'APPROVED'
            and self.start_date <= today <= self.end_date
        )


class AttendanceRecord(models.Model):
    """
    Daily attendance log per employee with check-in/check-out times.
    """

    STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('LATE', 'Late'),
        ('ABSENT', 'Absent'),
        ('LEAVE', 'On Leave'),
        ('REMOTE', 'Remote'),
    ]

    LATE_CUTOFF = datetime_time(9, 0)  # arrivals after 09:00 count as late

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='attendance_records'
    )
    date = models.DateField(default=date.today)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PRESENT')
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        unique_together = ('employee', 'date')

    def save(self, *args, **kwargs):
        # Auto-flag late arrivals when a check-in exists but no explicit status
        if (
            self.check_in
            and self.status == 'PRESENT'
            and self.check_in > self.LATE_CUTOFF
        ):
            self.status = 'LATE'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee} - {self.date} ({self.status})"

    @property
    def work_hours(self):
        """Hours worked as a float, from check-in/check-out (None if incomplete)."""
        if not self.check_in or not self.check_out:
            return None
        delta = (
            datetime.combine(date.min, self.check_out)
            - datetime.combine(date.min, self.check_in)
        )
        return round(max(delta.total_seconds() / 3600, 0), 2)


class Payslip(models.Model):
    """
    Monthly payroll record for an employee. Amounts are stored so historical
    payslips stay stable even if the employee's salary changes later.
    """

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='payslips'
    )
    period_year = models.PositiveIntegerField()
    period_month = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])

    basic_salary = models.DecimalField(max_digits=10, decimal_places=2)
    allowances = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)],
        help_text="Transport, housing, and other allowances",
    )
    bonus = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)],
    )
    tax_deduction = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)],
    )
    other_deductions = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)],
        help_text="Loans, advances, and other deductions",
    )
    net_pay = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)],
        help_text="Gross (basic + allowances + bonus) minus deductions",
    )
    currency = models.CharField(max_length=3, default='USD')
    notes = models.CharField(max_length=255, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-period_year', '-period_month']
        unique_together = ('employee', 'period_year', 'period_month')

    def save(self, *args, **kwargs):
        # Derive net pay server-side so clients can't send inconsistent totals.
        # Coerce to Decimal first: in-memory attrs may hold raw ints/floats,
        # which would leave net_pay as an int and lose cent-level precision.
        def _dec(value):
            return value if isinstance(value, Decimal) else Decimal(str(value or 0))
        gross = _dec(self.basic_salary) + _dec(self.allowances) + _dec(self.bonus)
        deductions = _dec(self.tax_deduction) + _dec(self.other_deductions)
        self.net_pay = (gross - deductions).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee} - {self.period_year}-{self.period_month:02d}"

    @property
    def gross_pay(self):
        return (self.basic_salary or 0) + (self.allowances or 0) + (self.bonus or 0)

    @property
    def total_deductions(self):
        return (self.tax_deduction or 0) + (self.other_deductions or 0)

    @property
    def period_label(self):
        import calendar
        return f"{calendar.month_name[self.period_month]} {self.period_year}"


class PerformanceReview(models.Model):
    """
    Periodic performance evaluation with weighted competency scores.
    Overall rating is the average of the individual competency scores.
    """

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('COMPLETED', 'Completed'),
        ('ACKNOWLEDGED', 'Acknowledged by employee'),
    ]

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='performance_reviews'
    )
    reviewer = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='conducted_performance_reviews',
    )
    review_period = models.CharField(
        max_length=20,
        help_text="e.g. '2026-Q1' or '2026 Annual'",
    )
    review_date = models.DateField(default=date.today)

    # Competency scores (1-5)
    productivity = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], default=3,
    )
    quality = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], default=3,
    )
    teamwork = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], default=3,
    )
    communication = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], default=3,
    )
    leadership = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], default=3,
    )

    strengths = models.TextField(blank=True)
    areas_for_improvement = models.TextField(blank=True)
    goals = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='DRAFT')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-review_date']

    def __str__(self):
        return f"{self.employee} - {self.review_period}"

    @property
    def overall_rating(self):
        scores = [
            self.productivity, self.quality, self.teamwork,
            self.communication, self.leadership,
        ]
        return round(sum(scores) / len(scores), 1)

    @property
    def rating_label(self):
        rating = self.overall_rating
        if rating >= 4.5:
            return 'Outstanding'
        if rating >= 3.5:
            return 'Exceeds Expectations'
        if rating >= 2.5:
            return 'Meets Expectations'
        if rating >= 1.5:
            return 'Needs Improvement'
        return 'Unsatisfactory'


class Holiday(models.Model):
    """
    Company-wide holiday. Working-day calculations (leave duration,
    attendance expectations) skip these dates.
    """

    name = models.CharField(max_length=100)
    date = models.DateField(unique=True)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f"{self.name} ({self.date})"


class EmploymentEvent(models.Model):
    """
    Timeline entry for employment changes: hires, promotions, department
    transfers, salary revisions, and exits. Snapshot fields preserve the
    state at the time of the change.
    """

    EVENT_TYPES = [
        ('HIRED', 'Hired'),
        ('PROMOTION', 'Promotion'),
        ('TRANSFER', 'Department Transfer'),
        ('SALARY_CHANGE', 'Salary Change'),
        ('ROLE_CHANGE', 'Employment Status Change'),
        ('EXIT', 'Exit'),
    ]

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='employment_events'
    )
    event_type = models.CharField(max_length=15, choices=EVENT_TYPES)
    effective_date = models.DateField(default=date.today)
    notes = models.CharField(max_length=255, blank=True)

    # Snapshots of the state relevant to the event
    previous_department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )
    new_department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )
    previous_position = models.CharField(max_length=100, blank=True)
    new_position = models.CharField(max_length=100, blank=True)
    previous_salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    new_salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='employment_events_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-effective_date', '-created_at']

    def __str__(self):
        return f"{self.employee} - {self.get_event_type_display()} ({self.effective_date})"


def _document_upload_path(instance, filename):
    return f'documents/employee_{instance.employee_id}/{filename}'


class EmployeeDocument(models.Model):
    """
    File attached to an employee: contract, ID copy, certificate, etc.
    """

    CATEGORY_CHOICES = [
        ('CONTRACT', 'Contract'),
        ('ID', 'ID Document'),
        ('CERTIFICATE', 'Certificate'),
        ('EVALUATION', 'Evaluation'),
        ('OTHER', 'Other'),
    ]

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='documents'
    )
    document_type = models.CharField(max_length=15, choices=CATEGORY_CHOICES, default='OTHER')
    title = models.CharField(max_length=100)
    file = models.FileField(upload_to=_document_upload_path, max_length=300)
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='documents_uploaded',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.employee} - {self.title}"


class Notification(models.Model):
    """
    In-app notification delivered to a user. Generated by system events
    (leave decisions, payslip generation, review assignments...).
    """

    recipient = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='notifications'
    )
    verb = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    link = models.CharField(
        max_length=200, blank=True,
        help_text="Frontend route to open when the notification is clicked.",
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.recipient.username}: {self.verb}"