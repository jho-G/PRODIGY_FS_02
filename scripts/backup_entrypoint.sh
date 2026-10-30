#!/usr/bin/env sh
# ==============================================================================
# Employee Management System — Containerized Backup Entrypoint (Phase 4.3)
# ==============================================================================
# Sets up scheduled periodic database backups using crond in Alpine.
# ==============================================================================

set -eu

BACKUP_SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-ems_user}"
POSTGRES_DB="${POSTGRES_DB:-ems_db}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Initializing automated database backup service..."
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Schedule: ${BACKUP_SCHEDULE}"
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Target: ${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Destination directory: ${BACKUP_DIR}"

mkdir -p "${BACKUP_DIR}"

# Wait for PostgreSQL to become fully ready
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Waiting for PostgreSQL database to be reachable..."
until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"; do
    sleep 3
done
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] PostgreSQL is reachable."

# Run an initial backup immediately upon startup
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Executing initial startup backup..."
/usr/local/bin/backup_db.sh || echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Initial backup completed with warnings."

# Write cron schedule file into /etc/crontabs/root
echo "${BACKUP_SCHEDULE} /usr/local/bin/backup_db.sh >> /var/log/cron_backup.log 2>&1" > /etc/crontabs/root

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting crond background daemon in foreground mode..."
exec crond -f -d 8
