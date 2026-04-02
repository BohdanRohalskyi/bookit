# Bookit - Claude Instructions

## Project Overview

Multi-vertical booking platform for beauty, sport, and pet care services.
Target market: Lithuania (EU). MVP deadline: June 30, 2026.

## Project Status

### Deployed Infrastructure (2026-04-02)

| Resource | Production | Staging |
|----------|------------|---------|
| Frontend | https://pt-duo-bookit.web.app | https://bookit-staging.web.app |
| API | https://bookit-api-prod-898535472060.europe-west3.run.app | https://bookit-api-staging-898535472060.europe-west3.run.app |
| Database | `bookit_prod` | `bookit_staging` |

| Resource | Status |
|----------|--------|
| Cloud SQL | ✅ Running (`bookit-db`) |
| Artifact Registry | ✅ Ready (`europe-west3-docker.pkg.dev/pt-duo-bookit/bookit`) |
| Secret Manager | ✅ Configured (DB URLs, JWT secrets, VITE_API_URL) |

### Git Flow

| Event | API Deploys To | Web Deploys To |
|-------|----------------|----------------|
| PR to main | `bookit-api-staging` | `bookit-staging.web.app` |
| Merge to main | `bookit-api-prod` | `pt-duo-bookit.web.app` |

**Workflow:**
1. Create feature branch from `main`
2. Open PR to `main` → auto-deploys to staging
3. Test on staging URLs
4. Merge PR → auto-deploys to production

### Completed Deliverables
- `api/openapi/spec.yaml` — 29 endpoints, 50+ schemas (OpenAPI 3.0.3)
- `docs/BACKEND-SPEC-Bookit-20260331.md` — Go implementation spec
- `docs/FRONTEND-SPEC-Bookit-20260331.md` — React implementation spec
- `api/` — Go backend foundation (Gin, health endpoint, config, database, CORS)
- `web/` — React frontend foundation (Vite, health check, Firebase Hosting)
- `.github/workflows/ci.yml` — API CI/CD pipeline
- `.github/workflows/web.yml` — Frontend CI/CD pipeline
- `docker-compose.yml` — Local development environment

### Next Implementation Phases
1. ~~Set up Go backend project structure~~ ✅ Done (2026-04-01)
2. ~~Set up React frontend foundation~~ ✅ Done (2026-04-02)
3. **Expand frontend setup** ← NEXT
   - shadcn/ui components
   - TanStack Query + Zustand
   - openapi-fetch for API client
   - Generate types from OpenAPI spec
4. Generate backend API types (`cd api && make generate`)
5. Implement auth endpoints (register, login, refresh, OAuth)
6. Build domain by domain following the workflow order in the specs

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Go 1.22+ with Gin |
| Frontend | React 18 + TypeScript + Vite |
| UI Components | shadcn/ui (Tailwind-based) |
| Server State | TanStack Query v5 |
| Client State | Zustand |
| HTTP Client | openapi-fetch (native fetch, NOT axios) |
| Router | React Router v6 |
| API Spec | OpenAPI 3.0.3 |
| Database | Cloud SQL (PostgreSQL 15+) |
| Event Processing | Cloud Pub/Sub |
| Infrastructure | GCP (Cloud Run, Cloud Storage, Secret Manager) |
| CI/CD | GitHub Actions |
| Region | europe-west3 (Frankfurt) |

## Architecture

- **Style**: Modular monolith with clear domain boundaries
- **Domains**: Identity, Catalog, Scheduling, Booking, Payment, Notification
- **Infrastructure**: GCP-native — always prefer GCP services over third-party alternatives
- **CI/CD**: GitHub Actions deploying to GCP
- **Environments**: Single GCP project for MVP; resources use `-staging` / `-prod` suffix
- **Secrets**: Local uses `.env` (gitignored); staging/prod use Secret Manager mounted via Cloud Run `--set-secrets`

## Key Technical Decisions

### Authentication
- JWT with httpOnly cookies (XSS-resistant)
- Access token: 30 minutes
- Refresh token: 30 days
- Token refresh: Interceptor-based (intercepts 401, refreshes, retries)

### API Design
- REST with OpenAPI 3.0.3 specification
- URL versioning (`/api/v1/...`)
- RFC 7807 error format

### Code Generation
- Backend: oapi-codegen generates Go types and Gin handlers
- Frontend: openapi-typescript generates TypeScript types

## Important Files

| File | Purpose |
|------|---------|
| `api/openapi/spec.yaml` | Source of truth for API contract |
| `docs/BACKEND-SPEC-Bookit-20260331.md` | Backend implementation details |
| `docs/FRONTEND-SPEC-Bookit-20260331.md` | Frontend implementation details |
| `docs/BRD-Bookit-20260327.md` | Business requirements |
| `docs/PRD-Bookit-20260327.md` | Product requirements |
| `docs/NFR-Bookit-20260327.md` | Non-functional requirements |
| `docs/HLD-Bookit-20260330.md` | High-level design |
| `docs/implementation-plans/TEMPLATE.md` | Template for new plans |
| `README.md` | Project documentation |

## Implementation Plans

Location: `docs/implementation-plans/`

### Folder Structure (Plan Status)

```
implementation-plans/
├── new/            # Plans being drafted
├── ready-for-dev/  # Ready to implement
├── in-progress/    # Currently being developed
├── done/           # Completed
├── canceled/       # Canceled
└── TEMPLATE.md     # Template for new plans
```

### Phase Statuses (within each plan)

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed — include commit hash |
| `[CHANGED]` | Implementation differs from plan — document what/why |
| `[REJECTED]` | Phase skipped — document reason |

### Workflow

1. Create plan from `TEMPLATE.md`, place in `new/`
2. When plan is complete → move to `ready-for-dev/`
3. When development starts → move to `in-progress/`
4. Update phase statuses as work progresses
5. For completed phases: add `> Commit: <hash> (<date>)`
6. When all phases done → move plan to `done/` (or `canceled/`)

Use plans for non-trivial work that benefits from upfront design or user alignment.

## Working Instructions

### When modifying the API
1. Update `api/openapi/spec.yaml` first
2. Regenerate Go types: `oapi-codegen -generate types -package api api/openapi/spec.yaml > internal/api/types.gen.go`
3. Regenerate frontend types: `cd frontend && npm run generate:types`

### When implementing endpoints
- Follow the business rules in `docs/BACKEND-SPEC-Bookit-20260331.md`
- Each endpoint has: request/response contracts, auth matrix, error responses, query patterns

### When building UI
- Follow component trees in `docs/FRONTEND-SPEC-Bookit-20260331.md`
- Use shadcn/ui components
- Loading, empty, and error states are always explicit

### Security
- Never use axios (use openapi-fetch with native fetch)
- Store tokens in httpOnly cookies only
- Validate at system boundaries (user input, external APIs)

### Code Style
- Go: standard library style, error returns, context propagation
- TypeScript: strict mode, no `any`, explicit types from generated API types
