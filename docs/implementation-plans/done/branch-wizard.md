---
title: "Branch Creation Wizard"
status: DONE
created: 2026-04-15
author: "bohdan.rohalskyi@paysera.com"
---

# Plan: Branch Creation Wizard

## Summary

Replace the single-page branch form with a 4-step wizard. Each step saves independently.
The wizard replaces `BranchForm.tsx` for both create and edit flows.

**Goal:** Provider creates a branch step-by-step:
1. Basic info + photos
2. Working schedule
3. Equipment pool (name + quantity) & Staff pool (job title + quantity)
4. Services (name, description, required equipment, required staff, duration, price)

---

## Data model (business-level catalog + branch-level pivot)

### Core principle
Equipment types, staff roles, and services are **business-level entities** — defined
once for the whole business and reused across all branches. Branch-level pivot tables
track which resources are available at a specific branch and in what quantity.

This makes second-branch setup fast: the provider picks from an already-existing
catalog instead of re-entering everything from scratch.

---

### Business-level tables (master catalog)

**`equipment`** — equipment types defined for the business:
- `business_id` FK
- `name` — e.g. "Massage table"

**`staff_roles`** — job role types defined for the business:
- `business_id` FK
- `job_title` — e.g. "Personal trainer"

*Note: the existing `staff` table (individual people) is untouched. Full personal
management is a separate future feature.*

**`services`** — services defined for the business:
- `business_id` FK
- `name`, `description`, `duration_minutes`, `price`, `currency`
- `equipment_requirements` — how many of which equipment type per booking
- `staff_requirements` — how many of which role per booking

**`service_equipment_requirements`** — `(service_id, equipment_id, quantity_needed)`
**`service_staff_requirements`** — `(service_id, staff_role_id, quantity_needed)`

---

### Branch-level pivot tables (configuration per branch)

**`branch_equipment`** — which equipment is available at this branch and how many:
- `(branch_id, equipment_id, quantity)`
- e.g. "Main Street branch has 3 massage tables"

**`branch_staff_roles`** — which roles are staffed at this branch and how many:
- `(branch_id, staff_role_id, quantity)`
- e.g. "Main Street branch has 2 personal trainers"

**`branch_services`** — which services are offered at this branch:
- `(branch_id, service_id, is_active)`
- Service definition (pricing, duration, requirements) lives at business level;
  the pivot just enables/disables it per branch

---

### Step 3 UI — Equipment & Staff
Provider picks from the **business catalog** (shared pool) and sets quantities for
this specific branch. Items not yet in the catalog can be created inline — they are
saved to the business-level table and immediately available to all branches.

### Step 4 UI — Services
Provider picks from the **business service catalog**. Requirements (equipment/staff)
are defined at the service level, not the branch level. The two-column form lets the
provider create or select services and enable them for this branch.

---

## Phases

### Phase 1: Spec + backend — equipment, staff, services `[PENDING]`

**OpenAPI spec changes (`api/openapi/spec.yaml`):**

Update `Equipment` schema — replace `capacity`/`description` with `quantity`:
```yaml
Equipment:
  required: [id, branch_id, name, quantity, is_active, created_at]
  properties:
    id, branch_id, name: string
    quantity: integer (min: 1)
    is_active: boolean
    created_at, updated_at: date-time
```

Add business-level catalog schemas:
```yaml
StaffRole:
  required: [id, business_id, job_title, created_at]
  properties:
    id, business_id: uuid
    job_title: string

StaffRoleCreate:
  required: [business_id, job_title]

Equipment:  # simplified — replace capacity/description with just name
  required: [id, business_id, name, created_at]
  properties:
    id, business_id: uuid
    name: string
```

Add branch-level pivot schemas:
```yaml
BranchEquipment:
  required: [id, branch_id, equipment_id, equipment_name, quantity]
  properties:
    id, branch_id, equipment_id: uuid
    equipment_name: string  # denormalised for display
    quantity: integer (min: 1)

BranchStaffRole:
  required: [id, branch_id, staff_role_id, job_title, quantity]
  properties:
    id, branch_id, staff_role_id: uuid
    job_title: string  # denormalised for display
    quantity: integer (min: 1)

BranchService:
  required: [id, branch_id, service_id, is_active]
  properties:
    id, branch_id, service_id: uuid
    is_active: boolean
    service: Service  # embedded
```

Add endpoints:
- `GET/POST /api/v1/equipment` (business-level), `DELETE /api/v1/equipment/{id}`
- `GET/POST /api/v1/staff-roles` (business-level), `DELETE /api/v1/staff-roles/{id}`
- `GET/POST /api/v1/services` (business-level), `DELETE /api/v1/services/{id}`
- `GET/POST /api/v1/branches/{id}/equipment`, `DELETE /api/v1/branches/{id}/equipment/{item_id}`
- `GET/POST /api/v1/branches/{id}/staff-roles`, `DELETE /api/v1/branches/{id}/staff-roles/{item_id}`
- `GET/POST /api/v1/branches/{id}/services`, `DELETE /api/v1/branches/{id}/services/{item_id}`

*The existing `Staff` schema and `/api/v1/staff` endpoints are untouched.*

Update `ServiceCreate` to include requirements inline:
```yaml
ServiceCreate:
  required: [name, duration_minutes, price]
  properties:
    name: string (max 100)
    description: string (optional)
    duration_minutes: integer
    price: number
    currency: string (default EUR)
    equipment_requirements:
      type: array
      items: {equipment_id: uuid, quantity_needed: integer}
    staff_requirements:
      type: array
      items: {staff_role_id: uuid, quantity_needed: integer}
```

Update `Service` response to embed resolved requirements:
```yaml
Service:
  ...existing fields...
  equipment_requirements:
    type: array
    items: {equipment_id, equipment_name, quantity_needed}
  staff_requirements:
    type: array
    items: {staff_role_id, job_title, quantity_needed}
```

Remove `EquipmentCreate.description`, `EquipmentCreate.capacity` → add `quantity`.
*`StaffCreate` and `Staff` schema are untouched.*

After spec changes: `cd web && npm run generate:types`

**Migrations:**

`000009_create_catalog_tables.up.sql` — business-level master catalog:
```sql
-- Equipment types (business-level)
CREATE TABLE equipment (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_equipment_business_id ON equipment(business_id);

-- Staff role types (business-level, separate from individual staff members)
CREATE TABLE staff_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    job_title   VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_staff_roles_business_id ON staff_roles(business_id);

-- Services (business-level)
CREATE TABLE services (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    description      TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    currency         CHAR(3) NOT NULL DEFAULT 'EUR',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_services_business_id ON services(business_id);

-- Service resource requirements (business-level)
CREATE TABLE service_equipment_requirements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    equipment_id    UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    quantity_needed SMALLINT NOT NULL DEFAULT 1 CHECK (quantity_needed >= 1),
    UNIQUE (service_id, equipment_id)
);

CREATE TABLE service_staff_requirements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    staff_role_id   UUID NOT NULL REFERENCES staff_roles(id) ON DELETE CASCADE,
    quantity_needed SMALLINT NOT NULL DEFAULT 1 CHECK (quantity_needed >= 1),
    UNIQUE (service_id, staff_role_id)
);
```

`000010_create_branch_pivot_tables.up.sql` — branch-level configuration:
```sql
-- Equipment available at this branch
CREATE TABLE branch_equipment (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    quantity     SMALLINT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    UNIQUE (branch_id, equipment_id)
);

-- Staff roles staffed at this branch
CREATE TABLE branch_staff_roles (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    staff_role_id UUID NOT NULL REFERENCES staff_roles(id) ON DELETE CASCADE,
    quantity     SMALLINT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    UNIQUE (branch_id, staff_role_id)
);

-- Services offered at this branch
CREATE TABLE branch_services (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (branch_id, service_id)
);
```

**Go catalog domain** — follow `branch_*.go` pattern:
Files to create (follow `branch_*.go` pattern):
- `equipment_repository.go` — business-level CRUD + `ListByBusinessID`
- `staff_role_repository.go` — business-level CRUD + `ListByBusinessID`
- `service_repository.go` — business-level CRUD with requirements (transaction)
- `branch_resource_repository.go` — pivot CRUD for branch_equipment, branch_staff_roles, branch_services
- `equipment_service.go`, `staff_role_service.go`, `service_service.go` — ownership via business
- `branch_resource_service.go` — ownership via branch → business
- `equipment_handler.go`, `staff_role_handler.go`, `service_handler.go` — business-level handlers
- `branch_resource_handler.go` — branch-level pivot handlers

Register routes in `main.go`:
```
Business-level (ownership: provider owns business):
  GET/POST /api/v1/equipment          DELETE /api/v1/equipment/{id}
  GET/POST /api/v1/staff-roles        DELETE /api/v1/staff-roles/{id}
  GET/POST /api/v1/services           DELETE /api/v1/services/{id}

Branch-level pivots (ownership: provider owns branch's business):
  GET/POST /api/v1/branches/{id}/equipment        DELETE …/equipment/{item_id}
  GET/POST /api/v1/branches/{id}/staff-roles      DELETE …/staff-roles/{item_id}
  GET/POST /api/v1/branches/{id}/services         DELETE …/services/{item_id}
```

*Existing `/api/v1/staff` endpoints are not touched.*
*No update endpoints needed for MVP — provider deletes and re-creates.*

---

### Phase 2: Wizard shell — tabs + state `[PENDING]`

**New page:** `web/packages/biz/src/pages/BranchWizard.tsx`

- Routes: `/dashboard/businesses/:businessId/branches/new` (create) and
  `/dashboard/businesses/:businessId/branches/:branchId/edit` (edit)
- State: `branchId` (null until step 1 saves), `currentStep` (1–4)
- **Create flow**: step 1 POSTs → sets `branchId` → unlock subsequent steps
- **Edit flow**: `branchId` from URL params, all steps immediately accessible
- Tab bar: steps 1–4 with labels, checkmark when step has been visited+saved
- Steps rendered as child components, each receiving `branchId` + `onNext`/`onBack` callbacks

---

### Phase 3: Step 1 — Basic info + photos `[PENDING]`

`src/components/wizard/StepBasicInfo.tsx`

- Fields: name, address, city, country, phone, email, timezone
- Photo grid: same `PhotoGallery` logic (upload / delete per photo)
- Save: `POST /api/v1/branches` (create) or `PUT /api/v1/branches/{id}` (edit)
- On success → calls `onNext(branchId)`

---

### Phase 4: Step 2 — Working schedule `[PENDING]`

`src/components/wizard/StepSchedule.tsx`

- 7-day open/close grid (extracted from `BranchDetail.tsx` `ScheduleEditor`)
- Save: `PUT /api/v1/branches/{id}/schedule/days`
- On success → calls `onNext()`

---

### Phase 5: Step 3 — Equipment & Staff pools `[PENDING]`

`src/components/wizard/StepTeamEquipment.tsx`

**Equipment section:**

Two sub-areas side by side or stacked:

*Business catalog picker* — select from equipment already defined for the business
(`GET /api/v1/equipment?business_id=`) + set quantity for this branch
→ `POST /api/v1/branches/{id}/equipment` `{equipment_id, quantity}`

*Create new* — if the equipment doesn't exist yet, an inline form creates it at
business level first (`POST /api/v1/equipment {business_id, name}`), then
immediately links it to this branch with a quantity.

- List from `GET /api/v1/branches/{id}/equipment` (returns equipment_name + quantity)
- Delete pivot row → `DELETE /api/v1/branches/{id}/equipment/{item_id}`
- Example display: "Massage table · 3 units"

**Staff roles section:**

Same pattern as equipment:
- Select from business-level roles (`GET /api/v1/staff-roles?business_id=`) + quantity
  → `POST /api/v1/branches/{id}/staff-roles` `{staff_role_id, quantity}`
- Or create new role inline (`POST /api/v1/staff-roles {business_id, job_title}`)
  then link it
- List from `GET /api/v1/branches/{id}/staff-roles` (returns job_title + quantity)
- Delete pivot row → `DELETE /api/v1/branches/{id}/staff-roles/{item_id}`
- Example display: "Personal trainer · 2 persons"

No "Save & Continue" API call needed — items are persisted inline.
Continue button just calls `onNext()`.

---

### Phase 6: Step 4 — Services `[PENDING]`

`src/components/wizard/StepServices.tsx`

**Service list:** `GET /api/v1/services?branch_id=` — cards showing name, duration,
price, required equipment and staff counts. Delete per service.

**Service list:** `GET /api/v1/branches/{id}/services` — shows services enabled for
this branch. Provider can also enable existing business-level services not yet linked.

**Add / create service form:**
```
[Name]                     [Description]
[Duration (minutes)]       [Price] [Currency EUR]

Equipment needed                |   Staff needed
[Select equipment ▾]  [Qty]     |   [Select job title ▾]  [Qty]
[+ Add row]                     |   [+ Add row]
```
- Equipment select: from **business-level** equipment (`GET /api/v1/equipment?business_id=`)
- Staff role select: from **business-level** staff roles (`GET /api/v1/staff-roles?business_id=`)
- Requirements stay at the service (business) level — not per-branch
- On submit:
  1. `POST /api/v1/services` `{business_id, name, description, duration_minutes, price, currency, equipment_requirements, staff_requirements}`
  2. `POST /api/v1/branches/{id}/services` `{service_id}` — enable for this branch

**Enable existing service:** provider can pick a service already defined in the
business catalog and just enable it for this branch without re-entering details.

On **Finish** → navigate to `/dashboard/businesses/:businessId/branches/:branchId`

---

### Phase 7: Cleanup `[PENDING]`

- Remove `BranchForm.tsx` (replaced by wizard Step 1)
- Remove `ScheduleEditor` + `PhotoGallery` from `BranchDetail.tsx` — detail page
  becomes read-only summary with "Edit in wizard" button
- Update `App.tsx` routes to point to `BranchWizard` for create + edit
- `npx tsc -b` — zero errors

---

## Dependencies

- Phase 1 must complete before Phases 5 & 6 (API not available otherwise)
- Phase 2 can be built in parallel with Phase 1
- Phases 3 → 4 → 5 → 6 → 7 are sequential

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
