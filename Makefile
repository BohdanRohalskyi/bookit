.PHONY: dev api web install test lint build typecheck clean

# Start API and Web together
dev:
	@make -j2 api web

# Start API server
api:
	cd api && go run ./cmd/server

# Start Web dev server
web:
	cd web && npm run dev

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

# Clean build artifacts
clean:
	cd api && make clean
	cd web && rm -rf dist
