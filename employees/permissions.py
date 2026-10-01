"""
Role-based permission helpers and DRF permission classes.

Roles are stored on the UserProfile model. Three tiers exist:

- ADMIN: full control of every resource
- HR: like admin, but cannot delete departments or hard-delete employees
- MANAGER: read everything, manage their direct reports, approve their leave
- EMPLOYEE: read their own records and manage their own leave requests

The helpers below are used both by DRF permission classes and directly inside
views (e.g. queryset scoping), so they are the single source of truth.
"""

from rest_framework import permissions

# Role constants — mirrored on UserProfile.ROLE_CHOICES
ROLE_ADMIN = 'ADMIN'
ROLE_HR = 'HR'
ROLE_MANAGER = 'MANAGER'
ROLE_EMPLOYEE = 'EMPLOYEE'

WRITE_ROLES = {ROLE_ADMIN, ROLE_HR, ROLE_MANAGER}
DELETE_ROLES = {ROLE_ADMIN, ROLE_HR}


def get_role(user):
    """Return the role string for a user; EMPLOYEE for anonymous/missing profile."""
    if not getattr(user, 'is_authenticated', False):
        return ROLE_EMPLOYEE
    if user.is_superuser:
        return ROLE_ADMIN
    profile = getattr(user, 'profile', None)
    return profile.role if profile else ROLE_EMPLOYEE


def is_admin(user):
    return get_role(user) == ROLE_ADMIN


def is_hr_or_above(user):
    return get_role(user) in {ROLE_ADMIN, ROLE_HR}


def is_manager_or_above(user):
    return get_role(user) in WRITE_ROLES


def is_direct_manager(user, employee):
    """True if the given employee reports (directly) to this user's employee record."""
    manager_employee = getattr(user, 'employee_record', None)
    return bool(
        manager_employee
        and employee
        and employee.manager_id == manager_employee.id
    )


class IsAuthenticatedReadOnlyOrStaff(permissions.BasePermission):
    """
    Authenticated users can read everything; writes require manager-or-above;
    deletions require HR or admin.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.method == 'DELETE':
            return is_hr_or_above(request.user)
        return is_manager_or_above(request.user)


class IsManagerOrAbove(permissions.BasePermission):
    """Write actions restricted to admin / HR / manager roles."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and is_manager_or_above(request.user)
        )


class IsHROrAdmin(permissions.BasePermission):
    """Full access restricted to admin / HR roles."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and is_hr_or_above(request.user)
        )
