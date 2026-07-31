SHELL := /bin/zsh

.PHONY: dev web api lint test test-e2e setup-api setup-web db-up db-down

dev:
\tnpm run dev

web:
\tnpm run dev:web

api:
\tnpm run dev:api

setup-web:
\tnpm install

setup-api:
\tcd apps/api && uv sync

lint:
\tnpm run lint

test:
\tnpm run test

test-e2e:
\tnpm run test:e2e

db-up:
\tdocker compose up -d db

db-down:
\tdocker compose down
