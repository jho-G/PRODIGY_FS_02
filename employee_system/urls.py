"""
URL configuration for employee_system project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import include, path
from django.utils import timezone


def health_check(request):
    """
    Lightweight health-check endpoint for Docker/load-balancer liveness probes.
    Returns 200 OK with basic system status so orchestrators can verify the
    service is up without hitting a full API endpoint.
    """
    return JsonResponse(
        {
            "status": "healthy",
            "service": "Employee Management System API",
            "timestamp": timezone.now().isoformat(),
        },
        status=200,
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
