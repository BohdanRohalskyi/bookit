# Bookit

Multi-vertical booking platform for beauty, sport, and pet care services in Lithuania.

Providers manage their businesses and accept bookings through the **Bookit Business** app. Clients discover local providers and book appointments through the **Bookit** consumer app.

**MVP deadline:** June 30, 2026 · **Region:** EU (Lithuania)

## Live Environments

| | Consumer web | Business web | API |
|-|-------------|-------------|-----|
| **Production** | [pt-duo-bookit.web.app](https://pt-duo-bookit.web.app) | [pt-duo-bookit-biz.web.app](https://pt-duo-bookit-biz.web.app) | [bookit-api-prod](https://bookit-api-prod-898535472060.europe-west3.run.app) |
| **Staging** | [bookit-staging.web.app](https://bookit-staging.web.app) | [bookit-biz-staging.web.app](https://bookit-biz-staging.web.app) | [bookit-api-staging](https://bookit-api-staging-898535472060.europe-west3.run.app) |

---

## Project Structure

```
bookit/
├── api/                          # Go backend (Gin)
│   ├── cmd/server/               # Entry point
│   ├── internal/
│   │   ├── api/                  # Generated types & handler registration (oapi-codegen)
│   │   ├── auth/                 # Auth handlers, service, JWT management
│   │   ├── domain/
│   │   │   └── identity/         # User & identity domain models
│   │   ├── mail/                 # Email service (Mailpit locally, SMTP in prod)
│   │   └── platform/
│   │       ├── config/           # Environment config
│   │       ├── database/         # DB pool (pgx)
│   │       ├── logger/           # Structured logging
│   │       ├── migrate/          # golang-migrate runner
│   │       └── flags/            # CLI flag parsing
│   ├── migrations/               # SQL migration files (*.up.sql / *.down.sql)
│   ├── openapi/spec.yaml         # API contract — source of truth
│   ├── oapi-codegen.yaml         # Code generation config
│   ├── Dockerfile
│   └── .claude/
│       └── skills/code-go/       # /code-go skill (Go conventions)
│
├── web/                          # React frontend (npm workspaces)
│   ├── packages/
│   │   ├── consumer/             # Client booking app  (port 5173)
│   │   │   └── src/
│   │   │       ├── pages/        # Route-level page components
│   │   │       ├── components/   # App-specific components (auth guards, etc.)
│   │   │       ├── hooks/        # App-specific hooks
│   │   │       ├── mocks/        # MSW handlers & fixtures
│   │   │       └── test/         # Vitest setup & utilities
│   │   ├── biz/                  # Provider mgmt app   (port 5174)
│   │   │   └── src/              # Same structure as consumer
│   │   └── shared/               # Shared library (components, API client, stores)
│   │       └── src/
│   │           ├── api/          # openapi-fetch typed API client
│   │           ├── components/   # Reusable UI components (shadcn/ui base)
│   │           ├── features/     # Feature flags (Firebase Remote Config)
│   │           ├── hooks/        # Shared hooks (auth, feature flags)
│   │           ├── lib/          # Utilities
│   │           ├── mocks/        # Shared MSW handlers
│   │           └── stores/       # Zustand stores
│   ├── vite.config.shared.ts     # Shared Vite config (extended per package)
│   ├── Dockerfile.dev
│   └── .claude/
│       └── skills/code-react/    # /code-react skill (React conventions)
│
├── docs/
│   ├── BRD-Bookit-20260327.md        # Business requirements
│   ├── PRD-Bookit-20260327.md        # Product requirements
│   ├── NFR-Bookit-20260327.md        # Non-functional requirements
│   ├── HLD-Bookit-20260330.md        # Architecture & system design
│   ├── BACKEND-SPEC-Bookit-20260331.md
│   ├── FRONTEND-SPEC-Bookit-20260331.md
│   └── implementation-plans/         # Feature plans (new → ready-for-dev → in-progress → done)
│
├── scripts/                      # Setup & utility scripts
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                # Go: test & lint
│   │   └── web.yml               # React: typecheck, lint & test
│   └── CODEOWNERS
├── .claude/
│   └── skills/
│       ├── plan/                 # /plan — create a structured implementation plan
│       ├── new-branch/           # /new-branch — create a feature branch from main
│       └── open-plan/            # /open-plan — open an existing plan by description
├── Makefile
├── docker-compose.yml
├── CLAUDE.md                     # AI assistant instructions
└── CONTRIBUTING.md
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Go 1.22+ · Gin · pgx · golang-migrate |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS v4 |
| UI | shadcn/ui · Sora + Geist fonts |
| State | TanStack Query v5 · Zustand |
| HTTP client | openapi-fetch (never axios) |
| Auth | JWT in httpOnly cookies (access 30m / refresh 30d) |
| Database | Cloud SQL PostgreSQL 15 |
| Infrastructure | GCP — Cloud Run · Firebase Hosting · Secret Manager |
| CI/CD | GitHub Actions |

---

## Installation (Docker)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Git

### Run locally

```bash
git clone https://github.com/BohdanRohalskyi/bookit.git
cd bookit

# Start everything: PostgreSQL + API + Consumer web + Biz web + Mailpit
docker compose up
```

No `.env` files needed for Docker — all environment variables are declared in `docker-compose.yml`.
Database migrations run automatically on API startup.

Verify the setup:

```bash
curl http://localhost:8080/api/v1/health
# → {"status":"ok"}
```

| Service | URL |
|---------|-----|
| Consumer app | http://localhost:5173 |
| Business app | http://localhost:5174 |
| API health | http://localhost:8080/api/v1/health |
| Mailpit (email UI) | http://localhost:8025 |

### Running without Docker

> **Not actively supported.** Docker is the recommended and tested setup. The steps below may work but are not maintained.

```bash
docker compose up db mailpit        # still need DB and Mailpit
cp api/.env.example api/.env        # configure API env
cd api && go run cmd/server/main.go # run API
cd web && npm install && npm run dev     # run consumer app only (biz not supported outside Docker)
```

Staging and production secrets are stored in GCP Secret Manager and mounted automatically by Cloud Run.

---

## Contributing

> Full guide: [CONTRIBUTING.md](./CONTRIBUTING.md)

### Setup

After cloning, activate the pre-push git hook:

```bash
make setup
```

This runs `go build`, `go vet`, `golangci-lint`, `npm run typecheck`, and `npm run lint` automatically before every push — catching CI failures locally before they happen.

### Git Flow

```
main (production)
 └── your-feature-branch
       └── PR → main (auto-deploys to staging for review)
                 └── Merge → auto-deploys to production
```

1. **Branch** — create a feature branch from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feat/your-feature-name
   ```

2. **Develop** — implement your changes following the conventions in `api/CLAUDE.md` (backend) or `web/CLAUDE.md` (frontend).

3. **Open a PR to `main`** — this automatically deploys to staging:
   - Consumer web → https://bookit-staging.web.app
   - API → `bookit-api-staging`

4. **Test on staging** — verify your changes work end-to-end.

5. **Merge** — merging the PR automatically deploys to production.

> Never commit directly to `main`.

### Feature Flags

Every new user-facing feature **must** ship behind a feature flag.

We use **Firebase Remote Config** for flags. To add a new flag:

1. **Define the flag** in `web/packages/shared/src/features/flags.ts`:
   ```ts
   export const FLAGS = {
     FEATURE_TEST: 'feature_test', // existing
     MY_FEATURE:   'my_feature',   // ← add yours: UPPER_SNAKE_CASE key, snake_case string value
   } as const
   ```

2. **Use the flag** in any component:
   ```tsx
   import { useFeatureFlag } from '@bookit/shared'
   import { FLAGS } from '@bookit/shared/features'

   function MyComponent() {
     const isEnabled = useFeatureFlag(FLAGS.MY_FEATURE) // always use the constant, never a raw string
     if (!isEnabled) return null
     return <NewFeature />
   }
   ```

3. **Note the flag key in your PR description** — the project owner activates it in Firebase Remote Config for staging/production. You don't need Firebase access.

**Local dev:** all flags are `true` — no setup needed. **Staging:** all flags are `true`. **Production:** only flags explicitly enabled in Firebase are on.

This lets you merge and deploy incomplete features safely, and roll back instantly without a redeploy by toggling the flag in Firebase.

### Code Conventions

| Area | Guide |
|------|-------|
| Go backend | See [`api/CLAUDE.md`](./api/CLAUDE.md) |
| React frontend | See [`web/CLAUDE.md`](./web/CLAUDE.md) |
| Feature planning | See [`docs/implementation-plans/TEMPLATE.md`](./docs/implementation-plans/TEMPLATE.md) |

### Claude Code Slash Commands

If you use [Claude Code](https://claude.ai/code), these project-level commands are available:

| Command | Purpose |
|---------|---------|
| `/plan` | Create a structured implementation plan for a new feature |
| `/new-branch` | Create a feature branch from an up-to-date `main` |
| `/code-react` | Get React/TypeScript conventions loaded into context |
| `/code-go` | Get Go backend conventions loaded into context |
| `/open-plan` | Open an existing implementation plan by description |

---

## Documentation

| Document | Description |
|----------|-------------|
| [BRD](./docs/BRD-Bookit-20260327.md) | Business requirements & success metrics |
| [HLD](./docs/HLD-Bookit-20260330.md) | Architecture decisions & system design |
| [Backend Spec](./docs/BACKEND-SPEC-Bookit-20260331.md) | Go implementation details per endpoint |
| [Frontend Spec](./docs/FRONTEND-SPEC-Bookit-20260331.md) | React component trees & state management |
| [API Spec](./api/openapi/spec.yaml) | OpenAPI 3.0.3 — 29 endpoints, 50+ schemas |
| [NFR](./docs/NFR-Bookit-20260327.md) | Performance, availability & security targets |

---

## License

Proprietary — all rights reserved.
