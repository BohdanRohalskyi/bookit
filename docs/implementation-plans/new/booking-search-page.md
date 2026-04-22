---
title: "Client Search Page"
status: NEW
created: 2026-04-21
author: "bohdan@rohalskyi.com"
---

# Plan: Client Search Page

## Summary

Implements the consumer-facing service search and discovery experience. Publicly accessible (no login required). Users search for services by keyword, filter by category / city / date, and browse a list of service cards. Clicking a card opens a service detail page with a "Book now" CTA.

**Goal:** Give all visitors a fast, filterable way to discover bookable services across beauty, sport, and pet care.

---

## Business Requirements

### Who can use it
- Everyone — no login required. Authenticated users see the same page.

### What a result card represents
Each card = one **service** offered by a business:
- Service name
- Business name + city
- Category badge (Beauty / Sport / Pet care)
- Duration
- Price
- Rating (placeholder for MVP — no reviews system yet)
- Cover photo

### Filters
| Filter | Behaviour |
|--------|-----------|
| **Category** | Single-select pill: All / Beauty / Sport / Pet care |
| **City** | Free-text or dropdown; filters by location city |
| **Date** | Date picker; only shows services with at least one available slot on that date |

### Layout
- Vertical list of service cards (no map for MVP)
- Filters in a top bar or left sidebar
- URL-driven state — all filters reflected in query params so results are shareable/bookmarkable
- Empty state when no results match
- Skeleton loaders while fetching

### Entry point
`/search` on the consumer app (`packages/consumer`). Linked from the landing page hero CTA.

### Clicking a card
Opens `/services/{id}` — a service detail page with full description, business info, photos, and a "Book now" button (links to the booking wizard, implemented in the Booking Creation plan).

---

## Phases

### Phase 1: OpenAPI spec — search endpoint `[PENDING]`

Add `GET /services/search` to `api/openapi/spec.yaml`.

Query parameters:
- `q` — free-text keyword (optional); matched against service name + description
- `category` — enum: `beauty | sport | pet_care` (optional)
- `city` — city name string (optional)
- `date` — ISO date string `YYYY-MM-DD` (optional); filters to services with available slots on that date
- `page` / `per_page` — pagination (default per_page=20)

Response: paginated list of `ServiceSummary` objects:
```
id, name, category, description, duration_min, price, business_name, city, cover_image_url, rating
```

Run `oapi-codegen` (Go types) and `openapi-typescript` (TS types) after spec update.

---

### Phase 2: Go — search handler `[PENDING]`

Implement `GET /services/search` in the Catalog domain (`api/internal/catalog/`).

- No auth required (public endpoint)
- Full-text search via `ILIKE` on service name + description (MVP); upgrade to `pg_trgm` post-MVP
- Filter by category (exact match on `services.category`)
- Filter by city (ILIKE on `locations.city`)
- Filter by date: only return services where at least one slot exists on that date and is not already booked
- Paginate with `LIMIT / OFFSET`
- Return RFC 7807 errors for invalid params

---

### Phase 3: React — `/search` route and layout `[PENDING]`

In `web/packages/consumer/src/`:

- `SearchPage` — full-width page with filter bar + service card list
- `SearchFilters` — category pill bar + city input + date picker; state synced to URL via `useSearchParams`
- `ServiceCard` — card showing cover photo, service name, business name, city, category badge, duration, price, rating
- `ServiceCardSkeleton` — loading placeholder (3-6 visible skeletons)
- Empty state illustration + copy when no results
- TanStack Query `useQuery` for `GET /services/search`; refetches on filter change
- Link from landing page hero CTA to `/search`

---

### Phase 4: React — service detail page `[PENDING]`

In `web/packages/consumer/src/`:

- `ServiceDetailPage` at `/services/:id`
- Fetches `GET /services/{id}` (existing endpoint)
- Shows: cover photo, service name, description, duration, price, business name + address, category badge
- "Book now" CTA — navigates to booking wizard (Booking Creation plan)
- 404 handling if service not found

---

### Phase 5: Tests `[PENDING]`

- Go: unit tests for search filter combinations (keyword, category, city, date); integration test for pagination
- React: Vitest + RTL + MSW for `SearchPage` (filters change URL params, results render), `ServiceCard`, `ServiceDetailPage` (loads data, shows 404)
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
