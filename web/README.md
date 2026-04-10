# Bookit Web

React frontend for the Bookit booking platform — monorepo with two apps.

## Apps

| App | Package | Port | Description |
|-----|---------|------|-------------|
| Consumer | `packages/consumer` | 5173 | Client booking app |
| Biz | `packages/biz` | 5174 | Provider management app |
| Shared | `packages/shared` | — | Components, API client, stores, hooks |

## Quick Start

### Using Docker Compose (recommended)

```bash
# From project root
docker compose up
```

Consumer app → http://localhost:5173  
Biz app → http://localhost:5174

### Manual Setup

```bash
npm install
npm run dev   # starts both consumer and biz
```

Frontend env vars for manual runs:
```bash
cp .env.example packages/consumer/.env.local
cp .env.example packages/biz/.env.local
```

Firebase vars can stay blank locally — feature flags default to `false`.

## Common Commands

Run from this directory (`web/`):

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both apps |
| `npm run typecheck` | Type-check all packages |
| `npm run lint` | Lint all packages |
| `npm run generate:types` | Regenerate API types from OpenAPI spec |

## Monorepo Structure

```
web/
├── packages/
│   ├── consumer/           # Client booking app
│   ├── biz/                # Provider management app
│   └── shared/
│       └── src/
│           ├── api/        # openapi-fetch client + generated types
│           ├── components/ # shadcn/ui components
│           ├── stores/     # Zustand stores (auth)
│           ├── hooks/      # useAppSwitch, etc.
│           └── features/   # Feature flags (useFeatureFlag, flags.ts)
├── vite.config.shared.ts
└── Dockerfile.dev
```

## Conventions

See [`web/CLAUDE.md`](./CLAUDE.md) for the full list of rules (no `<h1>`/`<h2>`, openapi-fetch only, design tokens, auth guard pattern, etc.).
