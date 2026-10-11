# Employee Management System (EMS) — In-Depth Technical Specification & Architecture Description

> **Document Version:** 2.0.0  
> **Target Audience:** Engineering Leads, Software Architects, Full-Stack Developers, DevOps Engineers, and System Administrators  
> **Repository:** [PRODIGY_FS_02](https://github.com/jho-G/PRODIGY_FS_02)  
> **Branch:** `react_and_drf`  
> **Last Updated:** October 2026  

---

## Table of Contents

1. [Executive Summary & System Vision](#1-executive-summary--system-vision)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Technology Stack & Architectural Rationale](#3-technology-stack--architectural-rationale)
4. [Domain Model & Relational Database Design](#4-domain-model--relational-database-design)
5. [Authentication, Authorization & RBAC Matrix](#5-authentication-authorization--rbac-matrix)
6. [API Surface & Endpoint Specifications](#6-api-surface--endpoint-specifications)
7. [Frontend Architecture & Client State Lifecycle](#7-frontend-architecture--client-state-lifecycle)
8. [Security Engineering, Rate Limiting & Hardening](#8-security-engineering-rate-limiting--hardening)
9. [DevOps, Containerization & SSL Deployment Runbook](#9-devops-containerization--ssl-deployment-runbook)
10. [Testing, Quality Assurance & Linting Pipelines](#10-testing-quality-assurance--linting-pipelines)
11. [Operational Runbook & Disaster Recovery](#11-operational-runbook--disaster-recovery)

---

## 1. Executive Summary & System Vision

The **Employee Management System (EMS)** is an enterprise-grade, full-stack human resource management platform engineered to streamline workforce administration, departmental organization, attendance tracking, leave request lifecycles, compensation payroll generation, performance reviews, organizational documents, and company-wide calendar holidays.

### 1.1 Core Business Objectives
- **Centralized Workforce Single Source of Truth:** Unify personnel records, employment status, reporting hierarchies, and compensation data within a single secure repository.
- **Operational Automation:** Replace manual paperwork with automated self-service workflows for employee leaves, daily attendance clocking, and automated monthly payroll calculation.
- **Hierarchical Governance & Compliance:** Enforce granular Role-Based Access Control (RBAC) ensuring employees, managers, HR officers, and system administrators only view and mutate data within their designated authorization boundaries.
- **Decoupled Modern UX:** Provide responsive, snappy, dark/light themed interactions powered by a single-page React frontend paired with a stateless, secure Django REST Framework API.

---

## 2. High-Level System Architecture

The application implements a decoupled client-server architecture with an API gateway/reverse proxy layer for production security and static asset offloading:

```
+-----------------------------------------------------------------------+
|                             Client Layer                              |
|   +---------------------------------------------------------------+   |
|   |         React 18 Single-Page Application (Vite Bundler)       |   |
|   |   - Responsive UI (Dark/Light Modes, Lucide Icons)            |   |
|   |   - React Router DOM v6 Client-Side Routing                   |   |
|   |   - Centralized Axios Instance with Token Refresh Interceptor  |   |
|   +---------------------------------------------------------------+   |
+-----------------------------------▲-----------------------------------+
                                    │ HTTPS (Port 443 / Dev 5173)
                                    ▼
+-----------------------------------------------------------------------+
|                      Reverse Proxy & Ingress Layer                    |
|   +---------------------------------------------------------------+   |
|   |                  Nginx 1.25+ (Alpine Container)               |   |
|   |   - SSL/TLS Termination (Modern TLS 1.2/1.3)                  |   |
|   |   - Static Asset Serving (/assets/*, caching headers)         |   |
|   |   - Security Headers (HSTS, CSP, X-Frame-Options)             |   |
|   |   - Reverse Proxy: /api/* & /admin/* to Backend Container     |   |
|   +---------------------------------------------------------------+   |
+-----------------------------------▲-----------------------------------+
                                    │ HTTP (Internal Docker Network :8000)
                                    ▼
+-----------------------------------------------------------------------+
|                     Application & Business Logic Layer                |
|   +---------------------------------------------------------------+   |
|   |           Django 5.x + Django REST Framework (Gunicorn)       |   |
|   |   - SimpleJWT Authentication & Token Blacklisting             |   |
|   |   - Custom RBAC Permissions (IsAdminOrHR, IsSelfOrHR, etc.)   |   |
|   |   - Resource ViewSets & Serializer Validation Pipelines       |   |
|   |   - IP Rate Limiting (django-ratelimit) & Throttling          |   |
|   |   - Management Commands (Mock Data Seeding, Report Export)     |   |
|   +---------------------------------------------------------------+   |
+-----------------------------------▲-----------------------------------+
                                    │ SQL Queries (ORM Abstraction)
                                    ▼
+-----------------------------------------------------------------------+
|                         Persistence & Media Layer                     |
|   +-----------------------------------+---------------------------+   |
|   |    Relational Database            |   Media & Storage Volume  |   |
|   |    - SQLite 3 (Dev / Zero-config) |   - Employee Documents    |   |
|   |    - PostgreSQL 15+ (Production)  |   - Profile Avatars       |   |
|   +-----------------------------------+---------------------------+   |
+-----------------------------------------------------------------------+
```

---

## 3. Technology Stack & Architectural Rationale

| Domain | Technology | Version | Rationale |
|---|---|---|---|
| **Backend Engine** | Python / Django | 3.11+ / 5.1 | High developer velocity, battle-tested ORM, built-in migration engine, and comprehensive security defaults against SQL injection and CSRF. |
| **API Framework** | Django REST Framework | 3.15+ | Industry standard for Python REST APIs; provides powerful serializers, model viewsets, content negotiation, and the interactive Browsable API. |
| **Authentication** | `djangorestframework-simplejwt` | 5.3+ | Stateless, cryptographically signed token exchange with token rotation and redis/database blacklisting for immediate revocation. |
| **Rate Limiting** | `django-ratelimit` | 4.1+ | IP-based request throttling protecting credential endpoints against brute-force credential stuffing. |
| **Configuration** | `python-decouple` | 3.8+ | Adherence to 12-Factor App methodology; isolates runtime environment variables from source control. |
| **Frontend Framework** | React | 18.3 | Component-driven declarative UI, virtual DOM rendering performance, and rich ecosystem. |
| **Build Tool** | Vite | 5.4 | Sub-second Hot Module Replacement (HMR), tree-shaking, and optimized Rollup production bundling. |
| **HTTP Client** | Axios | 1.7 | First-class interceptor support enabling transparent 401 token refresh queue handling. |
| **Icons & UI** | Lucide React | 0.447 | Crisp, modern, customizable SVG icon library with zero runtime bloat. |
| **Routing** | React Router DOM | 6.26 | Declarative client-side routing, protected route guards, and nested layout nesting. |
| **Gateway / Proxy** | Nginx Alpine | 1.25+ | Lightweight, high-throughput static file delivery, SSL offloading, and backend request forwarding. |
| **Containerization**| Docker & Docker Compose | 24+ / v2 | Deterministic multi-stage image builds ensuring parity across local development and production environments. |
| **Code Quality** | Ruff & Oxlint | Latest | High-speed Rust-based linters and formatters ensuring clean, consistent, PEP8-compliant code across all teams. |

---

## 4. Domain Model & Relational Database Design

The data persistence layer is constructed with Django ORM models, enforcing database-level constraints (foreign keys, uniqueness, check constraints, default values, and indexes) to guarantee ACID integrity.

### 4.1 Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    AUTH_USER ||--o| USER_PROFILE : "has profile (1:1)"
    AUTH_USER ||--o| EMPLOYEE : "linked employee (1:1)"
    DEPARTMENT ||--o{ EMPLOYEE : "employs (1:N)"
    EMPLOYEE ||--o{ EMPLOYEE : "manages (self-referential 1:N)"
    
    EMPLOYEE ||--o{ LEAVE_REQUEST : "submits (1:N)"
    AUTH_USER ||--o{ LEAVE_REQUEST : "reviews (1:N)"
    
    EMPLOYEE ||--o{ ATTENDANCE_RECORD : "logs (1:N)"
    
    EMPLOYEE ||--o{ PAYSLIP : "receives (1:N)"
    
    EMPLOYEE ||--o{ PERFORMANCE_REVIEW : "evaluated in (1:N)"
    AUTH_USER ||--o{ PERFORMANCE_REVIEW : "evaluates (1:N)"
    
    EMPLOYEE ||--o{ EMPLOYEE_DOCUMENT : "owns (1:N)"
    AUTH_USER ||--o{ EMPLOYEE_DOCUMENT : "uploads (1:N)"
    
    EMPLOYEE ||--o{ EMPLOYMENT_EVENT : "timeline for (1:N)"
    AUTH_USER ||--o{ EMPLOYMENT_EVENT : "recorded by (1:N)"
    
    AUTH_USER ||--o{ NOTIFICATION : "receives (1:N)"
    AUTH_USER ||--o{ NOTIFICATION : "sends (1:N)"

    HOLIDAY {
        int id PK
        string name
        date date
        string description
        boolean is_recurring
    }
```

### 4.2 Detailed Model Specifications

#### 1. UserProfile (`employees.models.UserProfile`)
Extends the standard Django `auth.User` model with enterprise application metadata and RBAC roles.
- `user` (`OneToOneField` -> `User`, `CASCADE`, `related_name='profile'`): The associated Django auth user.
- `role` (`CharField`, choices: `ADMIN`, `HR`, `MANAGER`, `EMPLOYEE`, default `EMPLOYEE`): Determines system privileges and navigation authorization.
- `phone_number` (`CharField`, max_length=20, blank=True): Contact phone.
- `avatar` (`ImageField`, upload_to='avatars/', blank=True, null=True): Profile image asset.
- `created_at` / `updated_at` (`DateTimeField`): Automatic auditing timestamps.

#### 2. Department (`employees.models.Department`)
Represents an organizational business unit or department.
- `name` (`CharField`, max_length=100, unique=True, indexed): Canonical department name (e.g., *Engineering*, *Marketing*).
- `description` (`TextField`, blank=True): Department charter and functional scope.
- `created_at` / `updated_at` (`DateTimeField`): Audit timestamps.
- **Computed Properties:** `active_employees_count` dynamically aggregates active employees assigned to this department via `self.employees.filter(is_active=True).count()`.

#### 3. Employee (`employees.models.Employee`)
The central entity representing an individual staff member.
- `user` (`OneToOneField` -> `User`, `null=True`, `blank=True`, `SET_NULL`, `related_name='employee_profile'`): Links an employee to system login credentials.
- `department` (`ForeignKey` -> `Department`, `SET_NULL`, `null=True`, `related_name='employees'`): Organizational unit assignment.
- `manager` (`ForeignKey` -> `'self'`, `SET_NULL`, `null=True`, `blank=True`, `related_name='subordinates'`): Hierarchical supervisor.
- `employee_id` (`CharField`, max_length=20, unique=True, indexed): Enterprise badge ID (e.g., `EMP-1001`).
- `first_name`, `last_name` (`CharField`, max_length=100): Legal name fields.
- `email` (`EmailField`, unique=True, indexed): Professional communication email.
- `phone_number` (`CharField`, max_length=20): Primary telephone with regex format validation.
- `position` (`CharField`, max_length=100): Job title / designation.
- `hire_date` (`DateField`): First day of active employment.
- `birth_date` (`DateField`): Date of birth for age calculation and compliance.
- `employment_status` (`CharField`, choices: `FT` (Full-Time), `PT` (Part-Time), `CT` (Contract), `IN` (Intern)): Employment classification.
- `salary` (`DecimalField`, max_digits=10, decimal_places=2): Annual baseline compensation.
- `prior_experience_years` (`DecimalField`, default=0.0): Documented professional experience prior to joining.
- `annual_leave_days` (`PositiveIntegerField`, default=20): Contractual yearly paid leave entitlement.
- `bank_account`, `bank_name`, `tax_id` (`CharField`, blank=True): Payroll and tax disbursement metadata.
- `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation`: Crisis contact information.
- `is_active` (`BooleanField`, default=True, indexed): Enables safe soft-deletion without breaking foreign key integrity.
- **Computed Attributes:**
  - `full_name`: Combined first and last name.
  - `age`: Exact calculated chronological age.
  - `service_years`: Fractional years of tenure derived from `hire_date`.
  - `effective_experience_years`: Total sum of prior experience and current company tenure.
  - `salary_monthly`: Derived `salary / 12`.

#### 4. LeaveRequest (`employees.models.LeaveRequest`)
Manages the lifecycle of time-off requests.
- `employee` (`ForeignKey` -> `Employee`, `CASCADE`, `related_name='leave_requests'`): Staff applicant.
- `leave_type` (`CharField`, choices: `VL` (Vacation), `SL` (Sick), `PL` (Personal), `ML` (Maternity/Paternity), `UL` (Unpaid)).
- `start_date`, `end_date` (`DateField`): Inclusive date interval.
- `leave_days` (`PositiveIntegerField`): Working days consumed.
- `reason` (`TextField`): Justification provided by applicant.
- `status` (`CharField`, choices: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, default `PENDING`).
- `reviewer` (`ForeignKey` -> `User`, `SET_NULL`, `null=True`, `blank=True`): HR officer or manager who evaluated the request.
- `reviewed_at` (`DateTimeField`, null=True, blank=True): Timestamp of review action.
- `rejection_reason` (`TextField`, blank=True): Constructive explanation when a request is rejected.

#### 5. AttendanceRecord (`employees.models.AttendanceRecord`)
Daily timekeeping ledger for each workforce member.
- `employee` (`ForeignKey` -> `Employee`, `CASCADE`, `related_name='attendance_records'`).
- `date` (`DateField`, default `timezone.now`): Attendance calendar date.
- `check_in`, `check_out` (`TimeField`, null=True, blank=True): Physical or remote timestamps.
- `status` (`CharField`, choices: `PRESENT`, `LATE`, `ABSENT`, `LEAVE`, `REMOTE`, default `PRESENT`).
- `ip_address` (`GenericIPAddressField`, null=True, blank=True): Geo/network validation audit trail.
- `notes` (`CharField`, max_length=255, blank=True): Optional shift annotations.
- `work_hours` (`DecimalField`, max_digits=4, decimal_places=2, default=0.0): Total daily productive hours.
- **Database Constraint:** `unique_together = ('employee', 'date')` guarantees that an employee cannot have duplicate attendance records for the same day.

#### 6. Payslip (`employees.models.Payslip`)
Detailed monthly compensation ledger and pay breakdown.
- `employee` (`ForeignKey` -> `Employee`, `CASCADE`, `related_name='payslips'`).
- `year` (`PositiveIntegerField`), `month` (`PositiveIntegerField`, 1–12): Accounting period.
- `basic_salary` (`DecimalField`): Contractual base wage for the pay cycle.
- `allowances` (`DecimalField`, default 0.00): Housing, transport, or utility allowances.
- `bonuses` (`DecimalField`, default 0.00): Performance awards or milestone bonuses.
- `deductions` (`DecimalField`, default 0.00): Unpaid leave or benefit withholdings.
- `tax_deductions` (`DecimalField`, default 0.00): Mandatory state/income withholding taxes.
- `net_pay` (`DecimalField`): Server-computed net payout: `(basic_salary + allowances + bonuses) - (deductions + tax_deductions)`.
- `status` (`CharField`, choices: `DRAFT`, `APPROVED`, `PAID`, default `DRAFT`).
- `paid_at` (`DateTimeField`, null=True, blank=True): Disbursement execution date.
- **Database Constraint:** `unique_together = ('employee', 'year', 'month')` prevents double payroll disbursement.

#### 7. PerformanceReview (`employees.models.PerformanceReview`)
Semi-annual or annual talent assessment and competency review.
- `employee` (`ForeignKey` -> `Employee`, `CASCADE`, `related_name='performance_reviews'`).
- `reviewer` (`ForeignKey` -> `User`, `SET_NULL`, null=True, `related_name='conducted_reviews'`).
- `review_period` (`CharField`, max_length=50): Cadence identifier (e.g., `2026-H1`, `2026-Q3`).
- `review_date` (`DateField`, default `timezone.now`): Formal evaluation date.
- `job_knowledge`, `work_quality`, `communication`, `teamwork`, `initiative` (`PositiveSmallIntegerField`, 1–5): Structured competency metrics.
- `overall_rating` (`DecimalField`, max_digits=3, decimal_places=2): Normalized average across competencies.
- `strengths`, `areas_for_improvement`, `goals` (`TextField`): Qualitative feedback and growth targets.
- `status` (`CharField`, choices: `DRAFT`, `COMPLETED`, `ACKNOWLEDGED`, default `DRAFT`).
- `acknowledged_at` (`DateTimeField`, null=True, blank=True): When the employee officially acknowledged the assessment.

#### 8. Holiday (`employees.models.Holiday`)
Organizational paid holidays and scheduled calendar observances.
- `name` (`CharField`, max_length=150): Holiday title (e.g., *New Year's Day*, *Labor Day*).
- `date` (`DateField`): The observed holiday date.
- `description` (`TextField`, blank=True): Historical or cultural context.
- `is_recurring` (`BooleanField`, default=False): Flag indicating whether the date recurs annually.

#### 9. EmploymentEvent (`employees.models.EmploymentEvent`)
Chronological career milestone and audit log for each employee.
- `employee` (`ForeignKey` -> `Employee`, `CASCADE`, `related_name='timeline_events'`).
- `event_type` (`CharField`, choices: `HIRED`, `PROMOTED`, `SALARY_CHANGE`, `DEPARTMENT_TRANSFER`, `ROLE_CHANGE`, `STATUS_CHANGE`, `TERMINATED`).
- `event_date` (`DateField`, default `timezone.now`): Date event occurred.
- `notes` (`TextField`, blank=True): Details, previous title, new salary, or transfer notes.
- `recorded_by` (`ForeignKey` -> `User`, `SET_NULL`, null=True, blank=True): Audit author.

#### 10. EmployeeDocument (`employees.models.EmployeeDocument`)
Encrypted or secure file storage for official employee records.
- `employee` (`ForeignKey` -> `Employee`, `CASCADE`, `related_name='documents'`).
- `title` (`CharField`, max_length=200): Descriptive document title.
- `document_type` (`CharField`, choices: `CONTRACT`, `ID_PROOF`, `RESUME`, `CERTIFICATE`, `TAX_FORM`, `OTHER`).
- `file` (`FileField`, upload_to='employee_documents/%Y/%m/'): Document binary storage.
- `notes` (`TextField`, blank=True): Supplemental file metadata.
- `uploaded_by` (`ForeignKey` -> `User`, `SET_NULL`, null=True, blank=True): Audit track.

#### 11. Notification (`employees.models.Notification`)
In-app operational and system alert dispatch.
- `recipient` (`ForeignKey` -> `User`, `CASCADE`, `related_name='notifications'`).
- `sender` (`ForeignKey` -> `User`, `SET_NULL`, null=True, blank=True): Dispatched user.
- `title` (`CharField`, max_length=200): Notification heading.
- `message` (`TextField`): Body content.
- `notification_type` (`CharField`, choices: `LEAVE`, `ATTENDANCE`, `PAYSLIP`, `PERFORMANCE`, `SYSTEM`, `GENERAL`).
- `is_read` (`BooleanField`, default=False, indexed): Read state flag.
- `link` (`CharField`, max_length=255, blank=True): Client-side routing path (e.g., `/leaves/12`).

