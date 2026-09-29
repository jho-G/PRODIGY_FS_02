# Use official slim Python runtime
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system build dependencies if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY . /app/

# Expose port for Django
EXPOSE 8000

# Run migrations and start Gunicorn with multi-worker concurrency
CMD ["sh", "-c", "python manage.py migrate && gunicorn employee_system.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120"]
