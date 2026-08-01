SHELL := /bin/zsh
.RECIPEPREFIX := >

.PHONY: install dev web api lint format typecheck test test-e2e build docker-build \
 validate-data migrate seed reindex setup-api setup-web db-up db-down

install: setup-web setup-api

dev:
>npm run dev

web:
>npm run dev:web

api:
>npm run dev:api

setup-web:
>npm install

setup-api:
>cd apps/api && uv sync

lint:
>npm run lint

format:
>cd apps/api && uv run ruff format app tests ../../scripts

typecheck:
>cd apps/api && uv run mypy app tests ../../scripts/validate_backend_acceptance.py ../../scripts/validate_live_backend.py

test:
>npm run test

test-e2e:
>npm run test:e2e

build:
>npm run build

docker-build:
>docker compose build

validate-data:
>cd apps/api && PYTHONPATH=. uv run python ../../scripts/validate_data.py

migrate:
>cd apps/api && uv run alembic upgrade head

seed:
>cd apps/api && PYTHONPATH=. uv run python ../../scripts/seed_database.py

reindex:
>cd apps/api && PYTHONPATH=. uv run python ../../scripts/reindex.py

db-up:
>docker compose up -d db

db-down:
>docker compose down
