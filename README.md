# Bookit

Multi-vertical booking platform for beauty, sport, and pet care services.

## Overview

Bookit enables service providers to manage their businesses, locations, services, and bookings, while customers can discover providers and book appointments.

**Target Market:** Lithuania (EU)
**MVP Target:** June 30, 2026

## Deployment Status

| Environment | Frontend | API |
|-------------|----------|-----|
| **Production** | https://pt-duo-bookit.web.app | https://bookit-api-prod-898535472060.europe-west3.run.app |
| **Staging** | https://bookit-staging.web.app | https://bookit-api-staging-898535472060.europe-west3.run.app |

| Resource | Status |
|----------|--------|
| **Database** | ✅ Cloud SQL PostgreSQL 15 (`bookit_prod`, `bookit_staging`) |
| **CI/CD** | ✅ GitHub Actions → Cloud Run + Firebase |
| **Region** | `europe-west3` (Frankfurt, EU) |

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Go 1.24 + Gin |
| **Frontend** | React + TypeScript + Vite |
| **Mobile** | React Native + Expo |
| **Database** | Cloud SQL (PostgreSQL 15) |
| **Infrastructure** | GCP (Cloud Run, Cloud Storage, Secret Manager, Pub/Sub) |
| **CI/CD** | GitHub Actions |
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

- Go 1.24+
- Node.js 20+
- Docker and Docker Compose

### Quick Start (Docker)

```bash
# Clone repository
git clone https://github.com/BohdanRohalskyi/bookit.git
cd bookit

# Start PostgreSQL + API (with auto-migrations)
docker-compose up
```

API available at `http://localhost:8080/api/v1/health`

### Manual Backend Setup

```bash
cd api

# Install dependencies
go mod download

# Install dev tools
make tools

# Set up environment
cp .env.example .env

# Start PostgreSQL
docker-compose up db

# Run the server
make run
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

## CI/CD Pipeline

### Git Flow

| Event | API Deploys To | Web Deploys To |
|-------|----------------|----------------|
| PR to `main` | Staging | Staging |
| Merge to `main` | Production | Production |

**Workflow:**
1. Create feature branch from `main`
2. Open PR to `main` → auto-deploys to staging
3. Test on staging URLs
4. Merge PR → auto-deploys to production

### Pipeline Steps

```
Lint → Test → Build → Deploy → Migrate → Verify Health
```

- Runs linter and tests
- Builds Docker image
- Pushes to Artifact Registry
- Deploys to Cloud Run / Firebase Hosting
- Runs database migrations
- Verifies health check

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
