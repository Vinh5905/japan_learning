.PHONY: help setup install db-up db-down db-logs db-migrate prisma-generate dev clear-data backfill-vocab-han-viet lint test test-e2e playwright-install build check

help:
	@echo "Kanji Spreadsheet commands"
	@echo ""
	@echo "Setup and run:"
	@echo "  make setup               Install dependencies, start Postgres, and run Prisma migration."
	@echo "  make install             Install npm dependencies and generate Prisma client."
	@echo "  make db-up               Start PostgreSQL Docker container."
	@echo "  make db-migrate          Apply Prisma migration to local PostgreSQL."
	@echo "  make dev                 Start Next.js dev server at http://127.0.0.1:3000."
	@echo "  make clear-data          Clear current database data. Destructive; use only when intentionally starting over."
	@echo "  make backfill-vocab-han-viet"
	@echo "                           Fill empty vocabulary Han Viet values from existing kanji Han Viet data."
	@echo ""
	@echo "Database helpers:"
	@echo "  make db-down             Stop PostgreSQL Docker container."
	@echo "  make db-logs             Follow PostgreSQL Docker logs."
	@echo "  make prisma-generate     Generate Prisma client."
	@echo ""
	@echo "Quality checks:"
	@echo "  make lint                Run ESLint."
	@echo "  make test                Run Vitest unit/component/integration tests."
	@echo "  make playwright-install  Install Chromium for Playwright."
	@echo "  make test-e2e            Run Playwright end-to-end tests."
	@echo "  make build               Run production build and TypeScript checks."
	@echo "  make check               Run lint, test, and build."

setup: install db-up db-migrate

install:
	npm install

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

db-logs:
	docker compose logs -f postgres

db-migrate:
	npm run db:migrate -- --name init

prisma-generate:
	npm run prisma:generate

dev:
	npm run dev -- --hostname 127.0.0.1 --port 3000

clear-data:
	npm run db:clear -- --confirm-clear

backfill-vocab-han-viet:
	npm run db:backfill-vocab-han-viet

lint:
	npm run lint

test:
	npm run test

playwright-install:
	npx playwright install chromium

test-e2e:
	npm run test:e2e

build:
	npm run build

check: lint test build
