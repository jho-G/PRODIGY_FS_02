"""Management command to cleanly purge demo and test data before client handover."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from employees.models import (
    AttendanceRecord,
    Department,
    Employee,
    EmployeeDocument,
    EmploymentEvent,
    Holiday,
    LeaveRequest,
    Notification,
    Payslip,
    PerformanceReview,
)

User = get_user_model()


class Command(BaseCommand):
    help = "Purge development and test data (employees, attendance, payslips, leave, reviews) before client handover."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Confirm irreversible deletion of test data.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Display the counts of records that would be purged without actually deleting them.",
        )
        parser.add_argument(
            "--include-departments",
            action="store_true",
            help="Purge Department records as well (by default, departments are preserved).",
        )
        parser.add_argument(
            "--delete-test-users",
            action="store_true",
            help="Delete non-superuser User accounts associated with purged test records.",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        confirm = options.get("confirm", False)
        include_depts = options.get("include_departments", False)
        delete_test_users = options.get("delete_test_users", False)

        if not confirm and not dry_run:
            raise CommandError(
                "Safety guard: You must specify --confirm to permanently delete records, or --dry-run to preview."
            )

        self.stdout.write(self.style.MIGRATE_HEADING("=== Pre-Deployment Test Data Purge Utility ==="))

        counts = {
            "Performance Reviews": PerformanceReview.objects.count(),
            "Payslips": Payslip.objects.count(),
            "Attendance Records": AttendanceRecord.objects.count(),
            "Leave Requests": LeaveRequest.objects.count(),
            "Employment Events": EmploymentEvent.objects.count(),
            "Employee Documents": EmployeeDocument.objects.count(),
            "Notifications": Notification.objects.count(),
            "Holidays": Holiday.objects.count(),
            "Employees": Employee.objects.count(),
        }

        if include_depts:
            counts["Departments"] = Department.objects.count()

        if delete_test_users:
            counts["Non-superuser Accounts"] = User.objects.filter(is_superuser=False).count()

        for model_name, count in counts.items():
            self.stdout.write(f"  - {model_name}: {count} record(s)")

        if dry_run:
            self.stdout.write(self.style.SUCCESS("\n[DRY RUN] No records were deleted."))
            return

        with transaction.atomic():
            PerformanceReview.objects.all().delete()
            Payslip.objects.all().delete()
            AttendanceRecord.objects.all().delete()
            LeaveRequest.objects.all().delete()
            EmploymentEvent.objects.all().delete()
            EmployeeDocument.objects.all().delete()
            Notification.objects.all().delete()
            Holiday.objects.all().delete()
            Employee.objects.all().delete()

            if include_depts:
                Department.objects.all().delete()

            if delete_test_users:
                User.objects.filter(is_superuser=False).delete()

        self.stdout.write(
            self.style.SUCCESS(
                "\nSuccessfully purged test records. System is clean and ready for client onboarding."
            )
        )
