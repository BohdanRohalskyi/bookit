---
title: "Client Search Page"
status: NEW
created: 2026-04-21
author: "bohdan@rohalskyi.com"
---

# Plan: Client Search Page

## Summary

Implements the consumer-facing service search and discovery experience. Users can search for services by keyword, category (beauty / sport / pet care), and location, browse results on a list/map view, and navigate to a service detail page to initiate booking.

**Goal:** Give unauthenticated and authenticated consumers a fast, filterable way to discover and preview bookable services.

---

## Phases

### Phase 1: Feature flag — `CLIENT_SEARCH_PAGE` `[PENDING]`

Add `FLAGS.CLIENT_SEARCH_PAGE` to `web/packages/shared/src/features/flags.ts`.
Gate the `/search` route and its nav entry with `useFeatureFlag(FLAGS.CLIENT_SEARCH_PAGE)`.
Flag is activated in Firebase Remote Config by the project owner.

---

### Phase 2: OpenAPI spec — search endpoint `[PENDING]`

Add `GET /services/search` to `api/openapi/spec.yaml`.

Query parameters:
- `q` — free-text keyword (optional)
- `category` — enum: `beauty | sport | pet_care` (optional)
- `city` — city name or slug (optional)
- `lat` / `lng` / `radius_km` — geo search (optional, requires all three)
- `page` / `page_size` — pagination

Response: paginated list of `ServiceSummary` objects (id, name, category, business name, city, price_from, rating, cover_image_url).

Run `oapi-codegen` (Go) and `openapi-typescript` (TS) after spec update.

---

### Phase 3: Go — search handler `[PENDING]`

Implement `GET /services/search` in the Catalog domain (`api/internal/catalog/`).

- Full-text search via `ILIKE` on service name + description (MVP); upgrade to pg_trgm later
- Filter by category and city
- Geo filter using PostGIS `ST_DWithin` if lat/lng/radius provided
- Paginate with `LIMIT / OFFSET`
- Return RFC 7807 errors for invalid params

---

### Phase 4: React — `/search` route and layout `[PENDING]`

Create `web/src/pages/search/` with:
- `SearchPage` — top-level page with sidebar filters + result area
- `SearchFilters` — category, city, radius controls (React Hook Form + Zod)
- `ServiceCard` — clickable card showing cover image, name, business, price_from, rating
- `ServiceCardSkeleton` — loading placeholder
- URL-driven state: filters reflected in query params for shareability (React Router `useSearchParams`)
- TanStack Query `useQuery` for `GET /services/search`; auto-refetch on filter change

---

### Phase 5: React — service detail page `[PENDING]`

Create `web/src/pages/service/[id]/` with:
- `ServiceDetailPage` — fetches `GET /services/{id}`, shows full description, images, business info, availability preview, and a "Book now" CTA
- CTA navigates to booking flow (implemented in the Booking Creation plan)
- Handles 404 gracefully

---

### Phase 6: Tests `[PENDING]`

- Go: handler unit tests with mock repository; integration test for search with filters
- React: Vitest + RTL + MSW tests for `SearchPage`, `SearchFilters`, `ServiceCard`, `ServiceDetailPage`
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
