# Go Backend Coding

You are implementing a Go backend feature for the Bookit project. Follow these conventions exactly.

## Stack

| Layer | Technology |
|-------|------------|
| Language | Go 1.22+ |
| Framework | Gin |
| Types | oapi-codegen generated (`internal/api/types.gen.go`) |
| Database | PostgreSQL 15 via `pgx` |
| Migrations | `golang-migrate` (embedded in binary) |
| Auth | JWT (access 30m / refresh 30d) |
| Config | Environment variables via `internal/config` |
| Logging | Structured logger via `internal/logger` |

## Project structure

```
api/
├── cmd/server/         # Entry point
├── internal/
│   ├── api/            # Generated types (types.gen.go) + handlers
│   ├── config/         # Env-based config
│   ├── database/       # DB connection + migrations
│   ├── domain/         # Business domains
│   │   ├── identity/   # Auth, users
│   │   ├── catalog/    # Businesses, services, staff
│   │   ├── scheduling/ # Availability, slots
│   │   ├── booking/    # Appointments
│   │   ├── payment/    # Transactions
│   │   └── notification/
│   └── middleware/     # Auth, CORS, logging
├── openapi/spec.yaml   # Source of truth — update first
└── migrations/         # SQL migration files
```

## Critical rules

### OpenAPI first
- **Always update `api/openapi/spec.yaml` before writing handler code**
- Regenerate types after spec changes: `oapi-codegen -generate types -package api api/openapi/spec.yaml > internal/api/types.gen.go`
- All request/response types must come from generated types — never hand-write request structs

### Error responses
- Always use RFC 7807 format:
```go
c.JSON(status, gin.H{
    "type":   "https://bookit.app/errors/<slug>",
    "title":  "Human readable title",
    "status": status,
    "detail": "Specific detail message",
})
```
- 400 Bad Request: validation errors
- 401 Unauthorized: missing/invalid token
- 403 Forbidden: valid token, insufficient permission
- 404 Not Found: resource doesn't exist
- 409 Conflict: duplicate/constraint violation
- 422 Unprocessable Entity: business rule violation

### Context propagation
- Always pass `ctx context.Context` as first argument to DB calls and service methods
- Extract request context with `c.Request.Context()` in handlers
- Never use `context.Background()` inside request handlers

### Database
- Use `pgx` directly — no ORM
- Queries live in the domain package, not in handlers
- Always handle `pgx.ErrNoRows` → return 404
- Use transactions for multi-step operations

### Auth
- JWT middleware extracts user from token and sets in Gin context
- Get current user: `middleware.GetUser(c)` → returns `*api.User, bool`
- Handlers requiring auth must check `ok` and return 401 if false

### Domain structure
Each domain package follows:
```
domain/<name>/
├── handler.go      # Gin handlers (thin — delegate to service)
├── service.go      # Business logic
├── repository.go   # DB queries
└── <name>.go       # Domain types (if not using generated)
```

### Code style
- Error returns, not panics
- `if err != nil` immediately after every fallible call
- No global state — inject dependencies via constructors
- Test coverage for service layer (business logic) — handlers via integration tests

## Before finishing

Run `cd api && go build ./...` and `go vet ./...` to confirm clean build.
Check `cd api && golangci-lint run ./...` if linter is available.

## Arguments

$ARGUMENTS
