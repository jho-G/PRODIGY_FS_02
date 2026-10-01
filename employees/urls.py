from django.urls import path, include
from rest_framework.routers import DefaultRouter
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
    # Authentication endpoints
    path('auth/login/', LoginAPIView.as_view(), name='api_login'),
    path('auth/me/', MeAPIView.as_view(), name='api_me'),
    path('auth/logout/', LogoutAPIView.as_view(), name='api_logout'),
    path('auth/user/', CurrentUserAPIView.as_view(), name='api_user'),

    # DRF Router endpoints (/api/departments/, /api/employees/)
    path('', include(router.urls)),
]