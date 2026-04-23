---
name: code-go
description: Implement a Go backend feature for the Bookit API. Follow project conventions for Gin, pgx, oapi-codegen, RFC 7807 errors, and feature flags.
---

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
│   ├── flags/          # Feature flag service (Firebase Admin SDK)
│   └── middleware/     # Auth, CORS, logging
├── openapi/spec.yaml   # Source of truth — update first
└── migrations/         # SQL migration files
```

---

## TDD Approach — mandatory

**Write tests before implementation. No exceptions.**

```
Red → Green → Refactor
```

1. **Red** — write the test first. It must fail because the code doesn't exist yet.
2. **Green** — write the minimum implementation to make the test pass.
3. **Refactor** — clean up while keeping tests green.

### Test types and where they live

| Type | File | What it tests |
|------|------|---------------|
| Handler unit test | `internal/<domain>/<handler>_test.go` | HTTP layer — request routing, status codes, response shape |
| Service unit test | `internal/<domain>/service_test.go` | Business logic with mock repository |
| Integration test | `internal/<domain>/<name>_test.go` | Repository queries against a real DB (requires `DATABASE_URL`) |

### Mock pattern

Use a struct with function fields — same pattern as `auth/mock_test.go`. Unset fields default to safe zero values so each test only configures what it exercises:

```go
type mockRepo struct {
    getByID func(ctx context.Context, id int64) (*MyType, error)
    create  func(ctx context.Context, req CreateReq) (*MyType, error)
}

func (m *mockRepo) GetByID(ctx context.Context, id int64) (*MyType, error) {
    if m.getByID != nil { return m.getByID(ctx, id) }
    return nil, ErrNotFound // safe default
}
```

To make a handler testable, define a narrow interface for the methods it needs (same pattern as `catalogSearcher` in `catalog/catalog_handler.go`) and inject via constructor.

### Handler test pattern

```go
func init() { gin.SetMode(gin.TestMode) }

func newTestRouter(repo myRepository) *gin.Engine {
    svc := NewService(repo)
    h := NewHandler(svc)
    r := gin.New()
    r.GET("/api/v1/things/:id", h.GetThing)
    return r
}

func do(r *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
    b, _ := json.Marshal(body)
    req := httptest.NewRequestWithContext(context.Background(), method, path, bytes.NewReader(b))
    req.Header.Set("Content-Type", "application/json")
    rr := httptest.NewRecorder()
    r.ServeHTTP(rr, req)
    return rr
}

func TestGetThing(t *testing.T) {
    t.Parallel()

    t.Run("200 returns the thing", func(t *testing.T) {
        t.Parallel()
        repo := &mockRepo{
            getByID: func(_ context.Context, id int64) (*MyType, error) {
                return &MyType{ID: id, Name: "foo"}, nil
            },
        }
        rr := do(newTestRouter(repo), http.MethodGet, "/api/v1/things/1", nil)
        assert.Equal(t, http.StatusOK, rr.Code)
    })

    t.Run("404 when not found", func(t *testing.T) {
        t.Parallel()
        rr := do(newTestRouter(&mockRepo{}), http.MethodGet, "/api/v1/things/999", nil)
        assert.Equal(t, http.StatusNotFound, rr.Code)
    })
}
```

### Running tests

```bash
# Unit tests (no DB needed)
cd api && go test ./...

# With DB running
docker compose up -d db && cd api && go test ./...
```

---

## Reuse before you create

Before implementing, check whether something already exists:

| Need | Where to look |
|------|--------------|
| Auth extraction | `middleware.GetUser(c)` in `internal/middleware/` |
| Error responses | RFC 7807 helper if it exists in `internal/api/` |
| DB transaction | existing pattern in any `repository.go` |
| Email sending | `internal/domain/notification/` |
| Config values | `internal/config/config.go` — extend, don't add new env parsing elsewhere |
| Feature flags | `internal/flags/` service (if it exists) — inject, don't instantiate inline |
| Logging | `internal/logger/` — use the injected logger, never `fmt.Println` |

If a good fit exists — use it. If it almost fits — weigh whether extending it is clean. **Don't force reuse when it would:**
- Add unrelated responsibility to an existing package (violates single responsibility)
- Require a domain package to import another domain package (breaks domain isolation)
- Make a generic utility carry domain-specific logic
- Introduce indirection with no real benefit

When in doubt: duplicating a small, stable piece of logic across domains is fine. A wrong shared abstraction is harder to undo than two clear, independent implementations.

---

## Feature flags

Every new user-facing backend feature must be gated behind a server-side flag.

```go
// Inject the flag service into your handler/service struct
type Handler struct {
    flags flags.Service
    // ...
}

// Check before executing feature logic
func (h *Handler) MyEndpoint(c *gin.Context) {
    if !h.flags.IsEnabled(c.Request.Context(), "my_feature") {
        c.JSON(http.StatusNotFound, gin.H{
            "type":   "https://bookit.app/errors/not-found",
            "title":  "Not found",
            "status": 404,
            "detail": "This resource does not exist",
        })
        return
    }
    // ... feature logic
}
```

The flag key string must match the constant value in `web/packages/shared/src/features/flags.ts`
so backend and frontend gate the same flag. E.g. `"booking_instant_confirm"` ↔ `FLAGS.BOOKING_INSTANT_CONFIRM`.

**Local dev:** all flags return `true` when `GCP_PROJECT` is unset — no Firebase setup needed.
Note the flag key in your PR description — the project owner activates it in Firebase Remote Config. You don't need Firebase access.

---

## Critical rules

### OpenAPI first
- **Always update `api/openapi/spec.yaml` before writing handler code**
- Regenerate types after spec changes: `oapi-codegen -generate types -package api api/openapi/spec.yaml > internal/api/types.gen.go`
- All request/response types must come from generated types — never hand-write request structs

### Error responses
Always use RFC 7807 format:
```go
c.JSON(status, gin.H{
    "type":   "https://bookit.app/errors/<slug>",
    "title":  "Human readable title",
    "status": status,
    "detail": "Specific detail message",
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

---

## Before finishing

1. All new code has tests written before implementation (Red → Green → Refactor).
2. Confirm tests pass: `cd api && go test ./...`
3. Confirm clean build and vet: `cd api && go build ./... && go vet ./...`

The pre-push hook runs `go build`, `go vet`, and `golangci-lint` automatically on push — no need to run manually.

## Arguments

$ARGUMENTS
