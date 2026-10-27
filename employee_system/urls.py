"""
URL configuration for employee_system project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import include, path
from django.utils import timezone


def health_check(request):
    """
    Health-check endpoint for Docker/load-balancer liveness and readiness probes.
    Verifies database connectivity to ensure the backend can process requests.
    Returns 200 OK if healthy, or 503 Service Unavailable if database is unreachable.
    """
    db_status = "ok"
    status_code = 200
    try:
        connection.ensure_connection()
    except Exception as exc:
        db_status = f"unhealthy: {exc.__class__.__name__}"
        status_code = 503

    return JsonResponse(
        {
            "status": "healthy" if status_code == 200 else "degraded",
            "service": "Employee Management System API",
            "database": db_status,
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
