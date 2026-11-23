from datetime import date, datetime, timedelta
from datetime import time as datetime_time
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.validators import (
    EmailValidator,
    MaxValueValidator,
    MinValueValidator,
    RegexValidator,
)
from django.db import models


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
        ("ADMIN", "Administrator"),
        ("HR", "HR"),
        ("MANAGER", "Manager"),
        ("EMPLOYEE", "Employee"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="EMPLOYEE")
    employee = models.OneToOneField(
        "Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_account",
        help_text="Employee record belonging to this login (for self-service).",
    )
    phone_number = models.CharField(max_length=17, blank=True)
    calendar_token = models.CharField(
        max_length=64,
        unique=True,
        blank=True,
        null=True,
        help_text="Secure feed token for personal calendar synchronization (.ics).",
    )

    def get_or_create_calendar_token(self):
        """Return existing calendar token or generate a new cryptographically secure token."""
        if not self.calendar_token:
            import secrets

            self.calendar_token = secrets.token_urlsafe(32)
            self.save(update_fields=["calendar_token"])
        return self.calendar_token

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"


class Department(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Employee(models.Model):
    GENDER_CHOICES = [
        ("M", "Male"),
        ("F", "Female"),
        ("O", "Other"),
    ]

    EMPLOYMENT_STATUS = [
        ("FT", "Full-time"),
        ("PT", "Part-time"),
        ("CT", "Contract"),
        ("IN", "Intern"),
    ]

    # Personal Information
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    email = models.EmailField(unique=True, validators=[EmailValidator()])
    phone_regex = RegexValidator(
        regex=r"^\+?1?\d{9,15}$",
        message="Phone number must be entered in format: '+999999999'. Up to 15 digits allowed.",
    )
    phone_number = models.CharField(validators=[phone_regex], max_length=17, blank=True)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    address = models.TextField()

    # Emergency contact
    emergency_contact_name = models.CharField(max_length=100, blank=True)
    emergency_contact_phone = models.CharField(
        validators=[phone_regex],
        max_length=17,
        blank=True,
        help_text="Phone number of the emergency contact.",
    )
    emergency_contact_relation = models.CharField(
        max_length=50,
        blank=True,
        help_text="Relationship to the employee, e.g. Spouse, Parent, Sibling.",
    )

    # Employment Details
    employee_id = models.CharField(max_length=20, unique=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True)
    manager = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="direct_reports",
        help_text="Direct supervisor responsible for approving this employee's leave.",
    )
    position = models.CharField(max_length=100)
    hire_date = models.DateField(default=date.today)
    employment_status = models.CharField(
        max_length=2, choices=EMPLOYMENT_STATUS, default="FT"
    )
    salary = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Annual gross salary",
    )

    # Compensation details
    salary_monthly = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Monthly salary (auto-derived from annual salary if not provided)",
    )
    bank_account = models.CharField(max_length=34, blank=True)
    currency = models.CharField(max_length=3, default="USD")

    # Experience
    total_experience_years = models.PositiveIntegerField(
        default=0,
        validators=[MaxValueValidator(60)],
        help_text="Prior work experience at time of hire (years)",
    )

    # Leave entitlement
    annual_leave_days = models.PositiveIntegerField(default=20)
    comp_off_days = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Accumulated compensatory leave days earned from approved overtime",
    )

    # System Fields
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        # Always keep the denormalized monthly salary in sync with the annual salary
        if self.salary:
            # Coerce to Decimal first: salary may arrive as float/int from JSON
            annual = (
                self.salary
                if isinstance(self.salary, Decimal)
                else Decimal(str(self.salary))
            )
            self.salary_monthly = (annual / 12).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee_id} - {self.first_name} {self.last_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def age(self):
        today = date.today()
        return (
            today.year
            - self.date_of_birth.year
            - (
                (today.month, today.day)
                < (self.date_of_birth.month, self.date_of_birth.day)
            )
        )

    @property
    def years_of_service(self):
        """Years worked at the company, derived from hire_date."""
        return _years_between(self.hire_date, date.today())

    @property
    def effective_experience_years(self):
        """Prior experience at hire plus years served in the company."""
        return self.total_experience_years + self.years_of_service

    def annual_leave_used(self, year=None):
        """Working days of approved vacation leave taken in the given year."""
        year = year or date.today().year
        return sum(
            LeaveRequest.objects.filter(
                employee=self,
                leave_type="VL",
                status="APPROVED",
                start_date__year=year,
            ).values_list("leave_days", flat=True)
        )

    @property
    def annual_leave_remaining(self):
        """Entitlement minus approved vacation days for the current year."""
        return max(self.annual_leave_days - self.annual_leave_used(), 0)

    @property
    def user(self):
        """User account linked to this employee via UserProfile (if any)."""
        account = getattr(self, "user_account", None)
        return account.user if account else None


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
        ("VL", "Vacation"),
        ("SL", "Sick"),
        ("PL", "Personal"),
        ("ML", "Maternity/Paternity"),
        ("UL", "Unpaid"),
        ("CO", "Compensatory Off"),
    ]

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
        ("CANCELLED", "Cancelled"),
    ]

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="leave_requests"
    )
    leave_type = models.CharField(max_length=2, choices=LEAVE_TYPES, default="VL")
    start_date = models.DateField()
    end_date = models.DateField()
    # Stored raw calendar-span days; leave_days holds the working-day count
    days_count = models.PositiveIntegerField(editable=False, default=0)
    leave_days = models.PositiveIntegerField(editable=False, default=0)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="PENDING")
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_leave_requests",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        # Calendar-span days and working-day count (excludes weekends and
        # company holidays falling inside the range)
        if self.start_date and self.end_date and self.end_date >= self.start_date:
            delta = self.end_date - self.start_date
            self.days_count = delta.days + 1
            self.leave_days = working_days_between(
                self.start_date,
                self.end_date,
                holiday_dates=Holiday.objects.filter(
                    date__gte=self.start_date, date__lte=self.end_date
                ).values_list("date", flat=True),
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
        return self.status == "APPROVED" and self.start_date <= today <= self.end_date


class Shift(models.Model):
    """
    Work shift schedule definitions with configurable start/end times and grace periods.
    """

    name = models.CharField(max_length=64, unique=True)
    code = models.CharField(max_length=20, unique=True, blank=True)
    start_time = models.TimeField(default=datetime_time(9, 0))
    end_time = models.TimeField(default=datetime_time(17, 0))
    grace_period_minutes = models.PositiveIntegerField(
        default=15,
        help_text="Grace window in minutes before punch-in is flagged as LATE",
    )
    department = models.ForeignKey(
        "Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shifts",
        help_text="Department restriction; leave blank for company-wide shift",
    )
    is_default = models.BooleanField(
        default=False,
        help_text="Default shift applied when no specific assignment exists",
    )
    color = models.CharField(
        max_length=20,
        default="#000000",
        help_text="Hex badge color (e.g. #000000 or #555555)",
    )
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start_time", "name"]

    def __str__(self):
        return f"{self.name} ({self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')})"

    def save(self, *args, **kwargs):
        if not self.code and self.name:
            import re

            self.code = re.sub(r"[^A-Za-z0-9]+", "_", self.name).upper()[:20]
        super().save(*args, **kwargs)

    def get_late_cutoff(self):
        """Returns the latest time (datetime.time) an employee can check in without being LATE."""
        dummy_dt = datetime.combine(date.today(), self.start_time) + timedelta(
            minutes=self.grace_period_minutes
        )
        return dummy_dt.time()


class ShiftAssignment(models.Model):
    """
    Assigns an employee to a specific recurring or seasonal work shift.
    """

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="shift_assignments"
    )
    shift = models.ForeignKey(
        Shift, on_delete=models.CASCADE, related_name="assignments"
    )
    start_date = models.DateField(default=date.today)
    end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Null for ongoing or indefinite shift assignments",
    )
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.employee} -> {self.shift} ({self.start_date} to {self.end_date or 'Indefinite'})"


class OfficeLocation(models.Model):
    """
    Registered office premises coordinates and allowed IP subnets for geofenced clock-in.
    """

    name = models.CharField(max_length=100, unique=True)
    address = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    radius_meters = models.PositiveIntegerField(
        default=200,
        help_text="Allowable radius in meters around the office coordinates",
    )
    allowed_ip_ranges = models.TextField(
        blank=True,
        help_text="Comma-separated IP addresses or CIDR blocks (e.g. 192.168.1.0/24, 10.0.0.1)",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.radius_meters}m radius)"


class AttendanceRecord(models.Model):
    """
    Daily attendance log per employee with check-in/check-out times,
    assigned shift, and geofence verification tracking.
    """

    STATUS_CHOICES = [
        ("PRESENT", "Present"),
        ("LATE", "Late"),
        ("ABSENT", "Absent"),
        ("LEAVE", "On Leave"),
        ("REMOTE", "Remote"),
    ]

    LATE_CUTOFF = datetime_time(9, 0)  # standard fallback when no shift is assigned

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="attendance_records"
    )
    shift = models.ForeignKey(
        Shift,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records",
    )
    date = models.DateField(default=date.today)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="PRESENT")
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    punch_in_latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    punch_in_longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    punch_in_ip = models.GenericIPAddressField(null=True, blank=True)
    is_geofence_verified = models.BooleanField(default=False)
    is_flagged = models.BooleanField(default=False)
    flag_reason = models.CharField(max_length=255, blank=True)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]
        unique_together = ("employee", "date")

    def save(self, *args, **kwargs):
        # Resolve active shift for employee if not explicitly bound
        if not self.shift_id and self.employee_id:
            assignment = (
                ShiftAssignment.objects.filter(
                    employee_id=self.employee_id,
                    is_active=True,
                    start_date__lte=self.date,
                )
                .filter(
                    models.Q(end_date__isnull=True) | models.Q(end_date__gte=self.date)
                )
                .order_by("-start_date")
                .first()
            )
            if assignment:
                self.shift = assignment.shift
            else:
                emp = getattr(self, "employee", None)
                dept = emp.department if emp else None
                default_shift = (
                    Shift.objects.filter(department=dept, is_default=True).first()
                    if dept
                    else None
                ) or Shift.objects.filter(
                    department__isnull=True, is_default=True
                ).first()
                if default_shift:
                    self.shift = default_shift

        # Auto-flag late arrivals based on shift schedule (or standard 09:00 LATE_CUTOFF)
        if self.check_in and self.status == "PRESENT":
            cutoff = self.shift.get_late_cutoff() if self.shift else self.LATE_CUTOFF
            if self.check_in > cutoff:
                self.status = "LATE"

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee} - {self.date} ({self.status})"

    @property
    def work_hours(self):
        """Hours worked as a float, from check-in/check-out (None if incomplete)."""
        if not self.check_in or not self.check_out:
            return None
        delta = datetime.combine(date.min, self.check_out) - datetime.combine(
            date.min, self.check_in
        )
        return round(max(delta.total_seconds() / 3600, 0), 2)


class OvertimeRecord(models.Model):
    """
    Overtime hours logged past regular shift with manager approval and payout/comp-off resolution.
    """

    COMPENSATION_CHOICES = [
        ("PAYOUT", "Payroll Payout"),
        ("COMP_OFF", "Compensatory Leave"),
    ]
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    ]

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="overtime_records"
    )
    attendance_record = models.ForeignKey(
        AttendanceRecord,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="overtime_records",
    )
    date = models.DateField(default=date.today)
    hours = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.25")),
            MaxValueValidator(Decimal("24.00")),
        ],
    )
    rate_multiplier = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=Decimal("1.50"),
        help_text="Standard overtime multiplier (e.g. 1.5x or 2.0x for holidays)",
    )
    compensation_type = models.CharField(
        max_length=10,
        choices=COMPENSATION_CHOICES,
        default="PAYOUT",
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="PENDING",
    )
    reason = models.TextField(blank=True)
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_overtime_records",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    is_processed = models.BooleanField(
        default=False,
        help_text="True when paid out in payslip or credited to comp-off leave balance",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.employee} - {self.date} ({self.hours} hrs, {self.status})"


class Payslip(models.Model):
    """
    Monthly payroll record for an employee. Amounts are stored so historical
    payslips stay stable even if the employee's salary changes later.
    """

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="payslips"
    )
    period_year = models.PositiveIntegerField()
    period_month = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )

    basic_salary = models.DecimalField(max_digits=10, decimal_places=2)
    allowances = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Transport, housing, and other allowances",
    )
    bonus = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    overtime_pay = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0)],
        help_text="Calculated overtime pay from approved overtime records",
    )
    tax_deduction = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    other_deductions = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Loans, advances, and other deductions",
    )
    net_pay = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Gross (basic + allowances + bonus + overtime) minus deductions",
    )
    currency = models.CharField(max_length=3, default="USD")
    notes = models.CharField(max_length=255, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-period_year", "-period_month"]
        unique_together = ("employee", "period_year", "period_month")

    def save(self, *args, **kwargs):
        # Derive net pay server-side so clients can't send inconsistent totals.
        def _dec(value):
            return value if isinstance(value, Decimal) else Decimal(str(value or 0))

        gross = (
            _dec(self.basic_salary)
            + _dec(self.allowances)
            + _dec(self.bonus)
            + _dec(self.overtime_pay)
        )
        deductions = _dec(self.tax_deduction) + _dec(self.other_deductions)
        self.net_pay = (gross - deductions).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee} - {self.period_year}-{self.period_month:02d}"

    @property
    def gross_pay(self):
        return (
            (self.basic_salary or 0)
            + (self.allowances or 0)
            + (self.bonus or 0)
            + (self.overtime_pay or 0)
        )

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
        ("DRAFT", "Draft"),
        ("COMPLETED", "Completed"),
        ("ACKNOWLEDGED", "Acknowledged by employee"),
    ]

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="performance_reviews"
    )
    reviewer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conducted_performance_reviews",
    )
    review_period = models.CharField(
        max_length=20,
        help_text="e.g. '2026-Q1' or '2026 Annual'",
    )
    review_date = models.DateField(default=date.today)

    # Competency scores (1-5)
    productivity = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=3,
    )
    quality = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=3,
    )
    teamwork = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=3,
    )
    communication = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=3,
    )
    leadership = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=3,
    )

    strengths = models.TextField(blank=True)
    areas_for_improvement = models.TextField(blank=True)
    goals = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="DRAFT")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-review_date"]

    def __str__(self):
        return f"{self.employee} - {self.review_period}"

    @property
    def overall_rating(self):
        scores = [
            self.productivity,
            self.quality,
            self.teamwork,
            self.communication,
            self.leadership,
        ]
        return round(sum(scores) / len(scores), 1)

    @property
    def rating_label(self):
        rating = self.overall_rating
        if rating >= 4.5:
            return "Outstanding"
        if rating >= 3.5:
            return "Exceeds Expectations"
        if rating >= 2.5:
            return "Meets Expectations"
        if rating >= 1.5:
            return "Needs Improvement"
        return "Unsatisfactory"


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
        ordering = ["date"]

    def __str__(self):
        return f"{self.name} ({self.date})"


class EmploymentEvent(models.Model):
    """
    Timeline entry for employment changes: hires, promotions, department
    transfers, salary revisions, and exits. Snapshot fields preserve the
    state at the time of the change.
    """

    EVENT_TYPES = [
        ("HIRED", "Hired"),
        ("PROMOTION", "Promotion"),
        ("TRANSFER", "Department Transfer"),
        ("SALARY_CHANGE", "Salary Change"),
        ("ROLE_CHANGE", "Employment Status Change"),
        ("EXIT", "Exit"),
    ]

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="employment_events"
    )
    event_type = models.CharField(max_length=15, choices=EVENT_TYPES)
    effective_date = models.DateField(default=date.today)
    notes = models.CharField(max_length=255, blank=True)

    # Snapshots of the state relevant to the event
    previous_department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    new_department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    previous_position = models.CharField(max_length=100, blank=True)
    new_position = models.CharField(max_length=100, blank=True)
    previous_salary = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    new_salary = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employment_events_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-effective_date", "-created_at"]

    def __str__(self):
        return (
            f"{self.employee} - {self.get_event_type_display()} ({self.effective_date})"
        )


def _document_upload_path(instance, filename):
    return f"documents/employee_{instance.employee_id}/{filename}"


class EmployeeDocument(models.Model):
    """
    File attached to an employee: contract, ID copy, certificate, etc.
    """

    CATEGORY_CHOICES = [
        ("CONTRACT", "Contract"),
        ("ID", "ID Document"),
        ("CERTIFICATE", "Certificate"),
        ("EVALUATION", "Evaluation"),
        ("OTHER", "Other"),
    ]

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="documents"
    )
    document_type = models.CharField(
        max_length=15, choices=CATEGORY_CHOICES, default="OTHER"
    )
    title = models.CharField(max_length=100)
    file = models.FileField(upload_to=_document_upload_path, max_length=300)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents_uploaded",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.employee} - {self.title}"


class Notification(models.Model):
    """
    In-app notification delivered to a user. Generated by system events
    (leave decisions, payslip generation, review assignments...).
    """

    recipient = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notifications"
    )
    verb = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    link = models.CharField(
        max_length=200,
        blank=True,
        help_text="Frontend route to open when the notification is clicked.",
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.recipient.username}: {self.verb}"
