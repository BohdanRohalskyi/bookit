# Bookit Web — Claude Instructions

> Use the `/code-react` slash command when implementing frontend features.
> Root `CLAUDE.md` has project-wide context (git flow, architecture, domains).

## Stack

| | |
|-|-|
| Framework | React 19 + TypeScript (strict) |
| Build | Vite 8 + `@tailwindcss/vite` |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| HTTP client | openapi-fetch — **never axios** |
| UI components | shadcn/ui via `@bookit/shared` |
| Styling | Tailwind CSS v4 (no config file) |
| Fonts | Geist Variable (body) · Sora (headings, Google Fonts) |

## Monorepo Layout

```
web/
├── packages/
│   ├── consumer/       # Client booking app  → localhost:5173
│   ├── biz/            # Provider mgmt app   → localhost:5174
│   └── shared/         # Shared across apps
│       ├── src/
│       │   ├── api/            # openapi-fetch client + generated types
│       │   ├── components/ui/  # shadcn/ui components
│       │   ├── stores/         # Zustand stores (auth)
│       │   ├── hooks/          # useAppSwitch, etc.
│       │   └── features/       # Feature flags
│       └── components.json     # shadcn config
├── vite.config.shared.ts
└── Dockerfile.dev
```

## Non-Negotiable Rules

### 1. Never use `<h1>` or `<h2>` tags
Global CSS rules in `index.css` override their color and font-size, breaking the design on both apps. Use `<p>` with explicit Tailwind classes instead:

```tsx
// ❌ Wrong — global CSS will override color and size
<h1 className="text-white text-[48px]">Title</h1>

// ✅ Correct
<p className="font-heading font-semibold text-[48px] leading-[1.2] text-white">Title</p>
```

### 2. Heading font
`font-heading` maps to Sora (loaded via Google Fonts in each app's `index.html`).
Always pair with `font-semibold` for headings.

### 3. openapi-fetch only
```ts
// ✅
import { api } from '@bookit/shared/api'
const { data, error } = await api.GET('/api/v1/...')

// ❌ Never
import axios from 'axios'
```

### 4. No `any` — use generated types
Types are generated from `api/openapi/spec.yaml` into `web/packages/shared/src/api/types.gen.ts`.
Regenerate after spec changes: `cd web && npm run generate:types`

### 5. Auth guard pattern
```tsx
useEffect(() => {
  if (!isAuthenticated) navigate('/login')
}, [isAuthenticated, navigate])

if (!isAuthenticated) return null
```

## Design Tokens

### Biz app (`packages/biz`)

| Token | Value | Usage |
|-------|-------|-------|
| Light blue | `#e7f0fa` | Navbar, hero bg, CTA bg |
| Interactive blue | `#1069d1` | Buttons, links, badges |
| Primary text | `#020905` | All text |
| Secondary text | `rgba(2,9,5,0.6)` | Labels, placeholders |
| Card border | `rgba(2,9,5,0.15)` | All card borders |
| Card radius | `rounded-lg` | Cards |
| Button radius | `rounded-[6px]` | All buttons |

### Consumer app (`packages/consumer`)

| Token | Value | Usage |
|-------|-------|-------|
| Hero bg | `#f0f7ff` | Hero gradient start |
| Interactive blue | `#1069d1` | Primary CTAs |
| Primary text | `#0f172a` (slate-900) | Headings |
| Secondary text | `#64748b` (slate-500) | Body, labels |
| Card border | `border-slate-100` | Cards |
| Card radius | `rounded-2xl` | Cards |
| Button radius | `rounded-xl` | Primary buttons |

## Cross-App Session Handoff

Use `useAppSwitch` from `@bookit/shared/hooks` to switch between apps with auth preserved:

```tsx
const { switchTo } = useAppSwitch()
const consumerUrl = import.meta.env.VITE_CONSUMER_URL || 'https://pt-duo-bookit.web.app'
switchTo(consumerUrl)
```

## Local Development

```bash
# Start everything (requires docker compose up for API)
cd web && npm run dev            # starts both consumer + biz

# Individual apps
cd web && npm run dev -w packages/consumer
cd web && npm run dev -w packages/biz

# Type check all packages
cd web && npm run typecheck

# Type check one package
cd web/packages/biz && npx tsc --noEmit
```

Node modules in Docker are in a named volume (`web_node_modules`).
After adding a new npm package, rebuild the container:
```bash
docker compose up --build consumer biz
```

## Before Committing

```bash
cd web && npx tsc --noEmit   # Zero type errors required
```
