from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DepartmentViewSet,
    EmployeeViewSet,
    LoginAPIView,
    LogoutAPIView,
    CurrentUserAPIView,
)

router = DefaultRouter()
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'employees', EmployeeViewSet, basename='employee')

urlpatterns = [
    # Authentication endpoints
    path('auth/login/', LoginAPIView.as_view(), name='api_login'),
    path('auth/logout/', LogoutAPIView.as_view(), name='api_logout'),
    path('auth/user/', CurrentUserAPIView.as_view(), name='api_user'),

    # DRF Router endpoints (/api/departments/, /api/employees/)
    path('', include(router.urls)),
]