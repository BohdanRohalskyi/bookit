---
title: "Booking Creation"
status: IN_PROGRESS
created: 2026-04-21
author: "bohdan@rohalskyi.com"
---

# Plan: Booking Creation

## Summary

End-to-end booking flow for consumers: pick a date, select an available time slot,
confirm details, and create a booking. Covers Go API (availability computation +
booking record with double-booking prevention), React multi-step wizard, and
confirmation email.

**Goal:** Allow authenticated consumers to book a service slot and receive a confirmation email.

---

## Phases

### Phase 1: Feature flag `[REJECTED]`
Core feature — no flag needed.

### Phase 2: OpenAPI spec `[DONE]`
All endpoints and schemas already defined in `api/openapi/spec.yaml`:
- `GET /api/v1/availability/slots?service_id&date` — public, returns `AvailableSlotsResponse`
- `POST /api/v1/bookings` — auth required, body `BookingCreate`, returns `Booking`
- `GET /api/v1/bookings/{id}` — auth required
- `GET /api/v1/bookings` — list consumer's own bookings
- `POST /api/v1/bookings/{id}/cancel`
- Schemas: `Booking`, `BookingItem`, `BookingCreate`, `BookingItemCreate`, `BookingStatus`, `TimeSlot`, `AvailableSlotsResponse`

---

### Phase 3: Database — bookings schema `[PENDING]`

Migration `api/migrations/000008_create_bookings.up.sql`:

```sql
CREATE TABLE bookings (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid        UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  location_id BIGINT      NOT NULL REFERENCES locations(id),
  consumer_id BIGINT      NOT NULL REFERENCES users(id),
  status      TEXT        NOT NULL DEFAULT 'confirmed'
              CHECK (status IN ('pending_payment','confirmed','cancelled_by_customer',
                                'cancelled_by_provider','completed','no_show')),
  total_amount NUMERIC(10,2) NOT NULL,
  currency    CHAR(3)     NOT NULL DEFAULT 'EUR',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE booking_items (
  id               BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid             UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  booking_id       BIGINT      NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id       BIGINT      NOT NULL REFERENCES services(id),
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER     NOT NULL,
  price            NUMERIC(10,2) NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('confirmed','cancelled','completed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent double-booking: same service cannot have two active items at the same start time
CREATE UNIQUE INDEX booking_items_no_overlap
  ON booking_items (service_id, start_at)
  WHERE status NOT IN ('cancelled');

CREATE INDEX idx_bookings_consumer  ON bookings (consumer_id);
CREATE INDEX idx_bookings_location  ON bookings (location_id);
CREATE INDEX idx_booking_items_booking ON booking_items (booking_id);
CREATE INDEX idx_booking_items_service ON booking_items (service_id);
```

---

### Phase 4: Go — availability handler `[PENDING]`

New domain `api/internal/booking/` with `availability_handler.go`.

`GET /api/v1/availability/slots` — public (no auth):
- Resolve `service_id` UUID → int64; fetch service `duration_minutes`
- Fetch location's schedule for the requested date's day-of-week
- If location is closed that day → return empty slots
- Generate slot windows (service duration) within open hours (e.g. 09:00–17:00 with 60-min service → 8 slots)
- Query `booking_items` for existing non-cancelled bookings for that service on that date
- Mark slots `available: false` if already booked
- Return `AvailableSlotsResponse`

---

### Phase 5: Go — booking creation handler `[PENDING]`

`POST /api/v1/bookings` — auth required:
- Extract `consumer_id` from JWT
- Resolve `location_id` UUID → int64; validate each `service_id` is offered at that location
- Open transaction:
  - For each item: `SELECT 1 FROM booking_items WHERE service_id=$1 AND start_at=$2 AND status != 'cancelled' FOR UPDATE`
  - If any row exists → rollback, return 409 RFC 7807
  - Insert `bookings` row
  - Insert `booking_items` rows (compute `end_at = start_at + duration_minutes`)
  - Commit
- Send confirmation email (inline — no event bus for MVP)
- Return 201 with full `Booking` response

`GET /api/v1/bookings/{id}` — auth required:
- Consumer sees own bookings only; 404 if not theirs

`GET /api/v1/bookings` — auth required:
- List consumer's own bookings, optional `status` filter, paginated

---

### Phase 6: Go — confirmation email `[PENDING]`

After successful booking insert, send email via existing mail provider (Resend):
- Template: service name, date/time, location address, booking ID
- Use existing `mail.Provider` interface from `internal/mail/`
- Recipient: consumer's email

---

### Phase 7: React — booking wizard `[PENDING]`

Route: `GET /book/:serviceId` in consumer app.

Three-step wizard:
1. **Date & slot** — date input + `GET /api/v1/availability/slots` → slot buttons
2. **Confirm** — read-only summary (service, slot, price), optional notes textarea
3. **Success** — booking ID, "View my bookings" CTA

Auth guard: redirect to `/login?redirect=/book/:serviceId` if not authenticated.
Wire "Book now" on `/services/:id` detail page to this route.

---

### Phase 8: Tests `[PENDING]`

- Go: unit tests for slot generation logic; handler tests for 200/409/401 on booking creation
- React: Vitest + RTL + MSW for each wizard step, auth redirect, slot selection, success screen

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed — add `> Commit: <hash> (<date>)` |
| `[CHANGED]` | Differs from plan — document what/why |
| `[REJECTED]` | Skipped — document reason |
