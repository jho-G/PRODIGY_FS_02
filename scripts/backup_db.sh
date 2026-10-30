#!/usr/bin/env bash
# ==============================================================================
# Employee Management System — Database Backup Script (Phase 4.3)
# ==============================================================================
# Usage:
#   ./scripts/backup_db.sh
#
# Environment variables:
#   BACKUP_DIR        Directory where backups are saved (default: ./backups)
#   POSTGRES_HOST     Database host (default: localhost, or db in Docker)
#   POSTGRES_PORT     Database port (default: 5432)
#   POSTGRES_USER     Database user (default: ems_user)
#   POSTGRES_PASSWORD Database password (default: ems_secure_password)
#   POSTGRES_DB       Database name (default: ems_db)
#   BACKUP_KEEP_DAYS  Number of days to keep backups (default: 14)
# ==============================================================================

set -euo pipefail

# Configuration with defaults
BACKUP_DIR="${BACKUP_DIR:-./backups}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-ems_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-ems_secure_password}"
POSTGRES_DB="${POSTGRES_DB:-ems_db}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILENAME="ems_backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting database backup for '${POSTGRES_DB}' on ${POSTGRES_HOST}:${POSTGRES_PORT}..."

export PGPASSWORD="${POSTGRES_PASSWORD}"

# Execute pg_dump and pipe through gzip
if pg_dump \
    -h "${POSTGRES_HOST}" \
    -p "${POSTGRES_PORT}" \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    | gzip -9 > "${BACKUP_FILEPATH}"; then

    BACKUP_SIZE="$(du -h "${BACKUP_FILEPATH}" | cut -f1)"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup completed successfully: ${BACKUP_FILENAME} (${BACKUP_SIZE})"

    # Generate SHA-256 checksum for backup integrity verification
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "${BACKUP_FILEPATH}" > "${BACKUP_FILEPATH}.sha256"
        echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Generated checksum: ${BACKUP_FILENAME}.sha256"
    fi

    # Prune backups older than BACKUP_KEEP_DAYS
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Pruning backups older than ${BACKUP_KEEP_DAYS} days in ${BACKUP_DIR}..."
    DELETED_COUNT="$(find "${BACKUP_DIR}" -maxdepth 1 -name "ems_backup_*.sql.gz*" -type f -mtime +"${BACKUP_KEEP_DAYS}" -print -delete | wc -l)"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Pruned ${DELETED_COUNT} expired backup file(s)."
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup and retention lifecycle finished successfully."
else
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] ERROR: Database backup failed!" >&2
    rm -f "${BACKUP_FILEPATH}"
    exit 1
fi
