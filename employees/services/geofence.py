"""Geofence and IP verification utilities for attendance punch-in."""

import ipaddress
import math
from decimal import Decimal


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth in meters.
    Uses the Haversine formula.
    """
    R = 6371000.0  # Earth radius in meters

    phi1 = math.radians(float(lat1))
    phi2 = math.radians(float(lat2))
    delta_phi = math.radians(float(lat2) - float(lat1))
    delta_lambda = math.radians(float(lon2) - float(lon1))

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * (
        math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def is_ip_allowed(client_ip: str, allowed_ip_ranges_str: str) -> bool:
    """
    Check if a client IP address matches any of the comma- or newline-separated
    allowed IP addresses or CIDR network blocks.
    """
    if not client_ip or not allowed_ip_ranges_str:
        return False

    try:
        ip = ipaddress.ip_address(client_ip.strip())
    except ValueError:
        return False

    # Normalize delimiters
    normalized = allowed_ip_ranges_str.replace("\n", ",").replace(";", ",")
    for raw_item in normalized.split(","):
        entry = raw_item.strip()
        if not entry:
            continue
        try:
            # Check CIDR network block or single host
            if "/" in entry:
                net = ipaddress.ip_network(entry, strict=False)
                if ip in net:
                    return True
            else:
                target_ip = ipaddress.ip_address(entry)
                if ip == target_ip:
                    return True
        except ValueError:
            continue

    return False


def get_client_ip(request) -> str:
    """Extract real client IP address respecting reverse proxies."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "").strip()


def verify_punch_geofence(
    latitude: Decimal | float | None,
    longitude: Decimal | float | None,
    client_ip: str | None,
) -> tuple[bool, bool, str]:
    """
    Validates a clock-in attempt against registered active OfficeLocation premises.

    Returns:
        tuple (is_geofence_verified: bool, is_flagged: bool, flag_or_success_reason: str)

    Logic:
    - If no OfficeLocation records exist, geofencing is inactive (passes without flag).
    - If client matches IP range of an active office, verified = True.
    - If coordinates are within radius_meters of an active office, verified = True.
    - If both IP and Coordinates fail, flagged = True with audit distance/reason.
    """
    from employees.models import OfficeLocation

    active_offices = list(OfficeLocation.objects.filter(is_active=True))
    if not active_offices:
        return True, False, "No office geofence constraints configured."

    closest_distance = None
    closest_office = None

    for office in active_offices:
        # Check IP network whitelist first
        if client_ip and office.allowed_ip_ranges:
            if is_ip_allowed(client_ip, office.allowed_ip_ranges):
                return (
                    True,
                    False,
                    f"Verified via allowed office network: {office.name}",
                )

        # Check coordinates radius
        if (
            latitude is not None
            and longitude is not None
            and office.latitude is not None
            and office.longitude is not None
        ):
            dist = haversine_distance(
                float(latitude),
                float(longitude),
                float(office.latitude),
                float(office.longitude),
            )
            if closest_distance is None or dist < closest_distance:
                closest_distance = dist
                closest_office = office

            if dist <= office.radius_meters:
                return (
                    True,
                    False,
                    f"Verified at {office.name} (within {int(dist)}m of {office.radius_meters}m boundary)",
                )

    # If coordinates were provided but all failed radius
    if closest_distance is not None and closest_office is not None:
        reason = (
            f"Punch outside {closest_office.name} geofence "
            f"({int(closest_distance)}m away, allowable: {closest_office.radius_meters}m)"
        )
        return False, True, reason

    if latitude is None or longitude is None:
        return False, True, "Missing geolocation coordinates on on-premise punch"

    return False, True, "Punch location does not match any registered office"
