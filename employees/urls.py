from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from .views import (
    AttendanceViewSet,
    DepartmentViewSet,
    EmployeeViewSet,
    EmployeeDocumentViewSet,
    EmploymentEventViewSet,
    HolidayViewSet,
    LeaveRequestViewSet,
    LoginAPIView,
    LogoutAPIView,
    CurrentUserAPIView,
    MeAPIView,
    NotificationViewSet,
    PerformanceReviewViewSet,
    PayslipViewSet,
)

router = DefaultRouter()
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'documents', EmployeeDocumentViewSet, basename='employee-document')
router.register(r'employment-events', EmploymentEventViewSet, basename='employment-event')
router.register(r'holidays', HolidayViewSet, basename='holiday')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'leaves', LeaveRequestViewSet, basename='leave')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'payslips', PayslipViewSet, basename='payslip')
router.register(r'performance-reviews', PerformanceReviewViewSet, basename='performance-review')

urlpatterns = [
    # -----------------------------------------------------------------------
    # Authentication endpoints
    # -----------------------------------------------------------------------
    # Custom login: validates credentials, returns JWT access + refresh tokens
    path('auth/login/', LoginAPIView.as_view(), name='api_login'),
    # simplejwt: silently refresh expired access token using refresh token
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # simplejwt: verify any token is still valid (useful for client-side guard)
    path('auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    # Blacklist refresh token on logout
    path('auth/logout/', LogoutAPIView.as_view(), name='api_logout'),
    # Self-service: full employee profile for the currently logged-in user
    path('auth/me/', MeAPIView.as_view(), name='api_me'),
    # Raw Django user object (id, username, email, role)
    path('auth/user/', CurrentUserAPIView.as_view(), name='api_user'),

    # DRF Router endpoints (/api/departments/, /api/employees/, etc.)
    path('', include(router.urls)),
]