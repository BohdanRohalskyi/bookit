# Bookit — Claude Instructions

## Project Overview

Multi-vertical booking platform for beauty, sport, and pet care services.
Target market: Lithuania (EU). MVP deadline: June 30, 2026.

## Deployed Infrastructure

| Resource | Production | Staging |
|----------|------------|---------|
| Consumer web | https://pt-duo-bookit.web.app | https://bookit-staging.web.app |
| API | https://bookit-api-prod-898535472060.europe-west3.run.app | https://bookit-api-staging-898535472060.europe-west3.run.app |
| Database | `bookit_prod` | `bookit_staging` |
| Cloud SQL | ✅ Running (`bookit-db`) | |
| Artifact Registry | ✅ `europe-west3-docker.pkg.dev/pt-duo-bookit/bookit` | |
| Secret Manager | ✅ DB URLs, JWT secrets, VITE_API_URL | |

## Git Flow

| Event | Deploys To |
|-------|-----------|
| PR opened to `main` | Staging (API + web) |
| Merged to `main` | Production (API + web) |

**Workflow:** feature branch → PR to `main` → test on staging → merge → production.

## Branch Discipline

**All code changes must be made on a feature branch, never directly on `main`.**

Before making any file edits, Claude must:
1. Warn the user if they are currently on `main`
2. Suggest creating a new feature branch
3. If the user agrees, invoke the `/new-branch` skill — it will verify `main` is up to date and create the branch
4. Only proceed with changes after a feature branch is confirmed

If the user explicitly instructs to work on `main`, acknowledge the risk but comply.

## Feature Flag Discipline

**Every user-facing change must ship behind a feature flag.**

Before writing any implementation code, Claude must:
1. Identify whether the change is user-facing (new UI, new endpoint, changed behavior visible to users)
2. If yes — name the flag key and confirm it with the user before proceeding
3. Apply the flag according to the rules in the `/plan` skill (flag type, `flags.ts` constant, Firebase Remote Config)

If the user explicitly instructs to skip the feature flag, acknowledge the tradeoff but comply.

## Architecture

- **Style**: Modular monolith with clear domain boundaries
- **Domains**: Identity, Catalog, Scheduling, Booking, Payment, Notification
- **Apps**: `api/` (Go backend) · `web/` (React frontend — consumer + biz apps)
- **Infrastructure**: GCP-native — prefer GCP services over third-party alternatives
- **Secrets**: `.env` locally (gitignored); Secret Manager in staging/prod via Cloud Run `--set-secrets`

## Key Technical Decisions

- **Auth**: JWT in httpOnly cookies — access 30m / refresh 30d / interceptor-based refresh
- **API contract**: OpenAPI 3.0.3 at `api/openapi/spec.yaml` — always the source of truth
- **Errors**: RFC 7807 format throughout the API
- **HTTP client**: openapi-fetch (never axios)
- **Code gen**: oapi-codegen (Go types) · openapi-typescript (TS types)

## Important Files

| File | Purpose |
|------|---------|
| `api/openapi/spec.yaml` | API contract — update before writing handlers |
| `docs/BACKEND-SPEC-Bookit-20260331.md` | Go implementation spec |
| `docs/FRONTEND-SPEC-Bookit-20260331.md` | React implementation spec |
| `docs/BRD-Bookit-20260327.md` | Business requirements |
| `docs/HLD-Bookit-20260330.md` | High-level design |
| `docs/NFR-Bookit-20260327.md` | Non-functional requirements |
| `docker-compose.yml` | Local development environment |

## Implementation Plans

Location: `docs/implementation-plans/`  
Use the `/plan` slash command to create and manage plans.

### Folder structure

```
implementation-plans/
├── new/            # Being drafted
├── ready-for-dev/  # Approved, not started
├── in-progress/    # Active development
├── done/           # Completed
├── canceled/       # Abandoned
└── TEMPLATE.md     # Template
```

### Phase statuses

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Active |
| `[DONE]` | Complete — add `> Commit: <hash> (<date>)` |
| `[CHANGED]` | Differs from plan — document what/why |
| `[REJECTED]` | Skipped — document reason |

### Workflow
1. Create plan from `TEMPLATE.md` → place in `new/`
2. Approved → move to `ready-for-dev/`
3. Development starts → move to `in-progress/`, update phase statuses as work progresses
4. All phases done → move to `done/`

## Skills

| Skill | Use when |
|-------|---------|
| `/plan` | Designing a new feature or task |
| `/new-branch` | Creating a feature branch from an up-to-date `main` |
| `/open-plan` | Opening an existing implementation plan by description |
| `/code-react` | Implementing frontend features (available inside `web/`) |
| `/code-go` | Implementing backend features (available inside `api/`) |

> `api/CLAUDE.md` and `web/CLAUDE.md` load automatically when Claude works in those directories — no manual reference needed.
