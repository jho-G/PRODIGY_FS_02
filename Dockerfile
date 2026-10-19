# ============================================================
# EMS Backend — Django + Gunicorn
# ============================================================
# Multi-stage build: separate builder (installs deps) from runtime
# to keep the final image lean and avoid shipping build tools.
# Runs as a non-root user for security.

FROM python:3.11-slim AS builder

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install build dependencies (only in builder stage)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies into a prefix so we can copy them cleanly
COPY requirements.txt /app/
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ============================================================
# Runtime Stage
# ============================================================
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install curl for the Docker healthcheck (minimal runtime dep)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

WORKDIR /app

# Create a dedicated non-root user for security
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --no-create-home --shell /bin/false appuser

# Copy backend application source
COPY . /app/

# Ensure staticfiles and media directories exist with appuser ownership
RUN mkdir -p /app/staticfiles /app/media && \
    chown -R appuser:appgroup /app

USER appuser

# Expose port for Django/Gunicorn
EXPOSE 8000

# Healthcheck: hit the dedicated /health/ endpoint (no DB query, fast)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health/ || exit 1

# Run migrations, collect static files, then start Gunicorn
# --workers: 2 × (CPU cores) + 1 is a common rule of thumb for I/O-bound apps
CMD ["sh", "-c", \
    "python manage.py migrate --noinput && \
     python manage.py collectstatic --noinput && \
     gunicorn employee_system.wsgi:application \
       --bind 0.0.0.0:8000 \
       --workers 3 \
       --timeout 120 \
       --access-logfile - \
       --error-logfile -"]
