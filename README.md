# Employee Management System (EMS)

A clean, modern, and role-based web application built with **Django** and **Bootstrap 5** to streamline workforce administration, manage organizational departments, and maintain accurate employee records.

---

## 📖 Description

The **Employee Management System (EMS)** is designed to assist HR teams, team leaders, and administrators in managing an organization's personnel data efficiently. It offers a secure, intuitive dashboard for handling day-to-day employee lifecycle tasks—from onboarding to record updates and safe archival.

### Key Features

- **User Authentication & Access Control:**
  - Secure login/logout system with session management.
  - Protected routes restricting access to authenticated staff members.
  - Automatic attribution tracking (`created_by` user for employee records).

- **Comprehensive Employee Records:**
  - **Personal Details:** Full name, email, phone number, date of birth, age (auto-calculated), gender, and residential address.
  - **Employment Details:** Unique Employee ID, department assignment, job position, hire date, employment status (*Full-time, Part-time, Contract, Intern*), and salary.

- **Dynamic Search & Filtering:**
  - Real-time text search across employee names, employee IDs, email addresses, and positions.
  - Department-based dropdown filtering for streamlined list viewing.

- **Full CRUD Capabilities:**
  - **Create:** Add new employee records with validation checks for duplicate email or employee ID.
  - **Read:** Dedicated profile overview with structured personal and professional information.
  - **Update:** Modify existing employee information through intuitive forms.
  - **Soft Delete:** Safe deactivation mechanism (`is_active=False`) preserving historical records without loss of database integrity.

- **Responsive & Polished Interface:**
  - Built using **Bootstrap 5**, **Bootstrap Icons**, and **Crispy Forms** for a clean, mobile-friendly experience.
  - Interactive toast/alert messages for system feedback and action confirmations.

---

## 🛠️ Technology Stack

- **Backend:** Python 3.10+, Django 5.x
- **Frontend:** HTML5, CSS3, Bootstrap 5, Bootstrap Icons, JavaScript
- **Forms & UI Integration:** `django-crispy-forms`, `crispy-bootstrap5`
- **Database:** SQLite (default for development; easily configurable to PostgreSQL/MySQL)

---

## 🚀 How to Run It

Follow the step-by-step instructions below to set up and run the project locally on your machine.

### Prerequisites

Ensure you have the following installed on your system:
- [Python 3.10+](https://www.python.org/downloads/)
- `pip` (Python package installer)
- `git` (optional, for version control)

---

### Step 1: Clone or Navigate to the Project Directory

```bash
cd /path/to/PRODIGY_FS_02
```

---

### Step 2: Create and Activate a Virtual Environment

It is recommended to use an isolated Python virtual environment:

- **On Linux / macOS:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

- **On Windows (Command Prompt):**
  ```cmd
  python -m venv venv
  venv\Scripts\activate
  ```

- **On Windows (PowerShell):**
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```

---

### Step 3: Install Required Dependencies

Install the project dependencies using `pip`:

```bash
pip install -r requirements.txt
```

---

### Step 4: Apply Database Migrations

Generate and run the database migrations to set up the SQLite database schema:

```bash
python manage.py makemigrations employees
python manage.py migrate
```

---

### Step 5: Create a Superuser (Admin Account)

To access the Django Admin panel and log into the system, create an administrator account:

```bash
python manage.py createsuperuser
```
Follow the prompts to enter a **username**, **email address**, and **password**.

---

### Step 6: Start the Development Server

Launch the Django development server:

```bash
python manage.py runserver
```

You should see output indicating that the server is running at `http://127.0.0.1:8000/`.

---

### Step 7: Open the Application in Your Browser

1. Navigate to: **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**
2. Log in using the superuser credentials created in Step 5.
3. Once logged in, you will be redirected to the **Employee Dashboard** (`/employees/`).

> **Tip:** You can visit **[http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/)** to manage Departments, Users, and groups directly through the Django Admin interface.

---

## 📁 Project Directory Structure

```text
PRODIGY_FS_02/
├── employee_system/          # Core Django project configuration
│   ├── __init__.py
│   ├── asgi.py
│   ├── settings.py           # Application settings, installed apps, crispy config
│   ├── urls.py               # Main URL routing
│   └── wsgi.py
├── employees/                # Employee management app
│   ├── admin.py              # Admin model registrations
│   ├── apps.py
│   ├── forms.py              # Login, employee create, and update forms
│   ├── models.py             # Department and Employee data models
│   ├── urls.py               # Employee routing (CRUD, login/logout)
│   └── views.py              # Business logic for authentication & CRUD
├── templates/                # HTML templates styled with Bootstrap 5
│   ├── base.html             # Base layout template with navbar and scripts
│   ├── employee_confirm_delete.html
│   ├── employee_detail.html
│   ├── employee_form.html
│   ├── employee_list.html
│   └── login.html
├── manage.py                 # Django command-line utility
├── requirements.txt          # Python dependencies
└── README.md                 # Project documentation
```

---

## 📄 License

This project was developed for educational and portfolio demonstration purposes.
