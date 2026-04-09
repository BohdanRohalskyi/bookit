.PHONY: up down logs test lint typecheck install migrate migrate-down migrate-reset migrate-create build clean

DB_URL = postgres://bookit:bookit@db:5432/bookit?sslmode=disable

# ── Dev ───────────────────────────────────────────────────────────────────────

up:
	docker compose up

down:
	docker compose down

logs:
	docker compose logs -f api

# ── Tests ─────────────────────────────────────────────────────────────────────

test:
	docker compose run --rm go-tools go test ./...

# ── Lint ──────────────────────────────────────────────────────────────────────

lint:
	docker compose run --rm lint
	docker compose exec consumer npm run lint

# ── Typecheck ─────────────────────────────────────────────────────────────────

typecheck:
	docker compose exec consumer npm run typecheck

# ── Dependencies ──────────────────────────────────────────────────────────────

install:
	docker compose run --rm go-tools go mod download
	docker compose exec consumer npm install

# ── Migrations ────────────────────────────────────────────────────────────────

migrate:
	docker compose run --rm migrate-cli -path /migrations -database "$(DB_URL)" up

# make migrate-down        → rollback 1
# make migrate-down n=3   → rollback 3
migrate-down:
	docker compose run --rm migrate-cli -path /migrations -database "$(DB_URL)" down $(or $(n),1)

migrate-reset:
	docker compose run --rm migrate-cli -path /migrations -database "$(DB_URL)" down -all

# make migrate-create name=create_bookings_table
migrate-create:
	docker compose run --rm migrate-cli create -ext sql -dir /migrations -seq $(name)

# ── Build ─────────────────────────────────────────────────────────────────────

build:
	docker compose build api
	docker compose exec consumer npm run build

# ── Clean ─────────────────────────────────────────────────────────────────────

clean:
	docker compose exec consumer npm run build --workspace=packages/consumer -- --emptyOutDir || true
	docker compose exec biz npm run build --workspace=packages/biz -- --emptyOutDir || true
