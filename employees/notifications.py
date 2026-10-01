"""
Helpers to create in-app notifications for system events.

Each helper resolves the correct recipients (employee's linked user,
direct manager, HR users) and writes Notification rows. Failures are
contained so a notification problem never breaks the main operation.
"""

from django.contrib.auth.models import User

from .models import Notification, UserProfile
from .permissions import ROLE_ADMIN, ROLE_HR

DEFAULT_LINKS = {
    'leave': '/leave',
    'payslip': '/payroll',
    'review': '/performance',
    'document': '/employees',
}


def _users_with_roles(*roles):
    return User.objects.filter(profile__role__in=roles, is_active=True)


def notify_employee(employee, verb, description='', link_key=None):
    """Notify the user linked to an employee record (if any)."""
    try:
        profile = getattr(employee, 'user_account', None)
        if profile and profile.user_id:
            Notification.objects.create(
                recipient=profile.user,
                verb=verb,
                description=description,
                link=DEFAULT_LINKS.get(link_key, ''),
            )
    except Exception:
        pass


def notify_manager(employee, verb, description='', link_key=None):
    """Notify the direct manager of an employee (if linked to a user)."""
    try:
        manager = employee.manager
        if manager:
            profile = getattr(manager, 'user_account', None)
            if profile and profile.user_id:
                Notification.objects.create(
                    recipient=profile.user,
                    verb=verb,
                    description=description,
                    link=DEFAULT_LINKS.get(link_key, ''),
                )
    except Exception:
        pass


def notify_hr(verb, description='', link_key=None, exclude_user=None):
    """Notify all active HR users and admins."""
    try:
        for user in _users_with_roles(ROLE_HR, ROLE_ADMIN):
            if exclude_user and user.id == exclude_user.id:
                continue
            Notification.objects.create(
                recipient=user,
                verb=verb,
                description=description,
                link=DEFAULT_LINKS.get(link_key, ''),
            )
    except Exception:
        pass


def notify_leave_submitted(leave):
    """New leave request: alert the manager (or HR as fallback)."""
    description = (
        f"{leave.employee.full_name} requested {leave.leave_days} working day(s) "
        f"of {leave.get_leave_type_display().lower()} leave "
        f"({leave.start_date} to {leave.end_date})."
    )
    if leave.employee.manager:
        notify_manager(
            leave.employee,
            'New leave request awaiting your approval',
            description,
            link_key='leave',
        )
    else:
        notify_hr(
            'New leave request awaiting approval',
            description,
            link_key='leave',
        )


def notify_leave_decision(leave):
    """Leave approved/rejected/cancelled: inform the requester."""
    if leave.status == 'APPROVED':
        verb = f'Leave approved ({leave.leave_days} working days)'
    elif leave.status == 'REJECTED':
        verb = 'Leave request rejected'
    else:
        verb = 'Leave request cancelled'
    notify_employee(
        leave.employee,
        verb,
        f"{leave.get_leave_type_display()} leave {leave.start_date} to {leave.end_date}.",
        link_key='leave',
    )


def notify_payslip_generated(payslip):
    """New/updated payslip: inform the employee."""
    notify_employee(
        payslip.employee,
        f'Payslip ready for {payslip.period_label}',
        f"Net pay {payslip.currency} {payslip.net_pay}.",
        link_key='payslip',
    )


def notify_review_completed(review):
    """Completed review: ask the employee to acknowledge."""
    notify_employee(
        review.employee,
        f'Performance review completed for {review.review_period}',
        'Please review and acknowledge your evaluation.',
        link_key='review',
    )


def notify_document_uploaded(document):
    """New document on file: inform HR and the employee."""
    notify_hr(
        'New employee document uploaded',
        f"{document.title} added for {document.employee.full_name}.",
        link_key='document',
    )
    notify_employee(
        document.employee,
        f'New document on file: {document.title}',
        '',
        link_key='document',
    )
