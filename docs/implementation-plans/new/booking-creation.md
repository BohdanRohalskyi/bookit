---
title: "Booking Creation"
status: NEW
created: 2026-04-21
author: "bohdan@rohalskyi.com"
---

# Plan: Booking Creation

## Summary

Implements the end-to-end booking flow for consumers: select a time slot, confirm details, and create a booking. Covers the Go API (slot availability + booking record), the React multi-step wizard, and email confirmation via SendGrid.

**Goal:** Allow authenticated consumers to book a service slot and receive a confirmation email.

---

## Phases

### Phase 1: Feature flag — `BOOKING_CREATION` `[PENDING]`

Add `FLAGS.BOOKING_CREATION` to `web/packages/shared/src/features/flags.ts`.
Gate the booking wizard route and the "Book now" CTA (on the service detail page) with `useFeatureFlag(FLAGS.BOOKING_CREATION)`.
Flag is activated in Firebase Remote Config by the project owner.

---

### Phase 2: OpenAPI spec — availability and booking endpoints `[PENDING]`

Add to `api/openapi/spec.yaml`:

- `GET /services/{id}/slots` — list available time slots for a date range
  - Query params: `date_from`, `date_to`
  - Response: array of `TimeSlot` (id, starts_at, ends_at, available)
- `POST /bookings` — create a booking
  - Body: `{ service_id, slot_id, notes? }`
  - Response: `Booking` object (id, status, service, slot, consumer, created_at)
  - Auth: requires valid JWT (consumer role)
- `GET /bookings/{id}` — fetch a single booking (consumer sees own; admin sees all)

Run `oapi-codegen` and `openapi-typescript` after spec update.

---

### Phase 3: Database — bookings schema `[PENDING]`

Write migration `api/db/migrations/NNNN_create_bookings.sql`:

```sql
CREATE TABLE bookings (
  id          BIGSERIAL PRIMARY KEY,
  uuid        UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  service_id  BIGINT NOT NULL REFERENCES services(id),
  slot_id     BIGINT NOT NULL REFERENCES service_slots(id),
  consumer_id BIGINT NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','confirmed','cancelled','completed')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ON bookings(slot_id) WHERE status NOT IN ('cancelled');
```

Also add `service_slots` table if not yet present (BIGSERIAL PK + UUID unique column, service_id FK, starts_at, ends_at, capacity).

> PK convention: every table uses `BIGSERIAL` as the integer PK plus a `UUID` unique column exposed externally. Never use UUID as a primary key.

---

### Phase 4: Go — availability handler `[PENDING]`

Implement `GET /services/{id}/slots` in the Scheduling domain (`api/internal/scheduling/`).

- Query slots for the service within the requested date range
- Subtract already-booked (non-cancelled) slots from capacity
- Return available slots only (or all with an `available` bool field)
- Cache results for 30 s with in-memory cache (invalidate on booking write)

---

### Phase 5: Go — booking creation handler `[PENDING]`

Implement `POST /bookings` in the Booking domain (`api/internal/booking/`).

- Validate JWT; extract `consumer_id`
- Lock the slot row (`SELECT ... FOR UPDATE`) to prevent double-booking
- Insert booking record with status `pending`
- Publish `booking.created` internal event for the Notification domain
- Return 201 with the new booking object
- Return 409 if slot already taken; RFC 7807 error body

---

### Phase 6: Go — email confirmation `[PENDING]`

In the Notification domain, subscribe to `booking.created` and send a transactional email via SendGrid:
- Template: booking confirmation with service name, date/time, business address, cancellation link
- Recipient: consumer's email from the Identity domain
- Use the SendGrid setup from the existing `sendgrid-email-setup` plan

---

### Phase 7: React — booking wizard `[PENDING]`

Create `web/src/pages/booking/` with a multi-step wizard:

1. **Step 1 — Date & slot picker**: calendar date selector, fetches `GET /services/{id}/slots`, renders available slots as buttons
2. **Step 2 — Confirm details**: read-only summary (service, slot, price), optional notes input
3. **Step 3 — Success**: confirmation screen with booking ID, "View my bookings" link

State: local React state (no TanStack Query mutation cache persistence needed across steps).
Auth guard: redirect unauthenticated users to `/login?redirect=/book/{serviceId}`.

---

### Phase 8: Tests `[PENDING]`

- Go: unit tests for slot availability logic (capacity math, lock behaviour via mock); integration test for `POST /bookings` happy path and 409 conflict
- React: Vitest + RTL + MSW for each wizard step, auth redirect, and success screen
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
