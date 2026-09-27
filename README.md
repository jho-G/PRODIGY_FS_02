# Employee Management System (EMS) — Backend API (Django & DRF)

A robust, scalable RESTful API built with **Django** and **Django REST Framework (DRF)** to power an Employee Management System. This API serves as the core backend service, featuring token-based authentication, CRUD operations, dynamic search, multi-criteria filtering, soft-delete capabilities, and statistical metrics ready for integration with a **React.js** frontend.

---

## 📖 Description

The **Employee Management System (EMS)** backend is designed for HR personnel, team leaders, and administrators to handle workforce data efficiently. The architecture has transitioned away from traditional server-rendered HTML templates into a decoupled, modern API service utilizing Django REST Framework.

### Key Features

- **Decoupled RESTful Architecture:**
  - Standardized JSON responses for all resources.
  - CORS-enabled (`django-cors-headers`) for seamless connection with frontend single-page applications (React.js).
  - Django REST Framework's interactive Browsable API for in-browser testing and exploration.

- **Authentication & Security:**
  - Token-based authentication (`rest_framework.authtoken`) for secure API client access.
  - Endpoints for user login, logout, and fetching current authenticated profile data.
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

- **Framework:** Django 5.x, Django REST Framework (DRF) 3.15+
- **CORS Handling:** `django-cors-headers`
- **Authentication:** Token & Session Authentication (`rest_framework.authtoken`)
- **Database:** SQLite (default for development; compatible with PostgreSQL/MySQL)
- **Language:** Python 3.10+

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
| `GET` | `/api/employees/{id}/` | Retrieve employee full profile (includes computed age). |
| `PUT` / `PATCH` | `/api/employees/{id}/` | Update employee information. |
| `DELETE` | `/api/employees/{id}/` | Soft delete employee (`is_active=False`). Use `?hard=true` for permanent delete. |
| `POST` | `/api/employees/{id}/restore/` | Restore a deactivated employee. |
| `GET` | `/api/employees/stats/` | Retrieve aggregate workforce metrics for dashboard display. |

#### Query Parameters for `/api/employees/`
- `?search=<term>`: Search across `first_name`, `last_name`, `employee_id`, `email`, and `position`.
- `?department=<id>`: Filter by department ID.
- `?employment_status=<FT|PT|CT|IN>`: Filter by employment status.
- `?is_active=<true|false>`: Filter by active/inactive state (default: `true`).
- `?all=true`: Return all records regardless of active status.
- `?ordering=<field>`: Order results (e.g. `ordering=-created_at`, `ordering=salary`).
- `?page=<number>`: Page navigation.

---

## 📁 Project Structure

```text
PRODIGY_FS_02/
├── employee_system/          # Project configuration
│   ├── __init__.py
│   ├── asgi.py
│   ├── settings.py           # DRF, CORS, Auth token & Database config
│   ├── urls.py               # Root URL configuration (/api/ & /admin/)
│   └── wsgi.py
├── employees/                # Employee management API app
│   ├── admin.py              # Django admin registration
│   ├── apps.py
│   ├── models.py             # Department and Employee models
│   ├── serializers.py        # DRF serializers (Employee, Department, User, Login)
│   ├── urls.py               # DRF routers and auth endpoint routing
│   └── views.py              # ViewSets (Employee, Department) and Auth APIViews
├── manage.py                 # Django management utility
├── requirements.txt          # Dependencies (Django, DRF, django-cors-headers)
└── README.md                 # Project documentation
```

---

## 🔮 Next Phase

In the upcoming phase, the modern **React.js** frontend will be integrated with these endpoints to provide a dynamic Single Page Application (SPA) dashboard.
