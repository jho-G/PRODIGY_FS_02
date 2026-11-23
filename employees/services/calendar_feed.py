"""Service to generate RFC 5545 compliant iCalendar (.ics) feeds."""

from datetime import timedelta

from django.utils import timezone


def _format_date(d):
    """Format date for iCalendar all-day events (YYYYMMDD)."""
    return d.strftime("%Y%m%d")


def _format_datetime(dt):
    """Format datetime in UTC for iCalendar (YYYYMMDDTHHMMSSZ)."""
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.utc)
    utc_dt = dt.astimezone(timezone.utc)
    return utc_dt.strftime("%Y%m%dT%H%M%SZ")


def _escape_text(text):
    """Escape special characters in iCalendar text fields according to RFC 5545."""
    if not text:
        return ""
    text = str(text).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
    text = text.replace("\r\n", "\\n").replace("\n", "\\n")
    return text


def generate_icalendar_feed(profile, holidays, leaves, reviews=None) -> str:
    """Generate RFC 5545 VCALENDAR feed string.

    :param profile: UserProfile of the subscribing user
    :param holidays: Queryset or list of Holiday instances
    :param leaves: Queryset or list of LeaveRequest instances (approved)
    :param reviews: Optional queryset or list of PerformanceReview instances
    :return: Formatted .ics string
    """
    now_stamp = _format_datetime(timezone.now())
    user = profile.user
    role = profile.role

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Employee Management System//EMS Calendar 2.0//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape_text(f'EMS — {user.get_full_name() or user.username} ({role})')}",
        "X-WR-TIMEZONE:UTC",
        "X-WR-CALDESC:Automated company holidays, team PTO leaves, and deadlines.",
    ]

    # 1. Company Holidays
    for hol in holidays:
        start_str = _format_date(hol.date)
        end_str = _format_date(hol.date + timedelta(days=1))
        summary = _escape_text(f"Holiday: {hol.name}")
        desc = _escape_text(hol.description or "Official Company Holiday")
        uid = f"holiday-{hol.id}-{hol.date.year}@ems"

        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{uid}",
                f"DTSTAMP:{now_stamp}",
                f"DTSTART;VALUE=DATE:{start_str}",
                f"DTEND;VALUE=DATE:{end_str}",
                f"SUMMARY:{summary}",
                f"DESCRIPTION:{desc}",
                "CATEGORIES:HOLIDAY,COMPANY",
                "STATUS:CONFIRMED",
                "TRANSP:TRANSPARENT",
                "END:VEVENT",
            ]
        )

    # 2. Approved Leaves
    for leave in leaves:
        start_str = _format_date(leave.start_date)
        # In iCalendar, DTEND for all-day events is exclusive (day after last day)
        end_str = _format_date(leave.end_date + timedelta(days=1))
        emp_name = leave.employee.full_name
        leave_type_label = leave.get_leave_type_display()
        summary = _escape_text(f"Leave: {emp_name} ({leave_type_label})")
        desc = _escape_text(
            f"Employee: {emp_name} ({leave.employee.employee_id})\\n"
            f"Type: {leave_type_label}\\n"
            f"Working Days: {leave.days}\\n"
            f"Reason: {leave.reason}"
        )
        uid = f"leave-{leave.id}-{leave.start_date}@ems"

        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{uid}",
                f"DTSTAMP:{now_stamp}",
                f"DTSTART;VALUE=DATE:{start_str}",
                f"DTEND;VALUE=DATE:{end_str}",
                f"SUMMARY:{summary}",
                f"DESCRIPTION:{desc}",
                "CATEGORIES:LEAVE,PTO",
                "STATUS:CONFIRMED",
                "TRANSP:OPAQUE",
                "END:VEVENT",
            ]
        )

    # 3. Performance Review Deadlines (if applicable)
    if reviews:
        for rev in reviews:
            rev_date = (
                rev.review_period_end if hasattr(rev, "review_period_end") else None
            )
            if not rev_date and hasattr(rev, "created_at"):
                rev_date = rev.created_at.date()
            if rev_date:
                start_str = _format_date(rev_date)
                end_str = _format_date(rev_date + timedelta(days=1))
                summary = _escape_text(
                    f"Review: {rev.employee.full_name} ({rev.review_period})"
                )
                desc = _escape_text(
                    f"Status: {rev.get_status_display()}\\nRating: {rev.rating or 'Pending'}"
                )
                uid = f"review-{rev.id}@ems"
                lines.extend(
                    [
                        "BEGIN:VEVENT",
                        f"UID:{uid}",
                        f"DTSTAMP:{now_stamp}",
                        f"DTSTART;VALUE=DATE:{start_str}",
                        f"DTEND;VALUE=DATE:{end_str}",
                        f"SUMMARY:{summary}",
                        f"DESCRIPTION:{desc}",
                        "CATEGORIES:REVIEW,PERFORMANCE",
                        "STATUS:CONFIRMED",
                        "TRANSP:TRANSPARENT",
                        "END:VEVENT",
                    ]
                )

    lines.append("END:VCALENDAR")
    lines.append("")
    return "\r\n".join(lines)
