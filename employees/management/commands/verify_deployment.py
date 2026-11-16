"""Management command to verify production deployment readiness and security posture."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


class Command(BaseCommand):
    help = "Run pre-flight checks to verify production deployment configuration and security settings."

    def add_arguments(self, parser):
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Treat warnings (e.g. non-production DEBUG=True) as fatal errors.",
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                "=== Pre-flight Production Deployment Verification ==="
            )
        )

        errors = []
        warnings = []
        passed = []

        # 1. Check DEBUG setting
        if settings.DEBUG:
            msg = "DEBUG is True! This should ALWAYS be False in production."
            if options.get("strict"):
                errors.append(msg)
            else:
                warnings.append(msg)
        else:
            passed.append("DEBUG is False (production safe).")

        # 2. Check SECRET_KEY strength and defaults
        insecure_keys = [
            "django-insecure-your-secret-key-change-in-production-fs02",
            "django-insecure-change-me",
            "secret",
        ]
        if not settings.SECRET_KEY or settings.SECRET_KEY in insecure_keys:
            errors.append("SECRET_KEY is using an insecure default or is empty.")
        elif len(settings.SECRET_KEY) < 32:
            warnings.append(
                f"SECRET_KEY length ({len(settings.SECRET_KEY)}) is under recommended 32 characters."
            )
        else:
            passed.append(
                f"SECRET_KEY is configured with strong entropy ({len(settings.SECRET_KEY)} chars)."
            )

        # 3. Check ALLOWED_HOSTS
        if not settings.ALLOWED_HOSTS:
            errors.append("ALLOWED_HOSTS is empty.")
        elif "*" in settings.ALLOWED_HOSTS:
            warnings.append(
                "ALLOWED_HOSTS contains '*' wildcard. Restrict to specific production domains."
            )
        else:
            passed.append(
                f"ALLOWED_HOSTS configured: {', '.join(settings.ALLOWED_HOSTS)}"
            )

        # 4. Check Database Connectivity
        try:
            connection.ensure_connection()
            passed.append(
                f"Database connection successful (Engine: {settings.DATABASES['default']['ENGINE']})."
            )
        except Exception as e:
            errors.append(f"Database connection failed: {e}")

        # 5. Check Pending Migrations
        try:
            executor = MigrationExecutor(connection)
            targets = executor.loader.graph.leaf_nodes()
            plan = executor.migration_plan(targets)
            if plan:
                errors.append(
                    f"{len(plan)} unapplied migration(s) detected. Run `python manage.py migrate`."
                )
            else:
                passed.append(
                    "Database schema is fully up-to-date (no unapplied migrations)."
                )
        except Exception as e:
            errors.append(f"Failed to inspect database migration state: {e}")

        # 6. Check Active Superuser Existence
        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            admin_count = User.objects.filter(is_superuser=True, is_active=True).count()
            if admin_count == 0:
                errors.append(
                    "No active superuser found! Run `python manage.py createsuperuser` to avoid client lockout."
                )
            else:
                passed.append(
                    f"Administrative access verified ({admin_count} active superuser account(s))."
                )
        except Exception as e:
            errors.append(f"Failed to verify superuser accounts: {e}")

        # 7. Check Security Headers & Cookie settings
        if not getattr(settings, "SESSION_COOKIE_SECURE", False):
            warnings.append(
                "SESSION_COOKIE_SECURE is False. Session cookies are not HTTPS-only."
            )
        else:
            passed.append("SESSION_COOKIE_SECURE is enabled.")

        if not getattr(settings, "CSRF_COOKIE_SECURE", False):
            warnings.append(
                "CSRF_COOKIE_SECURE is False. CSRF cookies are not HTTPS-only."
            )
        else:
            passed.append("CSRF_COOKIE_SECURE is enabled.")

        if not getattr(settings, "SECURE_SSL_REDIRECT", False):
            warnings.append(
                "SECURE_SSL_REDIRECT is False (acceptable if reverse proxy terminates SSL)."
            )
        else:
            passed.append("SECURE_SSL_REDIRECT is enabled.")

        # Print Report
        for p in passed:
            self.stdout.write(self.style.SUCCESS(f"  [PASS] {p}"))

        for w in warnings:
            self.stdout.write(self.style.WARNING(f"  [WARN] {w}"))

        for err in errors:
            self.stdout.write(self.style.ERROR(f"  [FAIL] {err}"))

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                "-----------------------------------------------------"
            )
        )
        self.stdout.write(
            f"Summary: {len(passed)} passed, {len(warnings)} warning(s), {len(errors)} error(s)."
        )

        if errors:
            raise CommandError(
                f"Deployment verification FAILED with {len(errors)} critical error(s)."
            )

        self.stdout.write(
            self.style.SUCCESS(
                "All critical deployment pre-flight checks PASSED successfully."
            )
        )
