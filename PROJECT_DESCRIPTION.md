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
