# Bookit

Multi-vertical booking platform for beauty, sport, and pet care services.

## Overview

Bookit enables service providers to manage their businesses, locations, services, and bookings, while customers can discover providers and book appointments.

**Target Market:** Lithuania (EU)
**MVP Target:** June 30, 2026

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Go + Gin |
| **Frontend** | React + TypeScript + Vite |
| **Mobile** | React Native + Expo |
| **Database** | PostgreSQL (Cloud SQL or Neon) |
| **Infrastructure** | GCP (Cloud Run, Cloud Storage, Secret Manager) |
| **Region** | europe-west3 (Frankfurt) |

## Project Structure

```
bookit/
├── api/
│   └── openapi/
│       └── spec.yaml          # OpenAPI 3.0 specification
├── docs/
│   ├── BRD-Bookit-20260327.md          # Business Requirements
│   ├── PRD-Bookit-20260327.md          # Product Requirements
│   ├── NFR-Bookit-20260327.md          # Non-Functional Requirements
│   ├── HLD-Bookit-20260330.md          # High-Level Design
│   ├── BACKEND-SPEC-Bookit-20260331.md # Backend implementation spec
│   ├── FRONTEND-SPEC-Bookit-20260331.md# Frontend implementation spec
│   ├── stack-comparison.md             # DB & event processing options
│   └── implementation-plans/           # Implementation tracking
│       ├── new/                        # Plans being drafted
│       ├── ready-for-dev/              # Ready to implement
│       ├── in-progress/                # Currently being developed
│       ├── done/                       # Completed
│       ├── canceled/                   # Canceled
│       └── TEMPLATE.md                 # Plan template
├── CLAUDE.md                  # Claude instructions
└── README.md                  # This file
```

## Architecture

**Style:** Modular monolith with clear domain boundaries

**Domains:**
- Identity (users, auth, providers)
- Catalog (businesses, locations, services)
- Scheduling (availability, calendar)
- Bookings (reservations, status lifecycle)
- Notifications (email via SendGrid)
- Payments (Paysera integration)

## API

REST API with OpenAPI 3.0 specification at `api/openapi/spec.yaml`.

**Base URL:** `https://api.bookit.app/api/v1`

**Authentication:** JWT Bearer tokens with refresh token rotation

### Endpoints Overview

| Group | Endpoints |
|-------|-----------|
| Auth | register, login, refresh, logout, OAuth, verify-email |
| Users | get/update profile |
| Providers | become provider, get profile |
| Businesses | CRUD operations |
| Locations | CRUD operations |
| Services | CRUD operations |
| Bookings | create, list, cancel |
| Availability | get time slots |
| Search | public location search |

## Development

### Prerequisites

- Go 1.22+
- Node.js 20+
- PostgreSQL 15+
- Docker (optional)

### Backend Setup

```bash
# Clone repository
git clone https://github.com/your-org/bookit.git
cd bookit

# Install Go dependencies
go mod download

# Set up environment variables
cp .env.example .env

# Run database migrations
go run cmd/migrate/main.go up

# Start the server
go run cmd/api/main.go
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Generate TypeScript types from OpenAPI
npm run generate:types

# Start development server
npm run dev
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/bookit

# Auth
JWT_SECRET=your-secret-key
JWT_ACCESS_TTL=30m
JWT_REFRESH_TTL=7d

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...
PAYSERA_CLIENT_ID=...
PAYSERA_CLIENT_SECRET=...

# Email
SENDGRID_API_KEY=...

# Storage
GCS_BUCKET=bookit-media
```

## Code Generation

### Go Server (oapi-codegen)

```bash
oapi-codegen -generate types -package api api/openapi/spec.yaml > internal/api/types.gen.go
oapi-codegen -generate gin -package api api/openapi/spec.yaml > internal/api/server.gen.go
```

### TypeScript Client (openapi-typescript)

```bash
cd frontend
npm run generate:types
# Outputs: src/api/types.ts
```

## Documentation

| Document | Description |
|----------|-------------|
| [BRD](./docs/BRD-Bookit-20260327.md) | Business requirements, goals, success metrics |
| [PRD](./docs/PRD-Bookit-20260327.md) | Product requirements, user stories, acceptance criteria |
| [NFR](./docs/NFR-Bookit-20260327.md) | Performance, availability, security requirements |
| [HLD](./docs/HLD-Bookit-20260330.md) | Architecture decisions, system design, ADRs |
| [Backend Spec](./docs/BACKEND-SPEC-Bookit-20260331.md) | Go implementation details |
| [Frontend Spec](./docs/FRONTEND-SPEC-Bookit-20260331.md) | Frontend architecture, state management, API client |
| [API Spec](./api/openapi/spec.yaml) | OpenAPI 3.0 specification |
| [Stack Comparison](./docs/stack-comparison.md) | Database and event processing options |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Modular monolith | Solo developer, faster iteration |
| API Style | REST + OpenAPI | Wide tooling support, code generation |
| Auth | JWT + refresh tokens | Stateless, scalable |
| Database | PostgreSQL | ACID compliance, GCP integration |
| HTTP Client | Native fetch | Zero dependencies, no vulnerabilities |
| State Management | Zustand + React Query | Lightweight, server state separation |

## Non-Functional Targets

| Metric | Target |
|--------|--------|
| API Response (p95) | < 100ms |
| Page Load | < 1s |
| Uptime | 99.95% |
| RTO | < 30 minutes |
| RPO (transactions) | Zero data loss |

## License

Proprietary
