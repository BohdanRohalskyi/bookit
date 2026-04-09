# Bookit API — Claude Instructions

> Use the `/code-go` slash command when implementing backend features.
> Root `CLAUDE.md` has project-wide context (git flow, architecture, domains).

## Stack

| | |
|-|-|
| Language | Go 1.22+ |
| Framework | Gin |
| Types | oapi-codegen → `internal/api/types.gen.go` |
| Database | PostgreSQL 15 via `pgx` |
| Migrations | `golang-migrate` (embedded in binary) |
| Auth | JWT — access 30m / refresh 30d |

## Project Structure

```
api/
├── cmd/server/main.go          # Entry point
├── internal/
│   ├── api/                    # Generated types + handler registration
│   ├── config/                 # Env-based config (DATABASE_URL, JWT_SECRET, …)
│   ├── database/               # DB pool + migration runner
│   ├── logger/                 # Structured logger
│   ├── middleware/             # Auth, CORS, request logging
│   └── domain/
│       ├── identity/           # Auth, users, tokens
│       ├── catalog/            # Businesses, services, staff
│       ├── scheduling/         # Availability, time slots
│       ├── booking/            # Appointments
│       ├── payment/            # Transactions
│       └── notification/       # Email, push
├── migrations/                 # SQL files (embedded)
└── openapi/spec.yaml           # Source of truth — update before handlers
```

### Domain package layout

Each domain follows this structure:

```
domain/<name>/
├── handler.go      # Gin handlers — thin, delegate to service
├── service.go      # Business logic
├── repository.go   # DB queries (pgx)
└── routes.go       # Route registration
```

## Non-Negotiable Rules

### 1. OpenAPI first
Always update `api/openapi/spec.yaml` **before** writing any handler or type.
Regenerate types after every spec change:
```bash
cd api && make generate
# or manually:
oapi-codegen -generate types -package api openapi/spec.yaml > internal/api/types.gen.go
```

### 2. RFC 7807 errors — always
```go
c.JSON(status, gin.H{
    "type":   "https://bookit.app/errors/<slug>",
    "title":  "Short human-readable title",
    "status": status,
    "detail": "Specific detail for this occurrence",
})
```

| Code | When |
|------|------|
| 400 | Validation failed |
| 401 | Missing or invalid token |
| 403 | Valid token, wrong permissions |
| 404 | Resource not found (`pgx.ErrNoRows`) |
| 409 | Duplicate / constraint violation |
| 422 | Business rule violation |

### 3. Context propagation
- First argument of every service/repository method: `ctx context.Context`
- In handlers: `ctx := c.Request.Context()`
- Never `context.Background()` inside request handlers

### 4. Auth in handlers
```go
user, ok := middleware.GetUser(c)
if !ok {
    c.JSON(http.StatusUnauthorized, ...)
    return
}
```

### 5. Database
- Use `pgx` directly — no ORM
- Always handle `pgx.ErrNoRows` → 404
- Multi-step writes → use transactions
- Queries live in `repository.go`, never in handlers

## Local Development

```bash
# Start everything (API + DB + mailpit)
docker compose up

# Run just the DB
docker compose up db

# Run API locally (needs DB running)
cd api && go run cmd/server/main.go

# Run linter
docker compose run --rm lint
# or
cd api && golangci-lint run ./...

# Run tests
cd api && go test ./...
```

Environment variables for local dev live in `api/.env` (gitignored).
Copy `api/.env.example` to get started.

## Before Committing

```bash
cd api && go build ./...   # Must pass
cd api && go vet ./...     # Must pass
cd api && go test ./...    # Must pass
```

The pre-push hook runs golangci-lint automatically.
