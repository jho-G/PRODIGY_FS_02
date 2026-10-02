# ============================================================
# EMS Backend — Django + Gunicorn
# ============================================================
# Use official slim Python runtime
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies first (layer-cached separately from source)
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY . /app/

# Expose port for Django/Gunicorn
EXPOSE 8000

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
