# Employee Management System (EMS) — Full-Stack App (Django + React)

A robust, production-hardened full-stack Employee Management System built with **Django REST Framework** (backend) and **React + Vite** (frontend). Features **JWT authentication** with access/refresh token rotation, role-based access control, rate limiting, security headers, CORS protection, and a rich HR feature set — all containerized with Docker.

---

## 📖 Description

The **Employee Management System (EMS)** backend is designed for HR personnel, team leaders, and administrators to handle workforce data efficiently. The architecture has transitioned away from traditional server-rendered HTML templates into a decoupled, modern API service utilizing Django REST Framework.

### Key Features

- **Decoupled RESTful Architecture:**
  - Standardized JSON responses for all resources.
  - CORS-enabled (`django-cors-headers`) for seamless connection with frontend single-page applications (React.js).
  - Django REST Framework's interactive Browsable API for in-browser testing and exploration.

- **Authentication & Security:**
  - **JWT Authentication** (`djangorestframework-simplejwt`): short-lived access tokens (15 min) + long-lived refresh tokens (7 days) with automatic rotation and blacklisting on logout.
  - **Custom JWT claims**: role, username, email, and employee_id are embedded in the token payload — no extra roundtrips needed.
  - **Rate limiting**: `django-ratelimit` (5 attempts/min/IP on login) + DRF throttling (100/day anonymous, 2000/day authenticated).
  - **Security headers**: HSTS, X-Frame-Options (DENY), X-Content-Type-Options, XSS protection.
  - **Env-based config**: `python-decouple` — no secrets hardcoded; all settings driven from `.env` (see `.env.example`).
  - **Strict CORS**: only explicit allowed origins in production; `CORS_ALLOW_ALL_ORIGINS` only in development.
  - Automatic attribution: each employee record tracks who created it (`created_by`).

- **Department & Employee Resource Management:**
  - **Departments:** Full CRUD for organizational departments with computed active employee counts.
  - **Employees:** Full CRUD supporting rich personal and employment profiles (unique Employee IDs, email validation, phone regex, age calculation, employment status, salary).

- **Advanced Querying & Metrics:**
  - Search across first name, last name, employee ID, email, and position.
  - Filter by department ID, employment status (`FT`, `PT`, `CT`, `IN`), and active status.
  - Safe soft-delete (`is_active=False`) with a dedicated `/restore/` endpoint and optional hard deletion (`?hard=true`).
  - Aggregated metrics endpoint (`/api/employees/stats/`) delivering dashboard-ready analytics.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Backend Framework** | Django 5.x, Django REST Framework 3.15+ |
| **Authentication** | `djangorestframework-simplejwt` (JWT access + refresh tokens) |
| **Rate Limiting** | `django-ratelimit` + DRF throttling |
| **Environment Config** | `python-decouple` |
| **CORS** | `django-cors-headers` |
| **Database** | SQLite (dev) · PostgreSQL-compatible |
| **Frontend** | React 18 + Vite |
| **Web Server** | Nginx (reverse proxy + SSL termination) |
| **App Server** | Gunicorn (multi-worker) |
| **Containerization** | Docker + Docker Compose |
| **Language** | Python 3.11+, JavaScript (ES2022) |

---

## 🔐 Security & Authentication

### JWT Authentication Flow

This project uses **JSON Web Tokens** (via `djangorestframework-simplejwt`) instead of the legacy DRF Token auth.

```
Client              Backend
  │                    │
  │─── POST /api/auth/login/ {username, password} ──→│
  │←── {access, refresh, user} ─────────────────────│
  │                    │
  │   (access token expires in 15 min)
  │                    │
  │─── POST /api/auth/token/refresh/ {refresh} ──────→│
  │←── {access, refresh} ──────────────────────────  │
  │                    │
  │   (refresh token expires in 7 days)
  │   (old refresh is blacklisted — cannot be reused)
  │                    │
  │─── POST /api/auth/logout/ {refresh} ─────────────→│
  │←── {message: "Logged out successfully."} ─────── │
```

### Auth API Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|--------------|-------------|
| `POST` | `/api/auth/login/` | ❌ | Exchange credentials for JWT pair |
| `POST` | `/api/auth/token/refresh/` | ❌ | Rotate refresh → new access token |
| `POST` | `/api/auth/token/verify/` | ❌ | Validate any token |
| `POST` | `/api/auth/logout/` | ✅ Bearer | Blacklist refresh token |
| `GET` | `/api/auth/user/` | ✅ Bearer | Current user info |
| `GET` | `/api/auth/me/` | ✅ Bearer | Full employee self-service profile |

### Environment Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | — | Django secret key (generate with `python -c "import secrets; print(secrets.token_urlsafe(50))"`) |
| `DEBUG` | `False` | Enable Django debug mode |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated allowed hosts |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` | `15` | Access token lifetime in minutes |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | `7` | Refresh token lifetime in days |
| `CORS_ALLOWED_ORIGINS` | — | Comma-separated allowed frontend origins (prod) |
| `SECURE_SSL_REDIRECT` | `False` | Redirect HTTP → HTTPS in production |

### Rate Limiting

- **Login endpoint**: max **5 attempts per minute per IP** (`django-ratelimit`). Returns `429 Too Many Requests` when exceeded.
- **All anonymous endpoints**: **100 requests/day** (DRF throttling).
- **Authenticated endpoints**: **2000 requests/day** per user.

---

## 🚀 How to Run the Backend

Follow these step-by-step instructions to set up and run the Django DRF backend server locally.

### Prerequisites

- [Python 3.10+](https://www.python.org/downloads/)
- `pip` package manager
- Virtual environment tool (`venv`)

---

### Step 1: Navigate to the Project Directory

```bash
cd /path/to/PRODIGY_FS_02
```

---

### Step 2: Create and Activate a Virtual Environment

- **Linux / macOS:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

- **Windows (Command Prompt):**
  ```cmd
  python -m venv venv
  venv\Scripts\activate
  ```

- **Windows (PowerShell):**
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```

---

### Step 3: Install Required Dependencies

```bash
pip install -r requirements.txt
```

---

### Step 4: Apply Database Migrations

Create and run database migrations to prepare the database schema and authentication tables:

```bash
python manage.py makemigrations employees
python manage.py migrate
```

---

### Step 5: Create an Admin / Superuser Account

Create an administrative user to log in and obtain an authentication token:

```bash
python manage.py createsuperuser
```
Provide a **username**, **email**, and **password** when prompted.

---

### Step 6: Start the Development Server

Make sure your virtual environment is active (your prompt should show `(venv)`):

```bash
python manage.py runserver
```

> **Note:** If `python` gives `command not found` (e.g. with `pyenv`), either activate your virtual environment (`source venv/bin/activate`), set your pyenv version (`pyenv local 3.11.9`), or run with `python3 manage.py runserver`.

The API will be accessible at: **`http://127.0.0.1:8000/api/`**

---

### ⚠️ Troubleshooting Common Setup Errors

- **`pyenv: python: command not found`**
  - **Reason:** Pyenv is managing your Python versions, but no local/global version is active, or the virtual environment has not been activated.
  - **Fix 1 (Activate Virtual Environment):**
    ```bash
    source venv/bin/activate
    ```
    *(Once activated, `python` will point directly to your virtual environment's Python interpreter).*
  - **Fix 2 (Set Pyenv Version):**
    ```bash
    pyenv local 3.11.9
    ```
  - **Fix 3 (Direct python3 invocation):**
    ```bash
    python3 manage.py runserver
    ```

---

## 🖥️ Running the Frontend (Development Mode)

The React frontend is a **Vite** app. For active development, run the Django backend and the Vite dev server side-by-side with hot reload.

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- `npm`

### Step 1: Start the Backend First

With your virtual environment active and migrations applied (see backend steps above), run in one terminal:

```bash
python manage.py runserver
```

The API will be available at `http://127.0.0.1:8000/api/`.

### Step 2: Install Frontend Dependencies

In a **second terminal**:

```bash
cd frontend
npm install
```

### Step 3: Start the Vite Dev Server

```bash
npm run dev
```

The app will open at **[https://localhost:5173](https://localhost:5173)** (Vite will serve HTTPS because dev certificates exist in `frontend/ssl/`; visit `http://localhost:5173` if your browser blocks the self-signed cert).

> **Note — API base URL:** The frontend reads `VITE_API_URL` from `frontend/.env` (see `src/api/client.js`) and falls back to `http://127.0.0.1:8000/api/`. In dev mode you normally don't need to set anything — just make sure the Django server is running. If your API runs elsewhere, create `frontend/.env`:
>
> ```env
> VITE_API_URL=http://127.0.0.1:8000/api/
> ```

### Step 4: Log In

Open the app in your browser and sign in with the superuser credentials created in **Step 5** of the backend setup (or see the Mock Data section below to seed demo employees first).

### Useful Frontend Commands

```bash
cd frontend
npm run dev      # start Vite dev server with hot reload
npm run build    # production build (outputs to dist/)
npm run preview  # preview the production build locally
npm run lint     # lint with oxlint
```

### 🔍 Verifying Both Apps Are Running

| Check | How | Expected |
|---|---|---|
| Backend API | Open `http://127.0.0.1:8000/api/` | DRF Browsable API page (JSON/HTML) |
| Backend admin | Open `http://127.0.0.1:8000/admin/` | Django admin login page |
| Frontend | Open the Vite URL (`https://localhost:5173`) | React login page renders |
| End-to-end | Log in via the React app | Redirects to Dashboard with live stats |

You can also smoke-test the API from the terminal:

```bash
# Login request (returns your auth token)
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "<your_username>", "password": "<your_password>"}'

# List employees using the token from the login response
curl http://127.0.0.1:8000/api/employees/ \
  -H "Authorization: Token <your_token_here>"
```

---

## ✅ Running the Test Suite

The backend ships with a full API and model test suite in `employees/tests.py` covering authentication, departments, employees, leave requests, attendance, payslips, and performance reviews.

### Run Backend Tests

With your virtual environment active:

```bash
python manage.py test employees -v 2
```

Expected output ends with:

```text
OK
```

### Lint the Frontend

```bash
cd frontend
npm run lint
```

### Verify a Production Build Compiles

```bash
cd frontend
npm run build
```

A successful build finishes with `✓ built in <time>` and writes static assets to `frontend/dist/`.

---

## 🐳 Running with Docker (Recommended)

The full-stack Employee Management System is fully containerized using **Docker** and **Docker Compose**, providing a production-ready, zero-configuration setup for both the backend and frontend.

### Container Architecture

- **`ems_backend` (Django DRF):** Runs on Python 3.11-slim, auto-applies migrations on startup, persists data via SQLite volume mount, and exposes port `8000`.
- **`ems_frontend` (React + Nginx):** Uses a multi-stage Docker build (`node:20-alpine` -> `nginx:alpine`). Nginx serves optimized production static assets and reverse-proxies `/api/` and `/admin/` requests to the backend container.

### Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

---

### Step-by-Step Instructions

#### 1. Build and Start All Services

From the project root directory, run:

```bash
docker-compose up --build
```

> **Tip:** Add the `-d` flag to run in detached (background) mode:
> ```bash
> docker-compose up --build -d
> ```

#### 2. Access the Application

Once the build finishes and containers start:
- 🌐 **React Frontend Application:** [http://localhost:5173](http://localhost:5173) or [http://localhost](http://localhost)
- 📡 **Django REST API Root:** [http://localhost:8000/api/](http://localhost:8000/api/)
- ⚙️ **Django Administration Panel:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

### Useful Docker Commands

#### Create an Administrative User in Docker

Create a superuser directly inside the running backend container to log in via the React frontend or Django admin:

```bash
docker-compose exec backend python manage.py createsuperuser
```

#### View Live Container Logs

```bash
# View logs from all services
docker-compose logs -f

# View logs from only the backend
docker-compose logs -f backend

# View logs from only the frontend
docker-compose logs -f frontend
```

#### Run Database Migrations Manually

```bash
docker-compose exec backend python manage.py migrate
```

#### Stop All Services

```bash
docker-compose down
```

#### Rebuild Services After Code Changes

```bash
docker-compose up --build
```

---

## 📡 API Reference & Endpoints

Base URL: `http://127.0.0.1:8000/api/`

### 1. Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/login/` | Authenticate with `username` & `password`. Returns auth `token` and user profile. | No |
| `POST` | `/api/auth/logout/` | Invalidate and delete current auth token. | Yes |
| `GET` | `/api/auth/user/` | Retrieve current authenticated user profile. | Yes |

#### Authentication Header
Include the token in request headers for protected endpoints:
```http
Authorization: Token <your_token_key_here>
```

---

### 2. Department Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/departments/` | List all departments (includes active employee count). |
| `POST` | `/api/departments/` | Create a new department (`name`, `description`). |
| `GET` | `/api/departments/{id}/` | Retrieve department details. |
| `PUT` / `PATCH` | `/api/departments/{id}/` | Update department details. |
| `DELETE` | `/api/departments/{id}/` | Delete a department. |

---

### 3. Employee Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/employees/` | List employees (paginated, supports search and filtering). |
| `POST` | `/api/employees/` | Create a new employee record. |
| `GET` | `/api/employees/{id}/` | Retrieve employee full profile (includes computed age, service years, and effective experience). |
| `PUT` / `PATCH` | `/api/employees/{id}/` | Update employee information. |
| `DELETE` | `/api/employees/{id}/` | Soft delete employee (`is_active=False`). Use `?hard=true` for permanent delete. |
| `POST` | `/api/employees/{id}/restore/` | Restore a deactivated employee. |
| `GET` | `/api/employees/stats/` | Retrieve aggregate workforce metrics for dashboard display. |
| `GET` | `/api/employees/export/` | Download the filtered employee directory as CSV. |

#### Query Parameters for `/api/employees/`
- `?search=<term>`: Search across `first_name`, `last_name`, `employee_id`, `email`, and `position`.
- `?department=<id>`: Filter by department ID.
- `?employment_status=<FT|PT|CT|IN>`: Filter by employment status.
- `?min_salary=<n>` / `?max_salary=<n>`: Filter by annual salary range.
- `?min_experience=<years>`: Only employees whose total experience (prior + service) meets the threshold.
- `?is_active=<true|false>`: Filter by active/inactive state (default: `true`).
- `?all=true`: Return all records regardless of active status.
- `?ordering=<field>`: Order results (e.g. `ordering=-created_at`, `ordering=salary`, `ordering=salary_monthly`).
- `?page=<number>`: Page navigation.

---

### 4. Leave Request Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/leaves/` | List leave requests (filter by `employee`, `status`, `leave_type`). |
| `POST` | `/api/leaves/` | Submit a new leave request. |
| `GET` / `PUT` / `PATCH` / `DELETE` | `/api/leaves/{id}/` | Standard leave record operations. |
| `POST` | `/api/leaves/{id}/approve/` | Approve a pending request (records reviewer). |
| `POST` | `/api/leaves/{id}/reject/` | Reject a pending request. |
| `POST` | `/api/leaves/{id}/cancel/` | Cancel an approved request. |

Leave types: `VL` (Vacation), `SL` (Sick), `PL` (Personal), `ML` (Maternity/Paternity), `UL` (Unpaid).

---

### 5. Attendance Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/attendance/` | List attendance records (filter by `employee`, `date`, `date_after`, `date_before`, `status`). |
| `POST` | `/api/attendance/` | Create a daily attendance record (one per employee/day). |
| `POST` | `/api/attendance/{id}/check_in/` | Record the check-in time. |
| `POST` | `/api/attendance/{id}/check_out/` | Record the check-out time. |
| `GET` | `/api/attendance/summary/?year=&month=` | Per-employee attendance counts for a month. |

Statuses: `PRESENT`, `LATE` (auto-flagged after 09:00 check-in), `ABSENT`, `LEAVE`, `REMOTE`.

---

### 6. Payroll (Payslip) Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/payslips/` | List payslips (filter by `employee`, `department`, `year`, `month`). |
| `POST` | `/api/payslips/` | Create a single payslip (`net_pay` is derived server-side). |
| `PUT` / `PATCH` / `DELETE` | `/api/payslips/{id}/` | Standard payslip operations. |
| `POST` | `/api/payslips/generate/` | Bulk-generate payslips for all active employees for a period (`year`, `month`). |
| `GET` | `/api/payslips/summary/?year=&month=` | Aggregate gross/net/tax totals for payroll dashboards. |

---

### 7. Performance Review Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/performance-reviews/` | List reviews (filter by `employee`, `department`, `status`, `review_period`). |
| `POST` | `/api/performance-reviews/` | Create a draft review with 1–5 competency scores. |
| `PUT` / `PATCH` / `DELETE` | `/api/performance-reviews/{id}/` | Standard review operations. |
| `POST` | `/api/performance-reviews/{id}/complete/` | Mark a draft as completed (records the reviewer). |
| `POST` | `/api/performance-reviews/{id}/acknowledge/` | Employee acknowledges a completed review. |
| `GET` | `/api/performance-reviews/summary/` | Rating distribution, top performers, and department averages. |

---

## 🌱 Mock Data

Populate the database with a realistic mock workforce for development and demos:

```bash
python manage.py seed_employees            # 60 employees if DB is empty
python manage.py seed_employees --force    # wipe and reseed
python manage.py seed_employees --count 100 --force
```

The seeder creates 7 departments plus employees with randomized names, positions, salaries, prior experience, emergency contacts, and hire dates; ~15 leave requests across the approval workflow; 30 days of attendance records (weekdays only, with late/absent/remote distributions); three months of payslips with variable allowances, bonuses, and deductions; and performance reviews across two review periods.

---

## 📁 Project Structure

```text
PRODIGY_FS_02/
├── Dockerfile                  # Django backend Docker container configuration
├── .dockerignore               # Backend Docker build exclusion rules
├── docker-compose.yml          # Orchestrates backend & frontend containers
├── manage.py                   # Django management script
├── requirements.txt            # Python dependencies (Django, DRF, CORS)
├── db.sqlite3                  # SQLite database (persisted via Docker volume)
├── README.md                   # Project documentation
├── employee_system/            # Django root configuration
│   ├── settings.py             # DRF, CORS, Auth token & Database config
│   ├── urls.py                 # Root URL routing (/api/ & /admin/)
│   └── wsgi.py
├── employees/                  # Employee management API app
│   ├── models.py               # Department, Employee, LeaveRequest, AttendanceRecord, Payslip, PerformanceReview
│   ├── serializers.py          # DRF serializers for all resources
│   ├── urls.py                 # DRF DefaultRouter and auth routing
│   ├── admin.py                # Django admin registrations for all models
│   ├── tests.py                # API & model test suite for all EMS resources
│   ├── management/commands/seed_employees.py  # Mock data seeder
│   └── views.py                # ViewSets (Employee, Department, Leave, Attendance, Payslip, PerformanceReview) and Auth APIViews
└── frontend/                   # React Single Page Application (Vite)
    ├── Dockerfile              # Multi-stage build (Node 20 -> Nginx Alpine)
    ├── nginx.conf              # Nginx reverse proxy & SPA router config
    ├── .dockerignore           # Frontend Docker build exclusions
    ├── package.json            # React, Vite, Axios, React Router, Lucide
    └── src/
        ├── api/                # Axios client, interceptors, and endpoints
        ├── context/            # AuthContext (token & user state management)
        ├── components/         # ProtectedRoute, Layout, EmployeeModal, EmployeeDetailModal
        └── pages/              # Login, Dashboard, Employees, Departments, Leave, Attendance, Payroll, Performance
```
