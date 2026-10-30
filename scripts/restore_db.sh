#!/usr/bin/env bash
# ==============================================================================
# Employee Management System — Database Restore Script (Phase 4.3)
# ==============================================================================
# Usage:
#   ./scripts/restore_db.sh <path_to_backup.sql.gz> [--yes]
#
# Environment variables:
#   POSTGRES_HOST     Database host (default: localhost, or db in Docker)
#   POSTGRES_PORT     Database port (default: 5432)
#   POSTGRES_USER     Database user (default: ems_user)
#   POSTGRES_PASSWORD Database password (default: ems_secure_password)
#   POSTGRES_DB       Database name (default: ems_db)
# ==============================================================================

set -euo pipefail

# Help flag
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" || -z "${1:-}" ]]; then
    echo "Usage: $0 <path_to_backup.sql.gz> [--yes]"
    echo ""
    echo "Restores a PostgreSQL database dump created by backup_db.sh."
    echo "Options:"
    echo "  --yes, -y    Skip confirmation prompt and proceed with restore"
    echo ""
    echo "Environment Variables:"
    echo "  POSTGRES_HOST     (default: localhost)"
    echo "  POSTGRES_PORT     (default: 5432)"
    echo "  POSTGRES_USER     (default: ems_user)"
    echo "  POSTGRES_PASSWORD (default: ems_secure_password)"
    echo "  POSTGRES_DB       (default: ems_db)"
    exit 0
fi

BACKUP_FILE="$1"
CONFIRM_FLAG="${2:-}"

# Check that the backup file exists
if [[ ! -f "${BACKUP_FILE}" ]]; then
    echo "ERROR: Backup file '${BACKUP_FILE}' not found!" >&2
    exit 1
fi

# Configuration with defaults
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-ems_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-ems_secure_password}"
POSTGRES_DB="${POSTGRES_DB:-ems_db}"

# Verify checksum if present
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [[ -f "${CHECKSUM_FILE}" ]] && command -v sha256sum >/dev/null 2>&1; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Verifying backup SHA-256 integrity..."
    if ! sha256sum -c "${CHECKSUM_FILE}"; then
        echo "ERROR: Checksum verification failed! The backup file may be corrupted." >&2
        exit 1
    fi
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Checksum verified successfully."
fi

# Safeguard confirmation prompt
if [[ "${CONFIRM_FLAG}" != "--yes" && "${CONFIRM_FLAG}" != "-y" ]]; then
    echo ""
    echo "======================================================================"
    echo " WARNING: Restoring will overwrite existing data in '${POSTGRES_DB}'!"
    echo " Target: ${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
    echo " Source: ${BACKUP_FILE}"
    echo "======================================================================"
    read -rp "Are you sure you want to proceed? [type 'yes' to confirm]: " USER_CONFIRM
    if [[ "${USER_CONFIRM}" != "yes" ]]; then
        echo "Restore cancelled by user."
        exit 0
    fi
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Restoring database from '${BACKUP_FILE}'..."

export PGPASSWORD="${POSTGRES_PASSWORD}"

# Decompress and stream directly into psql
gunzip -c "${BACKUP_FILE}" | psql \
    -h "${POSTGRES_HOST}" \
    -p "${POSTGRES_PORT}" \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -v ON_ERROR_STOP=1

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Database restore completed successfully!"
