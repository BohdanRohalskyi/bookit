# Bookit API — Claude Instructions

> **Every change inside `api/` — no matter how small — must be preceded by invoking the `/code-go` skill.**
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
│   ├── flags/                  # Feature flag service (Firebase Admin SDK)
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
└── <name>.go       # Domain types (if not covered by generated types)
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

Docker is the supported way to run the API. Non-Docker local runs are not actively maintained.

```bash
# Start everything (API + DB + Mailpit)
docker compose up

# Start only the DB (e.g. when running API via IDE for debugging)
docker compose up db mailpit

# Run linter
docker compose --profile tools run --rm lint

# Run tests (requires DB running)
docker compose up -d db && cd api && go test ./...
```

## Before Committing

```bash
# Build and vet (local Go)
cd api && go build ./... && go vet ./...

# Build and vet (Docker, if Go not installed locally)
docker compose --profile tools run --rm go-tools sh -c "go build ./... && go vet ./..."

# Tests (DB must be running)
docker compose up -d db
cd api && go test ./...
```

The pre-push hook runs golangci-lint automatically.
