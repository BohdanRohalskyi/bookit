---
title: "Integer Primary Keys + UUID Public Identifiers"
status: DONE
created: 2026-04-21
author: "bohdan.rohalskyi@paysera.com"
---

# Plan: Integer Primary Keys + UUID Public Identifiers

## Summary

Every table currently uses `UUID PRIMARY KEY`, meaning all foreign keys store 16-byte
random values, indexes fragment on every insert, and joins pay a 4× size penalty
compared to `BIGINT`. The fix: give every table a `BIGSERIAL` internal primary key and
a `UUID UNIQUE` public identifier. Foreign keys reference the integer. The UUID is
exposed in URLs and API responses only — the API contract does not change.

**Goal:** `id BIGSERIAL PRIMARY KEY` + `uuid UUID UNIQUE` on every table. All FKs become
`BIGINT`. API consumers continue to see UUID strings under the `"id"` JSON key.

**Rule going forward:** New tables always follow this pattern. No `UUID PRIMARY KEY`.

---

## What changes and what does not

| Layer | Changes |
|-------|---------|
| Database | All PKs → BIGSERIAL; all FK columns → BIGINT; `uuid` column added to every table |
| Go domain types | `ID int64` added; `UUID uuid.UUID` kept for API boundary |
| Repository queries | JOINs/WHERE on `id` (int64); API-facing lookups by `uuid` |
| Service layer | Minimal — accepts UUID from handler, resolves to int64 in repo |
| API handlers | No change — still parse UUID from URL path |
| OpenAPI spec | No change — `id` fields remain `type: string, format: uuid` |
| Frontend | No change — UUID still returned as `"id"` in all responses |

---

## Table inventory (23 tables)

Ordered by dependency (parents before children):

| # | Table | FKs to migrate |
|---|-------|----------------|
| 1 | `users` | — |
| 2 | `providers` | `user_id → users` |
| 3 | `businesses` | `provider_id → providers` |
| 4 | `auth_tokens` | `user_id → users` |
| 5 | `refresh_tokens` | `user_id → users` |
| 6 | `locations` | `business_id → businesses` |
| 7 | `schedules` | `location_id → locations` |
| 8 | `schedule_days` | `schedule_id → schedules` |
| 9 | `schedule_exceptions` | `schedule_id → schedules` |
| 10 | `location_photos` | `location_id → locations` |
| 11 | `equipment` | `business_id → businesses` |
| 12 | `staff_roles` | `business_id → businesses` |
| 13 | `services` | `business_id → businesses` |
| 14 | `location_equipment` | `location_id → locations`, `equipment_id → equipment` |
| 15 | `location_staff_roles` | `location_id → locations`, `staff_role_id → staff_roles` |
| 16 | `location_services` | `location_id → locations`, `service_id → services` |
| 17 | `service_equipment_requirements` | `service_id → services`, `equipment_id → equipment` |
| 18 | `service_staff_requirements` | `service_id → services`, `staff_role_id → staff_roles` |
| 19 | `roles` | `business_id → businesses` (nullable) |
| 20 | `role_permissions` | `role_id → roles` |
| 21 | `user_role_assignments` | `user_id`, `role_id`, `business_id`, `location_id`, `assigned_by` |
| 22 | `invites` | `role_id`, `business_id`, `location_id`, `invited_by` |
| 23 | `business_member_profiles` | `user_id`, `business_id` |

---

## Phases

### Phase 1: Feature flag `[REJECTED]`

**Reason:** Infrastructure/schema change — not a user-facing feature. No flag needed.

---

### Phase 2: Database migration `[DONE]`

Write `000016_integer_primary_keys.up.sql`. The migration runs inside a single
transaction. For each table:

1. Add `uuid UUID NOT NULL DEFAULT gen_random_uuid()` — copy existing `id` value into it:
   ```sql
   ALTER TABLE users ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid();
   UPDATE users SET uuid = id;
   ALTER TABLE users ADD CONSTRAINT users_uuid_unique UNIQUE (uuid);
   ```

2. Add `new_id BIGSERIAL` temporary column. This auto-fills integer IDs for all existing rows.

3. Drop all FK constraints that reference this table's `id`.

4. Drop the `id` primary key constraint.

5. Rename `new_id` → `id`; add `PRIMARY KEY` on it.

6. For each child FK column pointing at this table:
   ```sql
   -- e.g. locations.business_id UUID → BIGINT
   ALTER TABLE locations ADD COLUMN business_id_new BIGINT;
   UPDATE locations l SET business_id_new = b.id FROM businesses b WHERE b.uuid = l.business_id::uuid;
   ALTER TABLE locations DROP COLUMN business_id;
   ALTER TABLE locations RENAME COLUMN business_id_new TO business_id;
   ALTER TABLE locations ADD CONSTRAINT locations_business_id_fkey
       FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
   ALTER TABLE locations ALTER COLUMN business_id SET NOT NULL;
   ```

7. Re-create indexes on the new integer FK columns.

**RBAC system roles special case:**
The existing seed uses fixed UUIDs (`00000000-0000-0000-0000-000000000001/2`).
After migration, `roles.id` will be `1` (administrator) and `2` (staff) because they
are the first rows inserted. The migration must update `role_permissions` and
`user_role_assignments` FK columns to reference the new integer IDs by joining on
`roles.uuid`. The Go constant `SlugAdministrator = "administrator"` stays — all lookups
use slug, not the numeric ID.

**Nullable FK columns** (`roles.business_id`, `user_role_assignments.location_id`,
`invites.location_id`): preserve nullability after migration.

Write `000016_integer_primary_keys.down.sql` to reverse the migration (restore UUID PKs).

---

### Phase 3: Update Go domain types `[PENDING]`

Every domain struct gets an `ID int64` field alongside `UUID uuid.UUID`.
The `UUID` field is what handlers receive from the URL and what gets serialised to JSON
as `"id"`. The `ID` field is used exclusively inside the repository layer.

Example pattern:

```go
// Before
type Business struct {
    ID         uuid.UUID
    ProviderID uuid.UUID
    Name       string
    // ...
}

// After
type Business struct {
    ID         int64     // internal — never serialised directly
    UUID       uuid.UUID // public — serialised as "id" in JSON responses
    ProviderID int64     // internal FK
    Name       string
    // ...
}
```

Affected packages: `identity`, `catalog`, `domain/rbac`, `staff`.

JSON tags on response structs (handler layer, not domain structs):
- `UUID uuid.UUID \`json:"id"\`` — keeps the API contract identical.

---

### Phase 4: Update repository layer + SQL queries `[PENDING]`

Every SQL query in every repository file changes. Four distinct patterns:

**4a — INSERT: stop passing UUID as `id`, scan back both columns**

```sql
-- Before: Go generates uuid, passes it as id
INSERT INTO businesses (id, provider_id, name, ...)
VALUES ($1, $2, $3, ...) RETURNING id

-- After: BIGSERIAL generates id automatically, uuid defaults via gen_random_uuid()
INSERT INTO businesses (provider_id, name, ...)
VALUES ($1, $2, ...) RETURNING id, uuid
```

Go side: remove `uuid.New()` calls for primary keys. Scan both `id int64` and
`uuid uuid.UUID` from RETURNING.

**4b — SELECT / API-facing lookup: WHERE on `uuid`, scan both id and uuid**

```sql
-- Before
SELECT id, provider_id, name, ... FROM businesses WHERE id = $1  -- $1 was uuid

-- After
SELECT id, uuid, provider_id, name, ... FROM businesses WHERE uuid = $1
```

**4c — SELECT / internal lookup: WHERE on integer `id`**

```sql
-- When int64 is already known (e.g. cascaded from a parent struct)
SELECT id, uuid, location_id, url, ... FROM location_photos WHERE location_id = $1
--                                                                               ↑ int64
```

**4d — JOIN queries: integer columns, same syntax, better performance**

```sql
-- Before: joining on 16-byte UUID columns
SELECT l.* FROM locations l
JOIN businesses b ON b.id = l.business_id
WHERE b.id = $1

-- After: joining on 8-byte BIGINT columns
SELECT l.id, l.uuid, l.business_id, l.name, ... FROM locations l
WHERE l.business_id = $1  -- $1 is int64, no join needed when parent ID is known
```

**Method naming convention:**
- `GetByUUID(ctx, uuid.UUID)` — API-facing; returns full struct including `ID int64`
- `GetByID(ctx, int64)` — internal; used when int64 is already in hand
- All FK parameters: `int64` — never `uuid.UUID` on internal methods

**FK parameter type changes** (every method signature that accepted a UUID FK):
```go
// Before
func (r *LocationRepository) ListByBusinessID(ctx context.Context, businessID uuid.UUID, ...) ([]Location, error)

// After
func (r *LocationRepository) ListByBusinessID(ctx context.Context, businessID int64, ...) ([]Location, error)
```

Update all files:
- `identity/repository.go`
- `catalog/repository.go`
- `catalog/location_repository.go`
- `catalog/catalog_repository.go`
- `domain/rbac/repository.go`
- `staff/repository.go`

---

### Phase 5: Update service layer + shared helpers `[PENDING]`

Service method signatures that accept `uuid.UUID` IDs from handlers stay unchanged
where possible — the service calls `repo.GetByUUID(...)` to resolve, then passes
`int64` to downstream repo calls.

**`MemberAccess` struct** (`catalog/location.go`):
```go
// Before
type MemberAccess struct {
    Role        string
    LocationIDs []uuid.UUID
    Restricted  bool
}

// After
type MemberAccess struct {
    Role        string
    LocationIDs []int64
    Restricted  bool
}
```

**`containsUUID` → `containsID`** (`catalog/location_service.go`):
```go
// Before
func containsUUID(ids []uuid.UUID, id uuid.UUID) bool

// After
func containsID(ids []int64, id int64) bool
```
Update all call sites in `location_service.go` and `catalog_service.go`.

**`GetProviderIDByUserID`** (`identity/repository.go`):
```go
// Before
func (r *Repository) GetProviderIDByUserID(ctx context.Context, userID uuid.UUID) (uuid.UUID, error)

// After
func (r *Repository) GetProviderIDByUserID(ctx context.Context, userID int64) (int64, error)
```
Update callers in `catalog/location_service.go` and `catalog/catalog_service.go`
where `ownsBusinessID` compares provider IDs — both sides become `int64`.

**JWT claims**: keep `uid` as UUID (the user's public identifier). The auth
middleware resolves UUID → int64 once and stores the int64 in the Gin context.
`auth/jwt.go` `Claims.UserID` stays `uuid.UUID`; the middleware does:
```go
user, _ := repo.GetByUUID(ctx, claims.UserID)
c.Set("userID", user.ID) // int64 from here on
```

Affected files: `catalog/location.go`, `catalog/location_service.go`,
`catalog/catalog_service.go`, `domain/rbac/service.go`, `staff/service.go`,
`auth/service.go`, `identity/repository.go`.

---

### Phase 6: Update RBAC middleware `[PENDING]`

`rbac/middleware.go` parses `business_id` / `id` from the path as UUID, resolves
to int64 via `LocationResolver` or a new `BusinessResolver` interface, then passes
int64 to `CanAccess`. Update `AccessRequest` to use int64:

```go
type AccessRequest struct {
    UserID     int64
    BusinessID int64
    LocationID *int64
    Resource   string
    Action     string
}
```

`identity_adapter.go` (`IsBusinessOwner`) updates to compare int64 provider IDs.

---

### Phase 7: Update API handlers + response serialisation `[PENDING]`

Handler response structs use `UUID uuid.UUID \`json:"id"\`` so existing clients
see no change. Handlers parse UUID from the URL, call the service (which accepts
UUID), and the service resolves internally.

Check every handler file for any place that constructs a response struct with an
`ID uuid.UUID` field — change to `UUID uuid.UUID \`json:"id"\``.

Affected files: all `*_handler.go` files in `catalog/`, `auth/`, `staff/`.

---

### Phase 8: Update tests `[PENDING]`

Four test files in `api/internal/auth/` need updating:

**`service_test.go` and `handler_test.go`:**
- Replace `uuid.New()` used as user/entity IDs with `int64` literals (`int64(1)`, `int64(2)`, etc.)
- Update `identity.User` struct construction: `ID uuid.UUID` → `ID int64`, add `UUID uuid.UUID`
- Update mock return types that currently return `uuid.UUID` IDs

**`mock_test.go`:**
- All mock method signatures that accept/return `uuid.UUID` for IDs → `int64`
- Keep `uuid.UUID` for the `UUID` field on returned structs (public identifier)

**`jwt_test.go`:**
- JWT `uid` claim stays `uuid.UUID` — no changes needed here since the claim
  contains the public UUID, not the internal int64

**`location_service.go:224` — `uuid.New()` for photo storage path:**
```go
photoID := uuid.New()
objectName := fmt.Sprintf("locations/%s/photos/%s%s", locationID, photoID, ext)
```
This generates a UUID for the GCS object name (not a DB PK) — **keep as-is**.

---

### Phase 9: Build, vet, test `[PENDING]`

```bash
cd api && go build ./... && go vet ./...
docker compose up -d db
cd api && go test ./...
```

Zero build errors and zero test failures required before merge.

---

### Phase 10: Save the rule to memory + CLAUDE.md `[PENDING]`

Add to `api/CLAUDE.md`:

```
## Primary Key Convention

Every table MUST follow this pattern — no exceptions:

    id   BIGSERIAL    PRIMARY KEY,
    uuid UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),

Foreign keys reference the integer `id`. The `uuid` column is exposed in URLs
and API responses (serialised as `"id"` in JSON). Never use UUID as a primary key.
```

Save a memory entry so this rule is recalled in future conversations.

---

## Dependency order

```
Phase 2 (migration)
    → Phase 3 (types)
        → Phase 4 (repos) + Phase 5 (services + helpers) + Phase 6 (rbac) [parallel]
            → Phase 7 (handlers)
                → Phase 8 (tests)
                    → Phase 9 (build + test)
                        → Phase 10 (docs + memory)
```

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
