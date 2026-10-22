# ============================================================
# Employee Management System — Developer Makefile
# ============================================================
# Usage: make <target>

.PHONY: help dev test test-coverage lint fmt check-deploy \
        migrate migrations seed superuser collectstatic \
        docker-up docker-down docker-logs docker-build \
        clean ssl

# Default target
help:
	@echo ""
	@echo "╔═══════════════════════════════════════════════╗"
	@echo "║   Employee Management System — Make Targets   ║"
	@echo "╚═══════════════════════════════════════════════╝"
	@echo ""
	@echo " Development:"
	@echo "  make dev            — Start Django dev server"
	@echo "  make migrate        — Apply DB migrations"
	@echo "  make migrations     — Create new migrations"
	@echo "  make superuser      — Create Django superuser"
	@echo "  make seed           — Seed sample data"
	@echo "  make collectstatic  — Collect & compress static assets"
	@echo ""
	@echo " Testing & Quality:"
	@echo "  make test           — Run all unit tests"
	@echo "  make test-coverage  — Run tests with coverage report"
	@echo "  make lint           — Run Ruff linter"
	@echo "  make fmt            — Auto-format with Ruff"
	@echo "  make check-deploy   — Django security deployment check"
	@echo ""
	@echo " Docker:"
	@echo "  make docker-build   — Build all containers"
	@echo "  make docker-up      — Start all containers (detached)"
	@echo "  make docker-down    — Stop all containers"
	@echo "  make docker-logs    — Tail all container logs"
	@echo ""
	@echo " Utilities:"
	@echo "  make ssl            — Generate self-signed SSL cert (dev)"
	@echo "  make clean          — Remove __pycache__ and .pyc files"
	@echo ""

# ------------------------------------
# Development
# ------------------------------------
dev:
	python manage.py runserver

migrate:
	python manage.py migrate

migrations:
	python manage.py makemigrations

superuser:
	python manage.py createsuperuser

seed:
	python manage.py seed_employees

collectstatic:
	python manage.py collectstatic --noinput

# ------------------------------------
# Testing & Quality
# ------------------------------------
test:
	python manage.py test employees --verbosity=2

test-coverage:
	coverage run --source=employees manage.py test employees --verbosity=2
	coverage report
	coverage html -d htmlcov
	@echo "\nHTML report: htmlcov/index.html"

lint:
	ruff check .

fmt:
	ruff format .
	ruff check --fix .

check-deploy:
	@echo "Running Django deployment security checklist..."
	python manage.py check --deploy

# ------------------------------------
# Docker
# ------------------------------------
COMPOSE ?= $(shell command -v docker-compose 2>/dev/null || (command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && echo "docker compose") || echo "./docker-compose")

docker-build:
	$(COMPOSE) build

docker-up:
	$(COMPOSE) up -d

docker-down:
	$(COMPOSE) down

docker-logs:
	$(COMPOSE) logs -f

# ------------------------------------
# Utilities
# ------------------------------------
ssl:
	bash generate-ssl.sh

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete
	find . -name "*.pyo" -delete
	@echo "Cleaned!"
