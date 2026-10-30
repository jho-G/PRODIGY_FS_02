"""
URL configuration for employee_system project.
"""

import logging

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import include, path
from django.utils import timezone

logger = logging.getLogger(__name__)


def health_check(request):
    """
    Health-check endpoint for Docker/load-balancer liveness and readiness probes.
    Actively verifies database connectivity via connection.ensure_connection().
    Returns HTTP 200 with database: connected when healthy, or HTTP 503 with
    database: unavailable when the database is unreachable.
    """
    try:
        connection.ensure_connection()
        db_ok = True
    except Exception as exc:
        logger.warning("Database health check probe failed: %s", exc)
        db_ok = False

    status_code = 200 if db_ok else 503
    return JsonResponse(
        {
            "status": "healthy" if db_ok else "unhealthy",
            "database": "connected" if db_ok else "unavailable",
            "timestamp": timezone.now().isoformat(),
        },
        status=status_code,
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("employees.urls")),
    path("health/", health_check, name="health_check"),
    path("", lambda request: redirect("/api/"), name="api_root_redirect"),
]

# Serve user-uploaded documents in development (nginx proxies /media/ in prod)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
