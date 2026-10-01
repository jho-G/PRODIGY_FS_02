"""
URL configuration for employee_system project.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('employees.urls')),
    path('', lambda request: redirect('/api/'), name='api_root_redirect'),
]

# Serve user-uploaded documents in development (nginx proxies /media/ in prod)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)