# React / TypeScript Frontend Coding

You are implementing a React frontend feature for the Bookit project. Follow these conventions exactly.

## Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript (strict mode) |
| Build | Vite 8 + `@tailwindcss/vite` |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Client state | Zustand (via `@bookit/shared/stores`) |
| HTTP client | openapi-fetch (via `@bookit/shared/api`) |
| UI components | shadcn/ui from `@bookit/shared` |
| Styling | Tailwind CSS v4 — no config file, all via CSS variables |

## Apps

- **Consumer** (`web/packages/consumer/`) — client booking app
- **Biz** (`web/packages/biz/`) — provider management app
- **Shared** (`web/packages/shared/`) — UI components, API client, stores, hooks

---

## Reuse before you create

**Before writing any new component, hook, store, or utility — search the shared package first.**

```
web/packages/shared/src/
├── api/            # openapi-fetch client + generated types
├── components/ui/  # Button, Input, Label, Card, ...
├── stores/         # useAuthStore (Zustand)
├── hooks/          # useAppSwitch, ...
└── features/       # useFeatureFlag, FeatureFlagProvider, flags.ts
```

Check with Grep before implementing:
- Is there already a hook that does this? → `web/packages/shared/src/hooks/`
- Is there a UI component? → `web/packages/shared/src/components/ui/`
- Is there a store slice for this state? → `web/packages/shared/src/stores/`

If something useful almost exists but needs a small change, **extend it rather than duplicating it**.
Only create something new in the shared package if it will be used by more than one app.
If it's app-specific, put it in that app's own `src/components/` or `src/hooks/`.

---

## Feature flags

Every new user-facing feature must be gated behind a feature flag.

```ts
// 1. Add default (false) to web/packages/shared/src/features/flags.ts
export const FLAGS = {
  my_feature: false,
} satisfies Record<string, boolean>

// 2. Gate the UI
import { useFeatureFlag } from '@bookit/shared'
const isEnabled = useFeatureFlag('my_feature')
if (!isEnabled) return null
```

Enable the flag in Firebase Console → Remote Config.

---

## Critical rules

### Fonts & headings
- **Never use `<h1>` or `<h2>` tags** — global CSS rules override their color and size, breaking design
- Use `<p>` with explicit Tailwind classes for all headings
- Sora heading font: `font-heading font-semibold` (loaded via Google Fonts in `index.html`)
- Body font: Geist Variable (default `font-sans`)

### Design tokens (biz app)
- Backgrounds: `#e7f0fa` (light blue nav/hero), `#f2f2f2` (cards), white
- Text: `#020905` (primary), `rgba(2,9,5,0.6)` (secondary)
- Accent: `#1069d1` (interactive blue)
- Cards: `border border-[rgba(2,9,5,0.15)] rounded-lg`

### Design tokens (consumer app)
- Backgrounds: white, `#f8fafc` (slate-50), `#f0f7ff` (hero gradient)
- Text: `#0f172a` (slate-900), `#64748b` (slate-500)
- Accent: `#1069d1`
- Cards: `border border-slate-100 rounded-2xl shadow-sm`

### API calls
- Always use `api.GET/POST/PUT/DELETE` from `@bookit/shared/api`
- Never use axios or raw fetch
- Types come from generated `@bookit/shared/api` (openapi-typescript)
- Wrap mutations in TanStack Query `useMutation`, queries in `useQuery`

### Components
- Prefer plain HTML + Tailwind over shadcn components for full design control on pages
- Use shadcn components (`Button`, `Input`, `Label`, `Card`) for forms and utility UI
- No inline styles — Tailwind only
- No `any` types — use generated API types or explicit interfaces

### Auth
- Auth state via `useAuthStore()` from `@bookit/shared/stores`
- Protected routes: redirect with `useNavigate` + `useEffect` if `!isAuthenticated`
- Tokens stored in httpOnly cookies — never read directly

### File placement
- Pages → `src/pages/`
- Shared components → `web/packages/shared/src/components/`
- App-specific components → `src/components/`
- Hooks → `src/hooks/` or `web/packages/shared/src/hooks/`

---

## Before finishing

Run `npx tsc --noEmit` in the affected package to confirm zero type errors.

## Arguments

$ARGUMENTS
