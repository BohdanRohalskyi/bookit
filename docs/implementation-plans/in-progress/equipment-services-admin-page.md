---
title: "Equipment & Services Admin Page"
status: IN_PROGRESS
created: 2026-04-24
author: "bohdan.rohalskyi@paysera.com"
---

# Plan: Equipment & Services Admin Page

## Summary

Adds a combined "Equipment & Services" page to the biz admin panel where business
owners (and administrators, per the RBAC plan) can manage the business-level catalog
of equipment and services. Equipment supports list / create / edit name / delete
(blocked if any service references it). Services support list / create / edit
(name, description, duration, price, currency, equipment requirements) / delete.

**Goal:** Give providers a self-service CRUD UI for their catalog before attaching
items to specific locations.

---

## Dependencies

- `rbac-admin-catalog-access` (in-progress) — Phase 5 (integration tests) is still
  PENDING but Phases 2–4 are DONE, meaning the access-control changes are already
  live. This plan can proceed in parallel; the RBAC plan's Phase 5 is independent.

---

## Phases

### Phase 1: Feature flag — `ADMIN_EQUIPMENT_SERVICES` `[REJECTED]`

**Reason:** Removed per user decision — shipping the page unconditionally.

---

### Phase 2: OpenAPI spec — add PATCH endpoints `[PENDING]`

Add two PATCH operations to `api/openapi/spec.yaml` before writing any Go code.

**`PATCH /api/v1/equipment/{id}`** — `operationId: updateEquipment`

Request body schema `EquipmentUpdate`:
```yaml
EquipmentUpdate:
  type: object
  required: [name]
  properties:
    name:
      type: string
      minLength: 1
      maxLength: 120
```

Response `200`: `Equipment` schema (same as GET).  
Errors: `400` ValidationError, `401` Unauthorized, `403` ProviderRequired, `404` NotFound.

**`PATCH /api/v1/services/{id}`** — `operationId: updateService`

Request body schema `ServiceUpdate`:
```yaml
ServiceUpdate:
  type: object
  properties:
    name:
      type: string
      minLength: 1
      maxLength: 120
    description:
      type: string
    duration_minutes:
      type: integer
      minimum: 1
    price:
      type: number
      format: float
    currency:
      type: string
      minLength: 3
      maxLength: 3
    equipment_requirements:
      type: array
      items:
        $ref: '#/components/schemas/ServiceEquipmentRequirementCreate'
```

All fields optional (partial update). Response `200`: `Service` schema.  
Errors: `400`, `401`, `403`, `404`.

After updating the spec:
```bash
cd api && make generate
```

---

### Phase 3: Go backend — UpdateEquipment + UpdateService `[PENDING]`

**Affected files:** `catalog_handler.go`, `catalog_service.go`, `catalog_repository.go`

#### Repository (`catalog_repository.go`)

`UpdateEquipment(ctx, id int64, name string) (Equipment, error)`
```sql
UPDATE equipment SET name = $1 WHERE id = $2
RETURNING id, uuid, business_id, name, created_at
```

`UpdateService(ctx, id int64, req ServiceUpdate) (ServiceItem, error)`
- Build dynamic SET clause for only the provided fields.
- If `equipment_requirements` is provided: delete existing rows from
  `service_equipment_requirements` and re-insert in the same transaction.

#### Service (`catalog_service.go`)

`UpdateEquipment(ctx, userID, id int64, name string) (Equipment, error)`
- `canWriteBusiness` check (owner or administrator).
- Delegate to `repo.UpdateEquipment`.

`UpdateService(ctx, userID, id int64, req ServiceUpdate) (ServiceItem, error)`
- `canWriteBusiness` check.
- Delegate to `repo.UpdateService`.

#### Handler (`catalog_handler.go`)

`UpdateEquipment(c *gin.Context)` — `PATCH /api/v1/equipment/:id`
- Resolve path UUID → int64 via `GetEquipmentByUUID`.
- Bind `EquipmentUpdate` body; validate `name` non-empty.
- Call `service.UpdateEquipment`; map errors via `catalogErr`.
- Return `200` with `toEquipmentResp`.

`UpdateService(c *gin.Context)` — `PATCH /api/v1/services/:id`
- Resolve path UUID → int64.
- Bind `ServiceUpdate`; validate non-zero fields.
- Call `service.UpdateService`; map errors.
- Return `200` with `toServiceResp`.

Register both routes in the router file after creating them.

---

### Phase 4: Go backend — equipment in-use guard for DeleteEquipment `[PENDING]`

**Affected files:** `catalog_repository.go`, `catalog_service.go`

**New error sentinel:**
```go
var ErrEquipmentInUse = errors.New("equipment is referenced by one or more services")
```

**Repository** — `IsEquipmentInUse(ctx, equipmentID int64) (bool, error)`:
```sql
SELECT EXISTS (
  SELECT 1 FROM service_equipment_requirements WHERE equipment_id = $1
)
```

**Service** — insert in-use check into `DeleteEquipment` (before the ownership check
already passes, so order is: ownership first, then in-use):
```go
inUse, err := s.repo.IsEquipmentInUse(ctx, id)
if err != nil { return err }
if inUse { return ErrEquipmentInUse }
```

**Handler** — add a `case ErrEquipmentInUse` branch in `catalogErr`:
```go
case ErrEquipmentInUse:
    errResp(c, http.StatusConflict, "equipment-in-use",
        "Equipment In Use",
        "This equipment is referenced by one or more services and cannot be deleted.")
```

This returns HTTP `409 Conflict`. No spec change needed — `409` is already a standard
response in the project's error vocabulary.

---

### Phase 5: Frontend — API client `[PENDING]`

**New file:** `web/packages/biz/src/api/catalogApi.ts`

Use `openapi-fetch` (`api` from `@bookit/shared/api`) — never `fetch` directly.

Functions to implement:

```ts
// Equipment
listEquipment(businessId: string): Promise<Equipment[]>
createEquipment(businessId: string, name: string): Promise<Equipment>
updateEquipment(id: string, name: string): Promise<Equipment>
deleteEquipment(id: string): Promise<void>

// Services
listServices(businessId: string): Promise<Service[]>
createService(businessId: string, body: ServiceCreate): Promise<Service>
updateService(id: string, body: ServiceUpdate): Promise<Service>
deleteService(id: string): Promise<void>
```

All return typed values from `types.gen.ts`. Throw on `error` response.

After adding the new PATCH endpoints to the spec, regenerate TS types:
```bash
cd web && npm run generate:types
```

---

### Phase 6: Frontend — EquipmentServices page `[PENDING]`

**New file:** `web/packages/biz/src/pages/EquipmentServices.tsx`

**Layout:** Two tabs — "Equipment" and "Services" — rendered via a local tab state
(`useState<'equipment' | 'services'>`). No URL-level tabs (no sub-routing needed).

#### Equipment tab

- Table/list: name, "Edit" icon button, "Delete" icon button.
- "Add equipment" button → inline dialog (shadcn `Dialog`) with a single name input.
- Edit → same dialog pre-filled.
- Delete → shadcn `AlertDialog` confirmation. On `409 Conflict` from API, show toast:
  _"This equipment is used by one or more services and cannot be deleted."_
- TanStack Query: `queryKey: ['equipment', businessId]`.
- Empty state: _"No equipment yet. Add your first item."_

#### Services tab

- Table/list: name, duration, price, equipment requirements count, "Edit" button,
  "Delete" button.
- "Add service" / "Edit service" → slide-over or modal form with all editable fields:
  - Name (text)
  - Description (textarea)
  - Duration in minutes (number)
  - Price + currency (number + 3-char text or select)
  - Equipment requirements: multi-select from the business equipment list, each with
    a quantity-needed field.
- Delete → `AlertDialog` confirmation.
- TanStack Query: `queryKey: ['services', businessId]`.
- Empty state: _"No services yet. Create your first service."_

#### Route + nav

- Route in `web/packages/biz/src/App.tsx`: `/dashboard/catalog`
- Sidebar nav entry: "Catalog" (or "Equipment & Services"), icon `Package`.
- Both the route and the nav item are wrapped in `useFeatureFlag(FLAGS.ADMIN_EQUIPMENT_SERVICES)`.

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
