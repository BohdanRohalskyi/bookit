---
title: "Branch Management"
status: NEW
created: 2026-04-15
author: "bohdan.rohalskyi@paysera.com"
---

# Plan: Branch Management

## Summary

Providers need to manage branches (physical locations) for each business. Every branch has
its own address, contact details, and a weekly working schedule with support for date-specific
exceptions (holidays, renovations, custom hours). The existing "location" concept throughout
the spec, backend, and frontend is renamed to "branch" for clarity.

**Goal:** Provider can create, edit, and delete branches for a business; set a weekly working
schedule per branch; and add date-specific schedule exceptions.

---

## Phases

### Phase 1: Spec rename — location → branch + schedule schemas `[DONE]`

**`api/openapi/spec.yaml` changes:**

1. Rename all `Location*` schemas → `Branch*`:
   - `Location` → `Branch`
   - `LocationCreate` → `BranchCreate`
   - `LocationUpdate` → `BranchUpdate`
   - `LocationList` → `BranchList`
   - `LocationSearchResult` → `BranchSearchResult`
   - `LocationSearchItem` → `BranchSearchItem`
   - `LocationId` parameter → `BranchId`

2. Rename paths: `/api/v1/locations` → `/api/v1/branches`, `/api/v1/locations/{id}` → `/api/v1/branches/{id}`

3. Rename `location_id` → `branch_id` in all downstream schemas: `Service`, `Staff`,
   `Equipment`, `Booking`, and any query parameters that filter by location.

4. Add `DELETE /api/v1/branches/{id}` (204 on success, 401/403/404 on error).

5. Add schedule endpoints:
   - `GET /api/v1/branches/{id}/schedule` — returns branch schedule with days and upcoming exceptions
   - `PUT /api/v1/branches/{id}/schedule/days` — replace full weekly schedule (7 days)
   - `GET /api/v1/branches/{id}/schedule/exceptions` — list exceptions
   - `POST /api/v1/branches/{id}/schedule/exceptions` — create exception
   - `DELETE /api/v1/branches/{id}/schedule/exceptions/{exception_id}` — remove exception

6. Add schedule schemas:
   ```yaml
   Schedule:
     type: object
     properties:
       branch_id: uuid
       days: array of ScheduleDay
       exceptions: array of ScheduleException (upcoming only on GET)

   ScheduleDay:
     type: object
     required: [day_of_week, is_open]
     properties:
       day_of_week: integer (0=Monday … 6=Sunday)
       is_open: boolean
       open_time: string (HH:MM, nullable)
       close_time: string (HH:MM, nullable)

   ScheduleException:
     type: object
     required: [id, branch_id, date, is_closed]
     properties:
       id: uuid
       branch_id: uuid
       date: string (date)
       is_closed: boolean
       open_time: string (HH:MM, nullable)
       close_time: string (HH:MM, nullable)
       reason: string (nullable)
   ```

After spec changes: `cd web && npm run generate:types`

---

### Phase 2: Database migrations `[DONE]`

**`000007_create_branches_table.up.sql`:**
```sql
CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  address     VARCHAR(200) NOT NULL,
  city        VARCHAR(100) NOT NULL,
  country     VARCHAR(100) NOT NULL,
  phone       VARCHAR(50),
  email       VARCHAR(255),
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  timezone    VARCHAR(100) NOT NULL DEFAULT 'Europe/Vilnius',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_branches_business_id ON branches(business_id);
```

**`000008_create_schedules_table.up.sql`:**
```sql
CREATE TABLE schedules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  UUID NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedule_days (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open      BOOLEAN NOT NULL DEFAULT false,
  open_time    TIME,
  close_time   TIME,
  UNIQUE (schedule_id, day_of_week)
);

CREATE TABLE schedule_exceptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  is_closed   BOOLEAN NOT NULL DEFAULT true,
  open_time   TIME,
  close_time  TIME,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (schedule_id, date)
);
CREATE INDEX idx_schedule_exceptions_date ON schedule_exceptions(schedule_id, date);
```

---

### Phase 3: Go backend — branch domain `[DONE]`

Create `api/internal/catalog/branch/` (or extend existing catalog package):

**`repository.go`** — pgx queries:
- `Create(ctx, businessID UUID, req BranchCreate) (Branch, error)`
- `GetByID(ctx, id UUID) (Branch, error)`
- `ListByBusinessID(ctx, businessID UUID, page, perPage int) ([]Branch, int, error)`
- `Update(ctx, id UUID, req BranchUpdate) (Branch, error)`
- `Delete(ctx, id UUID) error`
- `GetOwnerBusinessID(ctx, branchID UUID) (UUID, error)` — for ownership checks

**`schedule_repository.go`** — pgx queries:
- `GetSchedule(ctx, branchID UUID) (Schedule, error)` — creates default if not exists
- `UpsertScheduleDays(ctx, scheduleID UUID, days []ScheduleDay) error`
- `ListExceptions(ctx, scheduleID UUID) ([]ScheduleException, error)`
- `CreateException(ctx, scheduleID UUID, req ScheduleExceptionCreate) (ScheduleException, error)`
- `DeleteException(ctx, id UUID) error`

**`service.go`** — ownership checks on all mutating operations via `catalog.Repository.GetProviderIDByUserID`

**`handler.go`** — Gin handlers, RFC 7807 errors:
- `ListBranches` — GET /api/v1/branches?business_id=
- `CreateBranch` — POST /api/v1/branches
- `GetBranch` — GET /api/v1/branches/:id
- `UpdateBranch` — PUT /api/v1/branches/:id
- `DeleteBranch` — DELETE /api/v1/branches/:id
- `GetSchedule` — GET /api/v1/branches/:id/schedule
- `UpsertScheduleDays` — PUT /api/v1/branches/:id/schedule/days
- `ListExceptions` — GET /api/v1/branches/:id/schedule/exceptions
- `CreateException` — POST /api/v1/branches/:id/schedule/exceptions
- `DeleteException` — DELETE /api/v1/branches/:id/schedule/exceptions/:exception_id

Register all routes in `cmd/server/main.go`.

---

### Phase 4: Frontend — branch list on business page `[DONE]`

Update `web/packages/biz/src/pages/Businesses.tsx` and add a branch drill-down:

- Each business card gets a "Manage branches" link → `/dashboard/businesses/:businessId/branches`
- New route: `/dashboard/businesses/:businessId/branches`
- New page: `BranchList.tsx` — lists branches for the selected business, "Add branch" button, edit/delete per branch

Update `App.tsx` routing to add new routes under `DashboardLayout`.

---

### Phase 5: Frontend — add/edit branch form `[DONE]`

New page: `BranchForm.tsx` (create + edit, driven by presence of `branchId` param):
- Fields: name (required), address, city, country (required), phone, email, timezone
- Route create: `/dashboard/businesses/:businessId/branches/new`
- Route edit: `/dashboard/businesses/:businessId/branches/:branchId/edit`
- Submit → `POST /api/v1/branches` or `PUT /api/v1/branches/:id`
- On success → navigate back to branch list

---

### Phase 6: Frontend — schedule management `[DONE]`

New component (embedded in branch detail page or separate route):
`BranchSchedule.tsx`:
- 7-day weekly grid: toggle is_open per day, set open/close time
- Submit → `PUT /api/v1/branches/:id/schedule/days`

New component: `ScheduleExceptions.tsx`:
- List upcoming exceptions
- Add exception: date picker, is_closed toggle, optional time range, reason
- Delete exception

Mount both components on `/dashboard/businesses/:businessId/branches/:branchId` (branch detail page).

---

### Phase 7: Branch photos `[DONE]`

**Spec** — add to Phase 1:
- `BranchPhoto` schema: `id`, `branch_id`, `url`, `display_order`, `created_at`
- `GET /api/v1/branches/{id}/photos` — list photos (ordered by `display_order`)
- `POST /api/v1/branches/{id}/photos` — multipart upload, returns `BranchPhoto`
- `DELETE /api/v1/branches/{id}/photos/{photo_id}` — 204

**Migration** — add to Phase 2 (`000008` or separate `000009`):
```sql
CREATE TABLE branch_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_branch_photos_branch_id ON branch_photos(branch_id);
```

**Backend** — add to Phase 3:
- Repository: `ListPhotos`, `CreatePhoto` (upload via `StorageUploader`, GCS path: `branches/<id>/photos/<photoID>.<ext>`), `DeletePhoto`
- Service: ownership check on upload and delete
- Handlers: `ListPhotos`, `UploadPhoto`, `DeletePhoto`
- Uses same `StorageUploader` interface — local filesystem in dev, GCS in prod

**Frontend** — add to Phase 5 (branch form) or branch detail page:
- Photo grid: shows existing photos, drag-to-reorder (optional)
- Upload button: file picker (JPEG/PNG/WebP, max 10 MB each)
- Delete button per photo (with confirm)
- Displays up to e.g. 10 photos

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
