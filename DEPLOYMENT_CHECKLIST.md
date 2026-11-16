# Production Deployment & Client Handover Checklist

This document serves as the authoritative, step-by-step production runbook for deploying and operating the **Employee Management System (EMS)**.

---

## 1. Pre-Deployment Environment Setup

### 1.1 Generate Cryptographically Strong Secrets
Never use development secrets in production. Generate a high-entropy `SECRET_KEY`:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

### 1.2 Configure `.env` File
Copy `.env.example` to `.env` on your production host:
```bash
cp .env.example .env
chmod 600 .env
```
Ensure the following variables are strictly set:
* `DEBUG=False`
* `SECRET_KEY=<your-generated-64-character-token>`
* `ALLOWED_HOSTS=yourcompany.com,www.yourcompany.com`
* `CSRF_TRUSTED_ORIGINS=https://yourcompany.com,https://www.yourcompany.com`
* `CORS_ALLOWED_ORIGINS=https://yourcompany.com,https://www.yourcompany.com`
* `DATABASE_URL=postgres://ems_user:<secure_db_password>@db:5432/ems_db`
* `SECURE_SSL_REDIRECT=True`
* `SESSION_COOKIE_SECURE=True`
* `CSRF_COOKIE_SECURE=True`

---

## 2. SSL / TLS Certificate Configuration

### 2.1 Domain Certificates (Let's Encrypt / Production CA)
Mount valid production certificates into `frontend/ssl/`:
* `frontend/ssl/cert.pem`: Full certificate chain
* `frontend/ssl/key.pem`: Private key

Ensure restrictive permissions:
```bash
chmod 600 frontend/ssl/key.pem
chmod 644 frontend/ssl/cert.pem
```

### 2.2 Staging / Internal IP Deployment
If deploying to an internal server or IP address, generate a self-signed certificate with Subject Alternative Names (SAN):
```bash
./generate-ssl.sh yourcompany.internal
```

---

## 3. Database Preparation & Migration

### 3.1 Run PostgreSQL Database Service
Ensure PostgreSQL 16+ is running and healthy:
```bash
docker compose up -d db
```

### 3.2 Apply Database Schema Migrations
Run schema migrations inside the backend container or virtual environment:
```bash
docker compose run --rm backend python manage.py migrate
```

---

## 4. Pre-Flight Verification & Security Auditing

Before exposing the application to public or internal traffic, execute automated validation checks:

### 4.1 Django Production Deployment Check
Run Django's built-in deployment security auditor:
```bash
docker compose run --rm backend python manage.py check --deploy
```
*Expected Result:* `System check identified no issues (0 silenced).`

### 4.2 EMS Pre-Flight Verification Command
Run the specialized EMS deployment verification command:
```bash
docker compose run --rm backend python manage.py verify_deployment --strict
```
This command automatically validates:
* `DEBUG=False` enforcement
* `SECRET_KEY` entropy and blacklist check
* `ALLOWED_HOSTS` configuration (no wildcards)
* Live PostgreSQL database connectivity
* Unapplied migration check
* Active superuser existence (prevents administrative lockout)
* HTTPS-only cookie & HSTS configurations

---

## 5. Demo Data Cleanup (Client Handover)

If the staging environment contains test employees, demo payroll records, or dummy attendance logs, use the cleanup utility:

### 5.1 Preview Records to Purge (Dry Run)
```bash
docker compose run --rm backend python manage.py purge_test_data --dry-run
```

### 5.2 Purge Test Records
```bash
docker compose run --rm backend python manage.py purge_test_data --confirm
```
*(By default, this preserves department structure and superuser administrative accounts).*

---

## 6. Create Initial Client Superuser

Create the master administrator account for the client:
```bash
docker compose run --rm backend python manage.py createsuperuser
```
Follow the interactive prompt to set the username, corporate email, and secure password.

---

## 7. Starting Production Services

Launch all services with Docker Compose in detached mode:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Or with standard compose:
```bash
docker compose up -d --build
```

Verify service status:
```bash
docker compose ps
```

---

## 8. Health Check & Reverse Proxy Verification

Verify that all endpoints and health checks respond normally:

1. **Backend Health Check:**
   ```bash
   curl -k https://localhost/api/health/
   ```
   *Expected Response:* `{"status":"ok","database":"connected"}`

2. **Security Headers Verification:**
   ```bash
   curl -k -I https://localhost/
   ```
   *Verify presence of:*
   * `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
   * `X-Content-Type-Options: nosniff`
   * `X-Frame-Options: SAMEORIGIN`
   * `Content-Security-Policy`

---

## 9. Automated Backups & Disaster Recovery

### 9.1 Test Manual Backup
```bash
./scripts/backup_db.sh
```
Backups are saved to `./backups/ems_backup_<db>_<timestamp>.sql.gz` alongside SHA-256 integrity checksums.

### 9.2 Configure Nightly Backup Cron Job
Add the following entry to the system `crontab` (`crontab -e`):
```cron
# Run daily database backup at 02:00 AM UTC
0 2 * * * cd /opt/ems && ./scripts/backup_db.sh >> /var/log/ems_backup.log 2>&1
```

### 9.3 Configure Offsite / Cloud Replication (Optional)
Set `BACKUP_OFFSITE_CMD` in `.env` to automatically replicate backups to Amazon S3, Google Cloud Storage, or Azure Blob:
```env
BACKUP_OFFSITE_CMD="aws s3 cp {BACKUP_FILE} s3://my-company-ems-backups/daily/"
```

### 9.4 Disaster Recovery & Database Restoration
In case of server migration or data recovery:
```bash
./scripts/restore_db.sh backups/ems_backup_ems_db_YYYYMMDD_HHMMSS.sql.gz
```
The script validates SHA-256 checksum integrity, checks database readiness via `pg_isready`, and requires confirmation before executing the restore.

---

## 10. Handover Sign-Off

| Milestone | Verified By | Date | Notes |
| :--- | :--- | :--- | :--- |
| Environment variables validated & hardened | | | |
| Production SSL certificates installed | | | |
| `check --deploy` passed with 0 issues | | | |
| `verify_deployment --strict` passed | | | |
| Demo data purged & initial superuser created | | | |
| Nightly database backup cron configured | | | |
| Admin credentials securely transferred to client | | | |
