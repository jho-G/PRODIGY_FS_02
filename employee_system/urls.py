"""
URL configuration for employee_system project.
"""
from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('employees.urls')),
    path('', lambda request: redirect('/api/'), name='api_root_redirect'),
]