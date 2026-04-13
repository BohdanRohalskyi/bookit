---
title: "Provider Registration"
status: IN_PROGRESS
created: 2026-04-13
author: "bohdan.rohalskyi@paysera.com"
---

# Plan: Provider Registration

## Summary

All users currently register through a single shared endpoint and land as consumers.
The `providers` table referenced in `IsProvider()` doesn't exist yet, so `is_provider`
is always `false`. This plan creates the providers table, implements the
`POST /api/v1/providers` endpoint, adds customer/provider tab UI to the consumer
app's register and login pages, and makes the biz app automatically register every
new user as a provider.

**Goal:** A user who chooses the "Provider" tab on the consumer app (or registers via
the biz app) gets a row in the `providers` table and has `is_provider: true` in all
subsequent auth responses.

---

## Phases

### Phase 1: Feature flag — `provider_registration` `[REJECTED]`

**Reason:** Shipping without a feature flag — provider registration will be live immediately on deploy.

---

### Phase 2: Backend — providers table migration `[DONE]`

Create `api/migrations/000005_create_providers_table.up.sql`:

```sql
CREATE TABLE providers (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT providers_user_id_unique UNIQUE (user_id),
    CONSTRAINT providers_status_check CHECK (status IN ('active', 'inactive', 'suspended'))
);

CREATE INDEX idx_providers_user_id ON providers(user_id);
```

Down migration `000005_create_providers_table.down.sql`:
```sql
DROP TABLE IF EXISTS providers;
```

The `IsProvider()` method in `api/internal/auth/repository.go` already queries this
table and handles `42P01` (table not found) gracefully — it will start returning real
values as soon as the migration runs.

---

### Phase 3: Backend — `POST /api/v1/providers` endpoint `[DONE]`

Endpoint is already defined in `api/openapi/spec.yaml`. Implement the handler,
service, and repository methods.

**Repository** (`api/internal/auth/repository.go`):
```go
func (r *Repository) CreateProvider(ctx context.Context, userID uuid.UUID) error
// INSERT INTO providers (user_id) VALUES ($1)
// Return identity.ErrAlreadyProvider on unique constraint violation
```

**Service** (`api/internal/auth/service.go`):
```go
func (s *Service) CreateProvider(ctx context.Context, userID uuid.UUID) (*domain.Provider, error)
// - Call repo.CreateProvider; map ErrAlreadyProvider → 409
// - Return the new Provider record
```

**Handler** (`api/internal/auth/handler.go`):
```go
func (h *Handler) CreateProvider(c *gin.Context)
// POST /api/v1/providers — requires auth middleware
// 201 Provider | 401 | 409
```

**Domain type** (`api/internal/domain/identity/`):
```go
type Provider struct {
    ID        uuid.UUID
    UserID    uuid.UUID
    Status    string
    CreatedAt time.Time
}
```

After a provider is created, subsequent calls to `Login` / `Refresh` will return
`is_provider: true` automatically via the existing `IsProvider()` check.

---

### Phase 4: Consumer frontend — register/login tabs `[DONE]`

Add a Customer | Provider tab switcher to both pages.

**`web/packages/consumer/src/pages/Register.tsx`:**
- Tab state: `'customer' | 'provider'`
- Both tabs render the same form (name, email, phone, password)
- Heading changes: "Create your account" vs "Start offering services"
- On successful registration as provider: call `api.POST('/api/v1/providers')` before
  navigating to `/account`

**`web/packages/consumer/src/pages/Login.tsx`:**
- Tab state: `'customer' | 'provider'`
- Heading changes: "Welcome back" vs "Provider sign in"
- Login call is identical for both tabs — `is_provider` comes back in the auth response
  No extra API call needed after login.

---

### Phase 5: Biz frontend — auto-register as provider `[DONE]`

The biz app is exclusively for providers. After any successful registration, call
`POST /api/v1/providers` automatically (no tabs needed — the user is always a provider).

**`web/packages/biz/src/pages/Register.tsx`:**
- After `api.POST('/api/v1/auth/register')` succeeds, call
  `api.POST('/api/v1/providers')` before navigating
- If `/api/v1/providers` returns 409, continue navigation (already a provider)
**`web/packages/biz/src/pages/Login.tsx`:**
- No change — `is_provider` is already returned in the auth response

---

## Critical files

| File | Change |
|------|--------|
| `api/migrations/000005_create_providers_table.up.sql` | New migration |
| `api/migrations/000005_create_providers_table.down.sql` | New migration |
| `api/internal/domain/identity/user.go` | Add `Provider` domain type |
| `api/internal/auth/repository.go` | Add `CreateProvider()` |
| `api/internal/auth/service.go` | Add `CreateProvider()` |
| `api/internal/auth/handler.go` | Implement `POST /api/v1/providers` handler |
| `web/packages/consumer/src/pages/Register.tsx` | Add tabs + provider upgrade call |
| `web/packages/consumer/src/pages/Login.tsx` | Add tabs |
| `web/packages/biz/src/pages/Register.tsx` | Auto-call provider upgrade after register |

---

## Verification

1. Enable flag in local Firebase (or force `evaluate = () => true` in dev)
2. Register on consumer with "Provider" tab → `SELECT * FROM providers` shows a row,
   `is_provider: true` in the response
3. Register on consumer with "Customer" tab → no row in `providers`,
   `is_provider: false`
4. Register on biz app → row created in `providers` automatically
5. Login on either app → `is_provider` reflects actual DB state

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
