---
title: "Authentication"
status: IN_PROGRESS
created: 2026-04-07
author: "bohdan.rohalskyi@paysera.com"
---

# Plan: Authentication

## Summary

User registration and login flow. Backend JWT auth with httpOnly cookies. Frontend forms with validation and state management.

**Goal:** Users can register, login, and maintain authenticated sessions.

---

## Phases

### Phase 1: Frontend Setup `[DONE]`

Installed libraries:
- `openapi-fetch` — typed API client
- `openapi-typescript` — generate types from spec
- `@tanstack/react-query` — server state
- `zustand` — client state (auth store)
- `react-hook-form` + `zod` — form handling
- `tailwindcss` + shadcn/ui (Button, Input, Label, Card)

**Files created:**
- `web/src/lib/api.ts` — openapi-fetch client with credentials
- `web/src/lib/api.d.ts` — generated types from OpenAPI spec
- `web/src/lib/utils.ts` — shadcn utilities
- `web/src/stores/auth.ts` — Zustand auth store with persist
- `web/src/components/ui/` — shadcn components
- `web/src/main.tsx` — QueryClientProvider
- `web/package.json` — added `generate:types` script

> Commit: (pending)

---

### Phase 2: Auth Backend `[DONE]`

Implemented Identity domain endpoints:

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/register` | Create account |
| `POST /api/v1/auth/login` | Authenticate |
| `POST /api/v1/auth/refresh` | Refresh tokens |
| `POST /api/v1/auth/logout` | Revoke refresh token |

**Implementation details:**
- Password hashing: bcrypt (cost 12)
- JWT access token: 30 min expiry
- JWT refresh token: 30 day expiry
- Tokens in response body (httpOnly cookies for Phase 4)
- Input validation via gin binding
- Error responses per RFC 7807

**Files created:**
- `api/internal/domain/identity/user.go` — User model
- `api/internal/domain/identity/repository.go` — DB operations
- `api/internal/auth/jwt.go` — JWT generation/validation
- `api/internal/auth/service.go` — Auth business logic
- `api/internal/auth/handler.go` — HTTP handlers
- `api/migrations/000002_create_refresh_tokens_table.up.sql`
- `api/cmd/server/main.go` — wired up auth routes

> Commit: (pending)

---

### Phase 3: Auth Frontend `[DONE]`

Pages:
- `/register` — registration form
- `/login` — login form

**Register form fields:**
- Name (required)
- Email (required, valid format)
- Phone (required)
- Password (required, min 8 chars)
- "Already have an account? Login" link

**Login form fields:**
- Email (required)
- Password (required)
- "Don't have an account? Register" link

**Behavior:**
- Loading states during API calls
- Error display (inline validation + API errors)
- On success: redirect to `/`, store user in auth store

**Files updated:**
- `web/src/pages/Register.tsx` — form with react-hook-form + zod
- `web/src/pages/Login.tsx` — form with react-hook-form + zod
- Removed `web/src/pages/AuthPage.css` — using Tailwind now

> Commit: (pending)

---

### Phase 4: Protected Routes & Interceptor `[DONE]`

**Backend:**
- Auth middleware in `api/internal/auth/handler.go` (AuthMiddleware method)
- Ready to apply to protected endpoints

**Frontend:**
- `RequireAuth` wrapper component
- Redirect unauthenticated users to `/login`
- Token refresh interceptor in api client
- Token storage in Zustand with expiry tracking
- Protected `/dashboard` route
- Landing page shows user menu when logged in

**Files created/updated:**
- `web/src/components/auth/RequireAuth.tsx`
- `web/src/stores/auth.ts` — tokens + expiry tracking
- `web/src/lib/api.ts` — auth middleware with refresh
- `web/src/pages/Dashboard.tsx` — protected page
- `web/src/pages/Landing.tsx` — user menu + logout
- `web/src/App.tsx` — protected route

> Commit: (pending)

---

## Out of Scope (Future)

- Email verification flow
- Password reset
- OAuth (Google, Facebook)
- Remember me / device trust

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
