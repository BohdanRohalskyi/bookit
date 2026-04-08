.PHONY: dev dev-all api web web-biz mailpit install test lint build typecheck clean migrate migrate-down

# Start API and consumer web (default dev workflow)
dev:
	@make -j2 api web

# Start API + consumer + biz (all services)
dev-all:
	@make -j3 api web web-biz

# Start Mailpit for local email testing (http://localhost:8025)
mailpit:
	docker run -d --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit:latest || docker start mailpit

# Start API server
api:
	cd api && go run ./cmd/server

# Start consumer web dev server (port 5173)
web:
	cd web/packages/consumer && npx vite --port 5173

# Start biz web dev server (port 5174)
web-biz:
	cd web/packages/biz && npx vite --port 5174

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
	cd api && make build
	cd web && npm run build

# Typecheck
typecheck:
	cd web && npm run typecheck

# Run database migrations
migrate:
	migrate -path api/migrations -database "postgres://bookit:bookit@localhost:5432/bookit?sslmode=disable" up

# Rollback last migration
migrate-down:
	migrate -path api/migrations -database "postgres://bookit:bookit@localhost:5432/bookit?sslmode=disable" down 1

# Clean build artifacts
clean:
	cd api && make clean
	cd web && rm -rf packages/consumer/dist packages/biz/dist
