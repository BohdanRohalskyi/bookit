# HLD — Bookit

> **High-Level Design Document**
>
> Derived from: BRD-Bookit-20260327.md, PRD-Bookit-20260327.md, NFR-Bookit-20260327.md

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Document version | v1.0 |
| Created date | 2026-03-30 |
| Status | Draft |
| BRD Reference | BRD-Bookit-20260327.md |
| PRD Reference | PRD-Bookit-20260327.md |
| NFR Reference | NFR-Bookit-20260327.md |
| MVP Target | June 30, 2026 |

---

## 1. Executive Summary

Bookit is a multi-vertical booking platform targeting beauty, sport, and pet care services in Lithuania (EU). This document defines the high-level architecture for the MVP.

**Key architectural decisions:**
- Modular monolith (Go API) serving multiple frontend clients
- Monorepo structure with shared tooling
- API-first design for future AI agent integration
- GCP-native infrastructure (Cloud Run, Cloud SQL/Neon)
- Single production environment for MVP

---

## 2. Context & Constraints

### 2.1 Team Context

| Attribute | Value |
|-----------|-------|
| Team size | Solo developer with AI tools |
| Timeline | ~3 months to MVP |
| Architecture ceiling | Monolith or modular monolith |

### 2.2 Key Constraints (from NFR)

| Constraint | Target | Implication |
|------------|--------|-------------|
| Uptime SLA | 99.95% | Multi-AZ, automated recovery |
| API response | < 100ms (p95) | Caching, optimized queries |
| Compliance | GDPR (Lithuania/EU) | Data residency, encryption, audit |
| Deployment | Continuous | Zero-downtime deploys |

### 2.3 Technology Constraints

| Constraint | Choice |
|------------|--------|
| Cloud provider | GCP |
| Backend language | Go |
| Frontend framework | React + TypeScript |
| Mobile framework | React Native + Expo |
| Database | PostgreSQL |

---

## 3. Architecture Overview

### 3.1 Architecture Style

**Modular Monolith** — single deployable Go API with clear domain boundaries.

**Rationale:**
- Solo developer — microservices would create unsustainable operational overhead
- 3-month timeline — faster to build and debug
- Clear domain boundaries allow future extraction if needed

### 3.2 System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│   │ Web Client   │  │ Web Admin    │  │ Mobile (iOS/Android)         │  │
│   │ (React)      │  │ (React)      │  │ (React Native + Expo)        │  │
│   └──────┬───────┘  └──────┬───────┘  └──────────────┬───────────────┘  │
│          │                 │                         │                   │
└──────────┼─────────────────┼─────────────────────────┼───────────────────┘
           │                 │                         │
           └─────────────────┼─────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLOUD RUN                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      Go API (Gin)                                │   │
│   │                                                                  │   │
│   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │   │
│   │  │ Identity │ │ Catalog  │ │Scheduling│ │ Booking  │           │   │
│   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │   │
│   │  ┌──────────┐ ┌──────────┐                                      │   │
│   │  │ Payment  │ │Notification│                                    │   │
│   │  └──────────┘ └──────────┘                                      │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└───────────┬─────────────────┬─────────────────┬─────────────────────────┘
            │                 │                 │
            ▼                 ▼                 ▼
┌───────────────────┐ ┌───────────────┐ ┌───────────────────────────────┐
│ PostgreSQL        │ │ Cloud Storage │ │ External Services             │
│ (Cloud SQL/Neon)  │ │ (media files) │ │ - SendGrid (email)            │
│                   │ │               │ │ - Paysera (payments)          │
│                   │ │               │ │ - Google/Facebook/Paysera OAuth│
└───────────────────┘ └───────────────┘ └───────────────────────────────┘
```

### 3.3 Monorepo Structure

```
bookit/
├── api/                      # Go backend
│   ├── cmd/
│   │   └── server/           # Main entrypoint
│   ├── internal/
│   │   ├── domain/           # Domain modules
│   │   │   ├── identity/     # Users, auth, sessions
│   │   │   ├── catalog/      # Businesses, locations, services, staff, equipment
│   │   │   ├── scheduling/   # Availability, blocked times
│   │   │   ├── booking/      # Bookings, booking items
│   │   │   ├── payment/      # Payment abstraction
│   │   │   └── notification/ # Email notifications
│   │   ├── api/              # HTTP handlers (generated from OpenAPI)
│   │   ├── events/           # Internal event bus
│   │   └── platform/         # Shared infra (db, cache, config)
│   ├── migrations/           # golang-migrate SQL files
│   ├── queries/              # sqlc query files
│   ├── db/                   # Generated sqlc code
│   └── openapi/              # OpenAPI spec (source of truth)
│
├── web/
│   ├── client/               # Customer booking app (React)
│   └── admin/                # Provider dashboard (React)
│
├── mobile/                   # React Native + Expo
│
├── docs/                     # Documentation
│   └── stack-comparison.md   # DB/events decision doc
│
└── tools/                    # Shared scripts, codegen
```

---

## 4. Domain Architecture

### 4.1 Domain Boundaries

| Domain | Responsibility | Key Entities |
|--------|---------------|--------------|
| **Identity** | Users, authentication, sessions | User, UserAuthMethod, Provider, RefreshToken |
| **Catalog** | Businesses, locations, services | Business, Location, Service, Staff, Equipment |
| **Scheduling** | Availability, working hours | LocationAvailability, StaffAvailability, BlockedTime |
| **Booking** | Reservations, lifecycle | Booking, BookingItem, BookingItemStaff, BookingItemEquipment |
| **Payment** | Payment processing (abstracted) | PaymentProvider interface |
| **Notification** | Email confirmations, reminders | (uses SendGrid) |

### 4.2 Domain Communication

**Pattern:** Mixed — interfaces for queries, in-process events for side effects.

```
┌─────────────────────────────────────────────────────────────────┐
│                        QUERY FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Booking Domain ──interface──▶ Catalog Domain                  │
│   (get service details)        (returns service info)           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        EVENT FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Booking Domain                                                 │
│        │                                                         │
│        ├──▶ emits "BookingCreated" event                        │
│        │                                                         │
│        ▼                                                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Event Bus (in-process)                                   │   │
│   └─────────────────────────────────────────────────────────┘   │
│        │                                                         │
│        ├──▶ Notification Domain (sends confirmation email)      │
│        └──▶ Payment Domain (initiates payment flow)             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 External Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| **SendGrid** | Email notifications | REST API |
| **Paysera Checkout v3** | Payment processing | REST API + webhooks |
| **Google OAuth** | Social login | OAuth 2.0 + OIDC |
| **Facebook OAuth** | Social login | OAuth 2.0 |
| **Paysera OAuth** | Social login | OAuth 2.0 |
| **Cloud Storage** | Media files (logos, photos) | GCP SDK |

---

## 5. API Design

### 5.1 API Style

| Attribute | Choice |
|-----------|--------|
| Style | REST |
| Spec format | OpenAPI 3.x |
| Approach | Spec-first (generate code from spec) |
| Versioning | URL versioning (`/api/v1/...`) |

### 5.2 Code Generation

| Component | Tool |
|-----------|------|
| Go server types/handlers | oapi-codegen |
| TypeScript client | openapi-typescript + openapi-fetch |

**Workflow:**
```
openapi/spec.yaml (source of truth)
        │
        ├──▶ oapi-codegen ──▶ api/internal/api/generated.go
        │
        └──▶ openapi-typescript ──▶ web/client/src/api/types.ts
                                 ──▶ web/admin/src/api/types.ts
```

### 5.3 Authentication

| Attribute | Choice |
|-----------|--------|
| Method | JWT + Refresh tokens |
| Access token expiry | 15-30 minutes |
| Refresh token expiry | 7-30 days |
| Refresh token rotation | Yes (on each use) |
| Storage (web) | httpOnly cookie |
| Storage (mobile) | Secure storage |

**Auth flow:**
```
1. User logs in (OAuth or email/password)
2. Server issues access token + refresh token
3. Client sends access token in Authorization header
4. When access token expires, client uses refresh token to get new pair
5. Refresh token is rotated on each use
```

### 5.4 Error Handling

**Format:** HTTP status code + simple message

```json
{
  "message": "Booking not found"
}
```

```json
{
  "message": "Validation failed",
  "errors": {
    "email": "Invalid email format",
    "phone": "Required"
  }
}
```

### 5.5 API Structure

```
/api/v1
├── /auth
│   ├── POST /register
│   ├── POST /login
│   ├── POST /refresh
│   ├── POST /logout
│   └── GET  /oauth/{provider}/callback
│
├── /users
│   └── GET  /me
│
├── /providers
│   ├── POST /                    # Become a provider
│   └── GET  /me
│
├── /businesses
│   ├── GET  /                    # List my businesses
│   ├── POST /
│   ├── GET  /{id}
│   └── PUT  /{id}
│
├── /locations
│   ├── GET  /                    # List locations for business
│   ├── POST /
│   ├── GET  /{id}
│   └── PUT  /{id}
│
├── /services
│   ├── GET  /                    # List services for location
│   ├── POST /
│   ├── GET  /{id}
│   └── PUT  /{id}
│
├── /staff
│   ├── GET  /
│   ├── POST /
│   ├── GET  /{id}
│   └── PUT  /{id}
│
├── /equipment
│   ├── GET  /
│   ├── POST /
│   ├── GET  /{id}
│   └── PUT  /{id}
│
├── /availability
│   ├── GET  /slots              # Available time slots
│   ├── GET  /location/{id}
│   └── PUT  /location/{id}
│
├── /bookings
│   ├── GET  /                    # My bookings (customer)
│   ├── POST /
│   ├── GET  /{id}
│   ├── POST /{id}/cancel
│   └── GET  /provider            # Bookings for my business (provider)
│
├── /payments
│   └── POST /webhook             # Paysera callback
│
└── /search
    └── GET  /locations           # Public search
```

---

## 6. Data Architecture

### 6.1 Database Technology

| Attribute | Choice |
|-----------|--------|
| Database | PostgreSQL |
| Hosting | Cloud SQL or Neon (TBD — see docs/stack-comparison.md) |
| Migrations | golang-migrate |
| Query layer | sqlc (generates type-safe Go from SQL) |

### 6.2 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           IDENTITY DOMAIN                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────┐      ┌────────────────────┐      ┌────────────────┐  │
│  │ users         │      │ user_auth_methods  │      │ providers      │  │
│  │───────────────│      │────────────────────│      │────────────────│  │
│  │ id (PK)       │◄────┐│ id (PK)            │      │ id (PK)        │  │
│  │ email         │     ││ user_id (FK)───────┼─────▶│ user_id (FK)───┼──┤
│  │ password_hash │     │└────────────────────┘      │ status         │  │
│  │ name          │     │                            └────────────────┘  │
│  │ phone         │     │  ┌────────────────────┐                        │
│  │ email_verified│     │  │ refresh_tokens     │                        │
│  └───────────────┘     │  │────────────────────│                        │
│                        └──│ user_id (FK)       │                        │
│                           └────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           CATALOG DOMAIN                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────┐      ┌────────────────┐      ┌────────────────┐     │
│  │ businesses     │      │ locations      │      │ services       │     │
│  │────────────────│      │────────────────│      │────────────────│     │
│  │ id (PK)        │◄────┐│ id (PK)        │◄────┐│ id (PK)        │     │
│  │ provider_id(FK)│     ││ business_id(FK)│     ││ location_id(FK)│     │
│  │ name           │     │└────────────────┘     │└────────────────┘     │
│  │ category       │     │                       │                       │
│  └────────────────┘     │  ┌────────────────┐   │  ┌────────────────┐   │
│                         │  │ staff          │   │  │ equipment      │   │
│                         │  │────────────────│   │  │────────────────│   │
│                         └──│ location_id(FK)│   └──│ location_id(FK)│   │
│                            └────────────────┘      └────────────────┘   │
│                                                                          │
│  ┌──────────────────┐      ┌─────────────────────┐                      │
│  │ service_staff    │      │ service_equipment   │                      │
│  │──────────────────│      │─────────────────────│                      │
│  │ service_id (FK)  │      │ service_id (FK)     │                      │
│  │ staff_id (FK)    │      │ equipment_id (FK)   │                      │
│  └──────────────────┘      └─────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          SCHEDULING DOMAIN                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────┐  ┌────────────────────┐  ┌────────────────┐  │
│  │ location_availability │  │ staff_availability │  │ blocked_times  │  │
│  │───────────────────────│  │────────────────────│  │────────────────│  │
│  │ location_id (FK)      │  │ staff_id (FK)      │  │ location_id(FK)│  │
│  │ day_of_week           │  │ day_of_week        │  │ staff_id (FK)  │  │
│  │ start_time            │  │ start_time         │  │ equipment_id   │  │
│  │ end_time              │  │ end_time           │  │ start_datetime │  │
│  └───────────────────────┘  └────────────────────┘  │ end_datetime   │  │
│                                                      └────────────────┘  │
│  ┌────────────────────────┐                                              │
│  │ equipment_availability │                                              │
│  │────────────────────────│                                              │
│  │ equipment_id (FK)      │                                              │
│  │ day_of_week            │                                              │
│  │ start_time             │                                              │
│  │ end_time               │                                              │
│  └────────────────────────┘                                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           BOOKING DOMAIN                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────┐      ┌────────────────────┐                         │
│  │ bookings       │      │ booking_items      │                         │
│  │────────────────│      │────────────────────│                         │
│  │ id (PK)        │◄────┐│ id (PK)            │                         │
│  │ location_id(FK)│     ││ booking_id (FK)────┼──┘                      │
│  │ user_id (FK)   │     ││ service_id (FK)    │                         │
│  │ status         │     ││ start_datetime     │                         │
│  │ total_amount   │     ││ end_datetime       │                         │
│  │ currency       │     ││ price              │                         │
│  └────────────────┘     │└────────────────────┘                         │
│                         │                                                │
│                         │  ┌───────────────────────┐                    │
│                         │  │ booking_item_staff    │                    │
│                         │  │───────────────────────│                    │
│                         └──│ booking_item_id (FK)  │                    │
│                            │ staff_id (FK)         │                    │
│                            └───────────────────────┘                    │
│                                                                          │
│                            ┌───────────────────────┐                    │
│                            │ booking_item_equipment│                    │
│                            │───────────────────────│                    │
│                            │ booking_item_id (FK)  │                    │
│                            │ equipment_id (FK)     │                    │
│                            └───────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Entity Details

**Identity Domain:**

| Table | Key Fields |
|-------|------------|
| `users` | id, email, password_hash, name, phone, email_verified |
| `user_auth_methods` | user_id, provider (google/facebook/paysera/email), provider_user_id |
| `providers` | user_id, status (active/inactive/suspended) |
| `refresh_tokens` | user_id, token_hash, expires_at, revoked_at |

**Catalog Domain:**

| Table | Key Fields |
|-------|------------|
| `businesses` | provider_id, name, category (beauty/sport/pet_care), logo_url |
| `locations` | business_id, name, address, city, country, lat, lng, timezone |
| `services` | location_id, name, duration_type (fixed/flexible), price, price_type |
| `staff` | location_id, name, role, photo_url |
| `equipment` | location_id, name, capacity |
| `service_staff` | service_id, staff_id (who CAN perform) |
| `service_equipment` | service_id, equipment_id (what service REQUIRES) |

**Scheduling Domain:**

| Table | Key Fields |
|-------|------------|
| `location_availability` | location_id, day_of_week, start_time, end_time |
| `staff_availability` | staff_id, day_of_week, start_time, end_time |
| `equipment_availability` | equipment_id, day_of_week, start_time, end_time |
| `blocked_times` | location_id, staff_id, equipment_id, start_datetime, end_datetime |

**Booking Domain:**

| Table | Key Fields |
|-------|------------|
| `bookings` | location_id, user_id, status, total_amount, currency |
| `booking_items` | booking_id, service_id, start_datetime, end_datetime, price |
| `booking_item_staff` | booking_item_id, staff_id (who IS ASSIGNED) |
| `booking_item_equipment` | booking_item_id, equipment_id (what IS USED) |

### 6.4 Caching Strategy

| Phase | Approach |
|-------|----------|
| **MVP** | In-memory cache (ristretto) for catalog data |
| **Scale** | Redis (Cloud Memorystore) for sessions, rate limiting, shared cache |

**Cacheable data:**
- Business/location listings (5-15 min TTL)
- Service catalog (10-30 min TTL)
- User profile (until update)

**Never cache:**
- Real-time availability during booking
- Payment status
- Active booking details

---

## 7. Infrastructure Architecture

### 7.1 Deployment Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GCP Project: bookit-prod                              │
│                    Region: europe-west3 (Frankfurt)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     Cloud Run                                    │   │
│   │─────────────────────────────────────────────────────────────────│   │
│   │  bookit-api                                                      │   │
│   │  - Go container                                                  │   │
│   │  - Auto-scaling (0 to N instances)                              │   │
│   │  - HTTPS automatic                                               │   │
│   └───────────────────────────────┬─────────────────────────────────┘   │
│                                   │                                      │
│            ┌──────────────────────┼──────────────────────┐              │
│            │                      │                      │              │
│            ▼                      ▼                      ▼              │
│   ┌─────────────────┐    ┌───────────────┐    ┌─────────────────────┐  │
│   │ Cloud SQL /     │    │ Cloud Storage │    │ Secret Manager      │  │
│   │ Neon (external) │    │───────────────│    │─────────────────────│  │
│   │─────────────────│    │ bookit-media  │    │ db-credentials      │  │
│   │ PostgreSQL      │    │ (logos, photos│    │ jwt-secret          │  │
│   │                 │    │               │    │ sendgrid-api-key    │  │
│   └─────────────────┘    └───────────────┘    │ paysera-credentials │  │
│                                               │ oauth-secrets       │  │
│                                               └─────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      Static Hosting (CDN)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────┐    ┌─────────────────┐                            │
│   │ Cloud Storage   │    │ Cloud Storage   │                            │
│   │ + Cloud CDN     │    │ + Cloud CDN     │                            │
│   │─────────────────│    │─────────────────│                            │
│   │ bookit-web-     │    │ bookit-web-     │                            │
│   │ client          │    │ admin           │                            │
│   │ (React SPA)     │    │ (React SPA)     │                            │
│   └─────────────────┘    └─────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Environment Strategy

| Environment | Infrastructure |
|-------------|----------------|
| **Local** | Docker Compose (PostgreSQL, API) |
| **Production** | GCP (single project) |

**Future:** Add staging environment/project when needed.

### 7.3 CI/CD Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CI/CD Pipeline                                   │
│                    (GitHub Actions / Cloud Build)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────┐    ┌──────┐    ┌──────┐    ┌─────────────┐    ┌───────┐      │
│   │Lint │───▶│ SAST │───▶│ Unit │───▶│ Integration │───▶│ Build │      │
│   └─────┘    └──────┘    │ Test │    │    Test     │    └───┬───┘      │
│                          └──────┘    └─────────────┘        │           │
│                                                              ▼           │
│                                               ┌─────────────────────┐   │
│                                               │ Container Image     │   │
│                                               │ (Cloud Build)       │   │
│                                               └──────────┬──────────┘   │
│                                                          │              │
│                                                          ▼              │
│                                               ┌─────────────────────┐   │
│                                               │ Deploy to Cloud Run │   │
│                                               │ (Production)        │   │
│                                               └─────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Pipeline stages:**

| Stage | Tools | Purpose |
|-------|-------|---------|
| Lint | golangci-lint, eslint | Code style |
| SAST | gosec, govulncheck | Security scanning |
| Unit tests | go test | Logic verification |
| Integration tests | go test + testcontainers | DB/service tests |
| Build | go build, npm build | Compile artifacts |
| Container | Docker, Cloud Build | Build image |
| Deploy | Cloud Run | Production deployment |

### 7.4 Secrets Management

| Secret Type | Storage |
|-------------|---------|
| DB credentials | Secret Manager |
| JWT signing key | Secret Manager |
| SendGrid API key | Secret Manager |
| Paysera credentials | Secret Manager |
| OAuth client secrets | Secret Manager |
| Non-sensitive config | Environment variables |

### 7.5 Networking

| Component | MVP | Future |
|-----------|-----|--------|
| HTTPS | Cloud Run (automatic) | Same |
| Load Balancing | Cloud Run (built-in) | Cloud Load Balancing |
| WAF/DDoS | Cloud Run (basic) | Cloud Armor |
| Private networking | Not needed | VPC + private IPs |

---

## 8. Event Processing (TBD)

**Decision pending** — see `docs/stack-comparison.md`

### Options Under Consideration

| Option | Description |
|--------|-------------|
| **river** | PostgreSQL-based job queue (simplest) |
| **Pub/Sub + Cloud Tasks** | GCP-native messaging (most integrated) |
| **RabbitMQ (CloudAMQP)** | Classic message broker (portable) |

### Events to Handle

| Event | Trigger | Action |
|-------|---------|--------|
| `BookingCreated` | Booking confirmed | Send confirmation email |
| `BookingCreated` | Booking confirmed | Schedule reminder |
| `BookingCancelled` | Customer/provider cancels | Send cancellation email |
| `ReminderDue` | 24h before appointment | Send reminder email |
| `PaymentReceived` | Paysera webhook | Update booking status |

---

## 9. Cross-Cutting Concerns

### 9.1 Error Handling

- HTTP status codes for response status
- Simple JSON message body
- Validation errors include field-level details

### 9.2 Idempotency

**Approach:** Natural idempotency

- Check state before transitions (e.g., booking already confirmed)
- Payment callbacks verify not already processed
- Database constraints prevent duplicates

### 9.3 Audit Trail

**Approach:** Cloud Logging (structured logs, no PII)

```go
log.Info("booking.created",
    "booking_id", booking.ID,
    "user_id", user.ID,
    "location_id", locationID,
)
```

- All events logged with correlation IDs
- 90-day retention (per NFR)
- No sensitive data in logs (no emails, names, phones)

### 9.4 Observability

| Component | Tool |
|-----------|------|
| Metrics | Cloud Monitoring |
| Logging | Cloud Logging |
| Tracing | Cloud Trace |
| Alerting | Cloud Monitoring (email + Slack) |

---

## 10. Security

### 10.1 Authentication

| Method | Implementation |
|--------|----------------|
| Email + Password | bcrypt hashing, email verification |
| Google OAuth | OAuth 2.0 + OIDC |
| Facebook OAuth | OAuth 2.0 |
| Paysera OAuth | OAuth 2.0 |

### 10.2 Authorization

| Role | Access |
|------|--------|
| Anonymous | Public search, view businesses |
| Customer | Book services, manage own bookings |
| Provider | Manage own businesses, locations, services, bookings |

### 10.3 Data Protection

| Requirement | Implementation |
|-------------|----------------|
| Encryption in transit | TLS 1.3 (Cloud Run automatic) |
| Encryption at rest | Cloud SQL/Neon default encryption |
| Password storage | bcrypt or argon2 |
| PII handling | GDPR compliant, right to deletion |

---

## 11. Pending Decisions

| Decision | Options | Owner | Due |
|----------|---------|-------|-----|
| Database hosting | Neon vs Cloud SQL | TBD | Before development |
| Event processing | river vs Pub/Sub vs RabbitMQ | TBD | Before development |

See `docs/stack-comparison.md` for detailed comparison.

---

## 12. Architecture Decision Records

### ADR-001: Modular Monolith

**Decision:** Build as modular monolith, not microservices.

**Context:** Solo developer, 3-month timeline, MVP scope.

**Rationale:** Microservices would create unsustainable operational overhead for a solo developer. Modular monolith provides clear domain boundaries while maintaining simple deployment and debugging.

**Consequences:** Easier to build and deploy. May need to extract services later if scaling requires it.

---

### ADR-002: Spec-First API Design

**Decision:** Use OpenAPI spec as source of truth, generate code.

**Context:** Multiple clients (web, mobile), future AI agent integration.

**Rationale:** Spec-first ensures consistent API contract across all clients. Code generation reduces drift between spec and implementation. AI tools can work from spec.

**Consequences:** Need to maintain OpenAPI spec. Additional codegen step in build.

---

### ADR-003: Junction Tables for Bookings

**Decision:** Use junction tables (booking_item_staff, booking_item_equipment) instead of direct FKs.

**Context:** Services may require multiple staff or equipment.

**Rationale:** Supports future use cases like couples massage (2 therapists) or complex services requiring multiple resources.

**Consequences:** Slightly more complex queries. Use PostgreSQL json_agg for efficient fetching.

---

### ADR-004: Single Production Environment for MVP

**Decision:** One GCP project, production only. No staging environment.

**Context:** Solo developer, MVP phase, limited budget.

**Rationale:** Reduces infrastructure cost and management overhead. Local development sufficient for testing.

**Consequences:** No staging for pre-production testing. Add staging project later when team grows.

---

### ADR-005: JWT + Refresh Tokens for Auth

**Decision:** Use short-lived JWT access tokens with rotating refresh tokens.

**Context:** Multiple clients including mobile apps.

**Rationale:** Mobile apps can't use session cookies reliably. Short-lived access tokens limit exposure. Refresh token rotation provides security.

**Consequences:** More complex auth flow. Need to handle token refresh on all clients.

---

## 13. NFR Traceability

| NFR Requirement | HLD Decision |
|-----------------|--------------|
| 99.95% uptime | Cloud Run (managed, auto-scaling, multi-AZ) |
| < 100ms API response | In-memory caching, sqlc (optimized queries), Cloud SQL same-region |
| Zero RPO for transactions | Cloud SQL HA or Neon (built-in replication) |
| GDPR compliance | EU region (europe-west3), encryption, audit logging |
| Continuous deployment | CI/CD pipeline with automated deploys |
| < 30 min RTO | Cloud Run auto-recovery, infrastructure as code |

---

## Appendix A: Technology Stack Summary

| Layer | Technology |
|-------|------------|
| **Backend** | Go 1.22+, Gin |
| **Frontend (Web)** | React 18+, TypeScript, Vite |
| **Frontend (Mobile)** | React Native, Expo |
| **Database** | PostgreSQL 15+ (Cloud SQL or Neon) |
| **Migrations** | golang-migrate |
| **Query Layer** | sqlc |
| **API Spec** | OpenAPI 3.x |
| **API Codegen** | oapi-codegen (Go), openapi-typescript (TS) |
| **Caching** | ristretto (MVP), Redis (future) |
| **Email** | SendGrid |
| **Payments** | Paysera Checkout v3 |
| **Auth** | JWT, OAuth 2.0 (Google, Facebook, Paysera) |
| **Cloud** | GCP (Cloud Run, Cloud SQL, Cloud Storage, Secret Manager) |
| **CI/CD** | GitHub Actions or Cloud Build |
| **Monitoring** | Cloud Monitoring, Cloud Logging, Cloud Trace |

---

## Appendix B: Local Development Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: bookit
      POSTGRES_PASSWORD: bookit
      POSTGRES_DB: bookit
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: ./api
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://bookit:bookit@db:5432/bookit?sslmode=disable
      JWT_SECRET: local-dev-secret
    depends_on:
      - db

volumes:
  postgres_data:
```

---

*Generated from BRD, PRD, and NFR documents. Pending decisions documented in docs/stack-comparison.md.*
