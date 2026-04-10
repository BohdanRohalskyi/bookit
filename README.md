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
├── api/                        # Go backend (Gin)
│   ├── cmd/server/             # Entry point
│   ├── internal/
│   │   ├── api/                # Generated types & handler registration
│   │   ├── config/             # Environment config
│   │   ├── database/           # DB pool & migrations
│   │   ├── middleware/         # Auth, CORS, logging
│   │   └── domain/
│   │       ├── identity/       # Auth, users
│   │       ├── catalog/        # Businesses, services, staff
│   │       ├── scheduling/     # Availability, slots
│   │       ├── booking/        # Appointments
│   │       ├── payment/        # Transactions (Paysera)
│   │       └── notification/   # Email
│   ├── migrations/             # SQL migration files
│   └── openapi/spec.yaml       # API contract (source of truth)
│
├── web/                        # React frontend (npm workspaces)
│   ├── packages/
│   │   ├── consumer/           # Client booking app  (port 5173)
│   │   ├── biz/                # Provider mgmt app   (port 5174)
│   │   └── shared/             # Shared components, API client, stores
│   └── Dockerfile.dev
│
├── docs/
│   ├── BRD-Bookit-20260327.md
│   ├── HLD-Bookit-20260330.md
│   ├── BACKEND-SPEC-Bookit-20260331.md
│   ├── FRONTEND-SPEC-Bookit-20260331.md
│   └── implementation-plans/   # Feature plans (new → ready → in-progress → done)
│
├── .claude/commands/           # Claude Code slash commands (/plan, /code-react, /code-go)
├── docker-compose.yml
└── CLAUDE.md                   # AI assistant instructions
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

```bash
# 1. Start only the database and mailpit
docker compose up db mailpit

# 2. Configure the API
cp api/.env.example api/.env   # edit if needed

# 3. Run the API
cd api && go run cmd/server/main.go

# 4. Run the frontend
cd web && npm install && npm run dev
```

Frontend env vars for manual runs: `cp web/.env.example web/packages/consumer/.env.local`

Staging and production secrets are stored in GCP Secret Manager and mounted automatically by Cloud Run.

---

## Contributing

> Full guide: [CONTRIBUTING.md](./CONTRIBUTING.md)

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

3. **Enable on Firebase Console** — go to Remote Config, add the string key (`my_feature`), set value to `true` for the desired environment (staging or production).

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
