# Changelog

All notable changes to the Employee Management System business logic and workflow features are documented here.

---

## [2.0.0] - 2026-10-21

### ⚙️ Business Logic & Workflow Fixes

#### 1. Attendance Clock-In for New Days (Bug 2.1)
- **Dedicated Punch Endpoints**:
  - `POST /api/attendance/punch_in/`: Automatically finds or creates today's attendance record for the calling user and records check-in timestamp.
  - `POST /api/attendance/punch_out/`: Records check-out timestamp for today's active shift.
  - `POST /api/attendance/check_in/` & `POST /api/attendance/check_out/`: Collection-level action aliases so frontend clients can clock in and out without needing a pre-existing record ID.
- **Auto-Detect LATE Status**:
  - Automatic detection against `AttendanceRecord.LATE_CUTOFF` (09:00 AM). Check-ins after 09:00 AM are flagged with `status="LATE"`; arrivals before or at 09:00 AM are marked `status="PRESENT"`.
- **Frontend Attendance UI**:
  - Added dedicated **Today's Attendance Status** glassmorphic card on the Attendance page displaying live date, shift progress, late cutoff notes, and quick clock-in / clock-out actions.
  - Enhanced API client (`attendanceApi.punchIn`, `attendanceApi.punchOut`, and parameterless `checkIn`/`checkOut`).

#### 2. Retroactive Leave Cancellation Guard (Bug 2.2)
- **Commenced Leave Protection**:
  - Enforced `leave.start_date <= timezone.now().date()` in `LeaveRequestViewSet.cancel()`.
  - Regular employees and managers can no longer retroactively cancel leaves that have already commenced or passed, protecting vacation balances from invalid restorations.
- **HR/Admin Retroactive Override**:
  - Retroactive adjustments strictly require HR or Admin authorization (`is_hr_or_above`).
  - Added frontend button disabling with descriptive tooltip when a leave has already commenced for non-HR users.

#### 3. Overlapping & 0-Day Leave Validation (Bug 2.3)
- **0 Working Day Rejection**:
  - Integrated `working_days_between(start_date, end_date, holiday_dates)` directly into `LeaveRequestSerializer.validate()`.
  - Rejects leave requests falling entirely on weekends (Saturday/Sunday) or company holidays with a clear validation error.
- **Overlap Prevention**:
  - Robust overlap detection checking existing `PENDING` and `APPROVED` leave requests for the target employee (`start_date <= request.end_date AND end_date >= request.start_date`).
  - Correctly permits requests overlapping with `CANCELLED` or `REJECTED` leaves.

#### 4. Performance Review Role Permissions & Self-Review Guard (Bug 2.4)
- **Manager-Only Review Completion**:
  - Enforced `IsManagerOrAbove` permission class on `PerformanceReviewViewSet.complete()`.
  - Prohibited employees and managers from completing their own performance reviews.
- **Strict Evaluated-Employee Acknowledgment**:
  - Restricted `acknowledge()` action strictly to the employee being evaluated (`review.employee.user == request.user`).
  - Removed manager exemption so other users cannot acknowledge another employee's performance review.
- **Employee Model Shortcut**:
  - Added `@property def user(self)` on `Employee` model linking to the associated Django user via `UserProfile`.
