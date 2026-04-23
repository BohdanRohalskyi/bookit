---
title: "Booking Management — Admin Panel"
status: NEW
created: 2026-04-21
author: "bohdan@rohalskyi.com"
---

# Plan: Booking Management — Admin Panel

## Summary

Extends the admin panel so business owners and super-admins can view, filter, and manage bookings for their locations. Covers the Go API (admin booking endpoints), the React admin UI (booking list, detail drawer, status actions), and real-time status updates via polling.

**Goal:** Give admins visibility and control over all bookings for their business, including confirming, completing, and cancelling bookings.

---

## Phases

### Phase 1: Feature flag — `ADMIN_BOOKING_MANAGEMENT` `[PENDING]`

Add `FLAGS.ADMIN_BOOKING_MANAGEMENT` to `web/packages/shared/src/features/flags.ts`.
Gate the admin bookings route and sidebar nav item with `useFeatureFlag(FLAGS.ADMIN_BOOKING_MANAGEMENT)`.
Flag is activated in Firebase Remote Config by the project owner.

---

### Phase 2: OpenAPI spec — admin booking endpoints `[PENDING]`

Add to `api/openapi/spec.yaml`:

- `GET /admin/bookings` — paginated list of bookings for the caller's business (or all for super-admin)
  - Query params: `location_id`, `status`, `date_from`, `date_to`, `page`, `page_size`
  - Auth: `admin` or `super_admin` role
- `GET /admin/bookings/{id}` — full booking detail (consumer info, service, slot, notes, status history)
- `PATCH /admin/bookings/{id}/status` — transition booking status
  - Body: `{ status: 'confirmed' | 'cancelled' | 'completed', reason? }`
  - Validates allowed transitions (pending→confirmed, pending→cancelled, confirmed→completed, confirmed→cancelled)
  - Auth: `admin` (own business) or `super_admin`

Run `oapi-codegen` and `openapi-typescript` after spec update.

---

### Phase 3: Database — status history `[PENDING]`

Write migration `api/db/migrations/NNNN_booking_status_history.sql`:

```sql
CREATE TABLE booking_status_history (
  id          BIGSERIAL PRIMARY KEY,
  uuid        UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  booking_id  BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  changed_by  BIGINT REFERENCES users(id),
  reason      TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Insert a row on every status transition from the Go handler.

---

### Phase 4: Go — admin booking handlers `[PENDING]`

Implement admin endpoints in the Booking domain (`api/internal/booking/`).

**List handler:**
- Super-admin: no business filter applied
- Admin: enforce filter by business_id derived from JWT claims
- Apply optional filters (location_id, status, date range)
- Return paginated results with consumer name, service name, slot time, status

**Status transition handler:**
- Validate allowed transition matrix; return 422 for invalid transitions
- Write new status to `bookings` and append row to `booking_status_history`
- Publish `booking.status_changed` internal event (triggers consumer notification email)

---

### Phase 5: Go — consumer notification on status change `[PENDING]`

In the Notification domain, subscribe to `booking.status_changed` and send a transactional email:
- **Confirmed** → "Your booking is confirmed" template
- **Cancelled** → "Your booking has been cancelled" template with reason
- **Completed** → no email (receipt is out of MVP scope)

---

### Phase 6: React — admin bookings list page `[PENDING]`

Create `web/src/pages/admin/bookings/` with:

- `AdminBookingsPage` — full-width page inside the admin layout
- `BookingFilters` — location picker, status multi-select, date range (React Hook Form + Zod); state persisted in URL query params
- `BookingTable` — sortable columns: consumer, service, slot time, status badge, actions
- `BookingStatusBadge` — colour-coded pill: pending (yellow), confirmed (blue), completed (green), cancelled (grey)
- TanStack Query with `refetchInterval: 30_000` for soft real-time updates
- Pagination controls

---

### Phase 7: React — booking detail drawer `[PENDING]`

Slide-in drawer opened by clicking a table row:

- Consumer name, email, phone
- Service name and location
- Slot date/time
- Notes from consumer
- Status history timeline (chronological list of transitions with actor and reason)
- Action buttons based on current status and user role:
  - Admin: Confirm / Cancel (from pending), Complete / Cancel (from confirmed)
  - Super-admin: same + can override any transition
- Confirmation modal before destructive actions (cancel, complete)
- Optimistic UI update on status change with rollback on error

---

### Phase 8: Tests `[PENDING]`

- Go: unit tests for transition matrix validation; integration tests for list filtering (by role, by status, by date), and status transition with history insert
- React: Vitest + RTL + MSW for `AdminBookingsPage` (list, filters, pagination), `BookingDetailDrawer` (status actions, optimistic update, rollback), role-based button visibility
- jest-axe accessibility checks on all new components

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
