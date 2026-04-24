---
title: "RBAC: Admin Catalog Access"
status: DONE
created: 2026-04-21
author: "bohdan.rohalskyi@paysera.com"
---

# Plan: RBAC — Admin Catalog Access

## Summary

Administrators are currently blocked from all catalog routes (equipment, services,
staff roles, location pivot tables) because `CatalogService` only accepts the business
owner. `LocationService` is already correct — it uses `canReadLocation`/`canEditLocation`
helpers that handle owners and location-scoped admins. This plan ports the same pattern
to `CatalogService` so admins can manage the resources at their location(s) without
receiving an implicit 403.

**Goal:** Make every catalog endpoint respect the owner / administrator invariant — owners
can do everything; administrators can read and write (but not delete master catalog items)
within their assigned location(s).

---

## Access invariants (reference)

| Operation | Owner | Administrator | Staff |
|-----------|-------|---------------|-------|
| Location read/write | ✓ | ✓ (assigned location(s)) | read only |
| Location create/delete | ✓ | ✗ | ✗ |
| Equipment / Services / Staff-roles — list + create (business level) | ✓ | ✓ | ✗ |
| Equipment / Services / Staff-roles — delete (business level) | ✓ | ✗ | ✗ |
| Location pivot (assign/list/remove equipment, services, staff-roles) | ✓ | ✓ (assigned location(s)) | ✗ |
| Members (staff management) | ✓ | ✓ | ✗ |

---

## Phases

### Phase 1: Feature flag `[REJECTED]`

**Reason:** Removed per user decision — shipping the fix unconditionally.

---

### Phase 2: Add access-control helpers to `CatalogService` `[DONE]`

`CatalogService` already holds `locationRepo *LocationRepository`, which exposes
`GetMemberAccess(ctx, userID, businessID) (MemberAccess, error)` — the same data
source `LocationService` uses. No new repository methods or imports are required.

Add three helpers mirroring the `LocationService` pattern:

**`memberAccess(ctx, userID, businessID) (*MemberAccess, error)`**
- Owner check first → return `nil, nil` (full access, no restrictions).
- Otherwise call `locationRepo.GetMemberAccess` → return the struct.
- Return `ErrNotOwner` if the user has neither ownership nor a role assignment.

**`canReadBusiness(ctx, userID, businessID) error`**
- Passes for owner **or** any role member (admin or staff) of the business.
- Used for: `ListEquipment`, `ListStaffRoles`, `ListServices`.

**`canWriteBusiness(ctx, userID, businessID) error`**
- Passes for owner **or** administrator of the business (`access.Role == "administrator"`).
- Denies staff.
- Used for: `CreateEquipment`, `CreateStaffRole`, `CreateService`.

**`canReadLocation(ctx, userID, locationID) error`** (mirrors `LocationService.canReadLocation`)
- Resolves `businessID` from `locationID` via `locationRepo.GetOwnerBusinessID`.
- Passes for owner or any member with access to that location.
- Used for: `ListLocationEquipment`, `ListLocationStaffRoles`, `ListLocationServices`.

**`canEditLocation(ctx, userID, locationID) error`** (mirrors `LocationService.canEditLocation`)
- Resolves `businessID` from `locationID`.
- Passes for owner or administrator with access to that location.
- Denies staff and admins restricted to a different location.
- Used for: `AddLocation*`, `RemoveLocation*` pivot methods.

---

### Phase 3: Wire helpers into `CatalogService` methods `[DONE]`

Replace access checks method by method. Delete operations stay on `ownsBusinessID` /
`ownsLocationID` — admin cannot delete master catalog items.

**Business-level (replace `ownsBusinessID`):**

| Method | Old check | New check |
|--------|-----------|-----------|
| `ListEquipment` | `ownsBusinessID` | `canReadBusiness` |
| `CreateEquipment` | `ownsBusinessID` | `canWriteBusiness` |
| `DeleteEquipment` | `ownsBusinessID` | `ownsBusinessID` ← keep |
| `ListStaffRoles` | `ownsBusinessID` | `canReadBusiness` |
| `CreateStaffRole` | `ownsBusinessID` | `canWriteBusiness` |
| `DeleteStaffRole` | `ownsBusinessID` | `ownsBusinessID` ← keep |
| `ListServices` | `ownsBusinessID` | `canReadBusiness` |
| `CreateService` | `ownsBusinessID` | `canWriteBusiness` |
| `DeleteService` | `ownsBusinessID` | `ownsBusinessID` ← keep |

**Location-pivot (replace `ownsLocationID`):**

| Method | Old check | New check |
|--------|-----------|-----------|
| `ListLocationEquipment` | `ownsLocationID` | `canReadLocation` |
| `AddLocationEquipment` | `ownsLocationID` | `canEditLocation` |
| `RemoveLocationEquipment` | `ownsLocationID` | `canEditLocation` |
| `ListLocationStaffRoles` | `ownsLocationID` | `canReadLocation` |
| `AddLocationStaffRole` | `ownsLocationID` | `canEditLocation` |
| `RemoveLocationStaffRole` | `ownsLocationID` | `canEditLocation` |
| `ListLocationServices` | `ownsLocationID` | `canReadLocation` |
| `AddLocationService` | `ownsLocationID` | `canEditLocation` |
| `RemoveLocationService` | `ownsLocationID` | `canEditLocation` |

All nine location-pivot removals also include an ownership cross-check on the item's
`locationID` — that check stays unchanged; it guards against mismatched IDs, not auth.

---

### Phase 4: Map `ErrNotOwner` → 403 in `CatalogItemHandler` `[DONE]`

`CatalogItemHandler` currently maps `ErrNotOwner` and `ErrNotProvider` to 403. Verify
the new helpers return the same sentinel errors so the HTTP mapping is unchanged.
No new error codes needed.

---

### Phase 5: Integration test `[DONE]`

Add table-driven tests in `catalog/catalog_service_test.go` (or a new
`catalog/rbac_test.go`) covering:

- Owner can list/create/delete equipment at any location.
- Administrator (business-wide) can list/create equipment; cannot delete.
- Administrator (location-scoped) can access their location; gets denied on another.
- Staff cannot access any catalog write operation.
- Unauthenticated / no-assignment user gets `ErrNotOwner`.

Tests use a real DB (per project convention — no mocks for the repository layer).

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
