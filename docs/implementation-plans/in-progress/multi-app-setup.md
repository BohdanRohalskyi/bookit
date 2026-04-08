---
title: "Multi-App Setup (Consumer + Business)"
status: IN_PROGRESS
created: 2026-04-08
author: "Claude"
---

# Plan: Multi-App Setup (Consumer + Business)

## Summary

Restructure the frontend into an npm workspaces monorepo with two apps (consumer, biz) sharing common code. Set up Firebase multi-site hosting for both apps. Implement cross-app navigation with session handoff.

**Goal:** Two separate UIs (consumer + business) deployed to Firebase, sharing auth and common components.

---

## Current State

- Single app at `web/` deployed to `pt-duo-bookit.web.app` (prod) and `bookit-staging.web.app` (staging)
- Auth implemented with Zustand + localStorage persistence
- shadcn/ui components, TanStack Query, openapi-fetch already set up

---

## Target Architecture

```
web/
├── package.json              # Workspace root
├── packages/
│   ├── shared/               # Shared code
│   │   ├── api/              # openapi-fetch client + generated types
│   │   ├── components/ui/    # shadcn/ui primitives
│   │   ├── hooks/            # useAuth, useToast
│   │   ├── stores/           # auth store
│   │   └── lib/              # utils
│   ├── consumer/             # Consumer app → pt-duo-bookit.web.app
│   │   └── src/
│   │       ├── pages/        # Landing, Search, Booking, Account
│   │       └── components/   # Consumer-specific
│   └── biz/                  # Business app → pt-duo-bookit-biz.web.app
│       └── src/
│           ├── pages/        # Dashboard, Calendar, Services, Staff
│           └── components/   # Biz-specific
```

**Firebase Sites:**

| Environment | Consumer | Business |
|-------------|----------|----------|
| Production  | `pt-duo-bookit.web.app` | `pt-duo-bookit-biz.web.app` |
| Staging     | `bookit-staging.web.app` | `bookit-biz-staging.web.app` |

---

## Session Sharing Strategy

**Problem:** localStorage is per-origin, so `pt-duo-bookit.web.app` and `pt-duo-bookit-biz.web.app` don't share storage.

**Solution for MVP:** Session handoff via URL token.

1. User clicks "Switch to Business Portal" on consumer app
2. Consumer app calls `POST /api/v1/auth/app-switch-token` (new endpoint)
3. API returns a short-lived, one-time token (5 min TTL)
4. Consumer app redirects to `biz.app?handoff=<token>`
5. Biz app detects `handoff` param, exchanges it for session, removes param from URL

**Future (with custom domain):** Move to httpOnly cookies scoped to `.yourdomain.com` — session shared automatically.

---

## Phases

### Phase 1: Create Firebase Sites `[DONE]`

Created Firebase hosting sites and updated configs:
- `pt-duo-bookit-biz` → https://pt-duo-bookit-biz.web.app
- `bookit-biz-staging` → https://bookit-biz-staging.web.app

**Files updated:**
- `web/.firebaserc` — added biz-prod, biz-staging targets
- `web/firebase.json` — renamed targets (prod→consumer-prod, staging→consumer-staging), added biz targets
- `.github/workflows/web.yml` — updated deploy target names

> Commit: (pending)

---

### Phase 2: Restructure to npm Workspaces `[DONE]`

Restructured to npm workspaces monorepo:

**Structure created:**
```
web/
├── package.json              # Workspace root with "workspaces": ["packages/*"]
├── packages/
│   ├── shared/               # @bookit/shared
│   │   ├── src/api/          # client.ts, types.gen.ts, index.ts
│   │   ├── src/components/ui # button, input, label, card
│   │   ├── src/stores/       # auth store
│   │   └── src/lib/          # utils
│   ├── consumer/             # Consumer app
│   │   ├── src/pages/        # All existing pages migrated
│   │   ├── src/components/   # RequireAuth
│   │   ├── src/hooks/        # useFeatureFlag
│   │   └── src/lib/          # firebase
│   └── biz/                  # Business app
│       └── src/pages/        # Home, Login
```

**Scripts:**
- `npm run dev` → runs consumer
- `npm run dev:biz` → runs biz
- `npm run build:consumer` / `npm run build:biz`

**Import updates:**
- All consumer pages now import from `@bookit/shared`, `@bookit/shared/api`, `@bookit/shared/stores`

> Commit: (pending)

---

### Phase 3: Create Biz App Shell `[DONE]`

Created minimal biz app with:
- Home page with "Coming Soon" message and "Switch to Client View" button
- Login page (reuses shared components)
- TanStack Query provider
- Tailwind CSS styling

> Commit: (pending)

---

### Phase 6: Update Firebase Config `[DONE]`

Updated `firebase.json` to point to workspace package dist directories:
- `consumer-prod` / `consumer-staging` → `packages/consumer/dist`
- `biz-prod` / `biz-staging` → `packages/biz/dist`

> Commit: (pending)

---

### Phase 7: Update CI/CD `[DONE]`

Updated `.github/workflows/web.yml`:
- Builds both consumer and biz apps
- Uploads separate artifacts for each
- Deploys consumer and biz in parallel jobs
- Added `VITE_CONSUMER_URL` and `VITE_BIZ_URL` environment variables

> Commit: (pending)

---

### Phase 2 (Original Plan): Restructure to npm Workspaces `[CHANGED]`

**Original plan:**

```json
{
  "name": "@bookit/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./api": "./src/api/client.ts",
    "./stores": "./src/stores/index.ts",
    "./components/*": "./src/components/*/index.ts"
  },
  "scripts": {
    "generate:types": "openapi-typescript ../../api/openapi/spec.yaml -o src/api/types.gen.ts"
  },
  "dependencies": {
    "openapi-fetch": "^0.17.0",
    "zustand": "^5.0.12",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.5.0"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

**2.4 Update root `web/package.json`:**

```json
{
  "name": "bookit-web",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "npm run dev -w consumer",
    "dev:biz": "npm run dev -w biz",
    "build": "npm run build --workspaces",
    "build:consumer": "npm run build -w consumer",
    "build:biz": "npm run build -w biz",
    "lint": "npm run lint --workspaces",
    "generate:types": "npm run generate:types -w @bookit/shared"
  }
}
```

**2.5 Move consumer-specific code to `packages/consumer/`:**

| From | To |
|------|-----|
| `src/pages/*` | `packages/consumer/src/pages/` |
| `src/components/auth/*` | `packages/consumer/src/components/auth/` |
| `src/App.tsx` | `packages/consumer/src/App.tsx` |
| `src/main.tsx` | `packages/consumer/src/main.tsx` |
| `index.html` | `packages/consumer/index.html` |
| `vite.config.ts` | `packages/consumer/vite.config.ts` |
| `tsconfig.*.json` | `packages/consumer/` |

**2.6 Create `packages/consumer/package.json`:**

```json
{
  "name": "consumer",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc -b",
    "lint": "eslint ."
  },
  "dependencies": {
    "@bookit/shared": "*",
    "@tanstack/react-query": "^5.96.2",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.14.0",
    "react-hook-form": "^7.72.1",
    "@hookform/resolvers": "^5.2.2",
    "zod": "^4.3.6",
    "lucide-react": "^1.7.0"
  }
}
```

---

### Phase 3: Create Biz App Shell `[PENDING]`

**3.1 Create `packages/biz/package.json`:**

Same structure as consumer, different name.

**3.2 Create minimal pages:**

**`packages/biz/src/pages/Home.tsx`:**
```tsx
import { Button } from '@bookit/shared/components/ui'
import { useAuthStore } from '@bookit/shared/stores'

export function Home() {
  const { user, isAuthenticated } = useAuthStore()
  const consumerUrl = import.meta.env.VITE_CONSUMER_URL

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Bookit Business</h1>
        <p className="text-muted-foreground">
          {isAuthenticated 
            ? `Welcome, ${user?.name}` 
            : 'Manage your business'}
        </p>
        <Button asChild>
          <a href={consumerUrl}>Switch to Client View</a>
        </Button>
      </div>
    </div>
  )
}
```

**3.3 Create `packages/biz/src/App.tsx`:**
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Login } from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
}
```

---

### Phase 4: Session Handoff `[DONE]`

Implemented app switch token system for seamless session transfer between apps.

**Backend (Go):**
- Added `TokenTypeAppSwitch` constant to `identity/repository.go`
- Added `CreateAppSwitchToken()` and `ExchangeAppSwitchToken()` to `auth/service.go`
- Added handler methods in `auth/handler.go`
- Added routes: `POST /api/v1/auth/app-switch-token` (protected), `POST /api/v1/auth/exchange-app-switch-token` (public)
- Uses existing `auth_tokens` table with `app_switch` type, 5 min TTL

**Frontend:**
- Created `packages/shared/src/hooks/useAppSwitch.ts` with `switchTo()` and `handleHandoff()`
- Wired up `handleHandoff()` in both apps' `main.tsx` via `useEffect`
- Updated biz Home.tsx to use `switchTo()` for "Switch to Client View" button

**OpenAPI spec:**
- Added `AppSwitchTokenResponse` and `ExchangeAppSwitchTokenRequest` schemas
- Added endpoint definitions with proper security annotations

> Commit: (pending)

---

### Phase 5: Update Consumer App `[REJECTED]`

**Reason:** User requested to skip this phase for now. The biz app has the "Switch to Client View" button implemented.

---

### Phase 8: Cleanup `[DONE]`

Removed old files after verifying workspace structure works:
- Deleted `web/src/` directory
- Deleted `web/index.html`, `web/vite.config.ts`, `web/tsconfig.app.json`, `web/tsconfig.node.json`
- Moved `web/components.json` to `web/packages/shared/components.json`
- Updated `web/tsconfig.json` to reference workspace packages

> Commit: (pending)

---

### Phase 5 (Original): Update Consumer App `[REJECTED]`

Add "Switch to Business Portal" button in Account page or header (for users with businesses).

**`packages/consumer/src/components/UserMenu.tsx`:**
```tsx
const bizUrl = import.meta.env.VITE_BIZ_URL
const { switchTo } = useAppSwitch()

// In menu
{user?.businesses?.length > 0 && (
  <Button variant="ghost" onClick={() => switchTo(bizUrl)}>
    Manage Business
  </Button>
)}
```

---

### Phase 6: Update Firebase Config `[PENDING]`

**`web/firebase.json`:**
```json
{
  "hosting": [
    {
      "target": "consumer-prod",
      "public": "packages/consumer/dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    },
    {
      "target": "consumer-staging",
      "public": "packages/consumer/dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    },
    {
      "target": "biz-prod",
      "public": "packages/biz/dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    },
    {
      "target": "biz-staging",
      "public": "packages/biz/dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    }
  ]
}
```

---

### Phase 7: Update CI/CD `[PENDING]`

**Split into two workflows or matrix build:**

`.github/workflows/web.yml`:
- Build both apps in parallel
- Deploy consumer to `consumer-staging` / `consumer-prod`
- Deploy biz to `biz-staging` / `biz-prod`

**Environment variables needed:**
```
VITE_API_URL=https://api.bookit.com
VITE_CONSUMER_URL=https://pt-duo-bookit.web.app
VITE_BIZ_URL=https://pt-duo-bookit-biz.web.app
```

(Staging variants for PR builds)

---

### Phase 8: Migrations & Cleanup `[PENDING]`

- Add `app_switch_tokens` migration (or use Redis if available)
- Update OpenAPI spec with new endpoints
- Remove old root-level `src/` after migration verified
- Test full flow: login on consumer → switch to biz → switch back

---

## Environment Variables

| Variable | Consumer | Biz |
|----------|----------|-----|
| `VITE_API_URL` | API base URL | Same |
| `VITE_BIZ_URL` | Biz app URL | — |
| `VITE_CONSUMER_URL` | — | Consumer app URL |

---

## Out of Scope

- Custom domain setup (will simplify session sharing later)
- Business registration flow (separate plan)
- Full biz dashboard UI (separate plan)

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
