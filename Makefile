.PHONY: dev dev-all up down web web-biz logs install test lint build typecheck clean migrate migrate-down migrate-reset migrate-create

# Start everything: backend (Docker) + consumer frontend
dev:
	@make -j2 up web

# Start everything: backend (Docker) + consumer + biz frontends
dev-all:
	@make -j3 up web web-biz

# Start backend stack (API + DB + Mailpit)
up:
	docker compose up

# Stop backend stack
down:
	docker compose down

# Start consumer web dev server (port 5173)
web:
	cd web && npm run dev

# Start biz web dev server (port 5174)
web-biz:
	cd web && npm run dev:biz

# View backend logs
logs:
	docker compose logs -f api

# Install dependencies
install:
	cd api && go mod download
	cd web && npm install

# Run all tests
test:
	cd api && make test

# Run all linters
lint:
	cd api && make lint
	cd web && npm run lint

# Build for production
build:
	docker compose build api
	cd web && npm run build

# Typecheck
typecheck:
	cd web && npm run typecheck

# Clean build artifacts
clean:
	cd api && make clean
	cd web && rm -rf packages/consumer/dist packages/biz/dist

# Run database migrations (requires migrate CLI)
migrate:
	migrate -path api/migrations -database "postgres://bookit:bookit@localhost:5432/bookit?sslmode=disable" up

# Rollback migrations: make migrate-down n=1 (default: 1)
migrate-down:
	migrate -path api/migrations -database "postgres://bookit:bookit@localhost:5432/bookit?sslmode=disable" down $(or $(n),1)

# Rollback all migrations
migrate-reset:
	migrate -path api/migrations -database "postgres://bookit:bookit@localhost:5432/bookit?sslmode=disable" down -all

# Create new migration: make migrate-create name=create_bookings_table
migrate-create:
	migrate create -ext sql -dir api/migrations -seq $(name)
