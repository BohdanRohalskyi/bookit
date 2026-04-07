---
title: "Authentication"
status: NEW
created: 2026-04-07
author: "Claude"
---

# Plan: Authentication

## Summary

User registration and login flow. Backend JWT auth with httpOnly cookies. Frontend forms with validation and state management.

**Goal:** Users can register, login, and maintain authenticated sessions.

---

## Phases

### Phase 1: Frontend Setup `[PENDING]`

Add required libraries (on-demand as needed):
- `openapi-fetch` — typed API client
- `openapi-typescript` — generate types from spec
- `@tanstack/react-query` — server state
- `zustand` — client state (auth store)
- `react-hook-form` + `zod` — form handling
- shadcn/ui components: Button, Input, Label, Card

**Files:**
- `web/src/lib/api.ts` — openapi-fetch client
- `web/src/stores/auth.ts` — Zustand auth store
- `web/src/types/api.ts` — generated types (or via npm script)

---

### Phase 2: Auth Backend `[PENDING]`

Implement Identity domain endpoints:

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
- Tokens in httpOnly cookies (not response body)
- Input validation per OpenAPI spec
- Error responses per RFC 7807

**Files:**
- `api/internal/domain/identity/` — domain logic
- `api/internal/handler/auth.go` — HTTP handlers
- Database: `users`, `refresh_tokens` tables

---

### Phase 3: Auth Frontend `[PENDING]`

Pages:
- `/register` — registration form
- `/login` — login form

**Register form fields:**
- Email (required, valid format)
- Password (required, min 8 chars)
- First name (required)
- Last name (required)
- "Already have an account? Login" link

**Login form fields:**
- Email (required)
- Password (required)
- "Don't have an account? Register" link

**Behavior:**
- Loading states during API calls
- Error display (inline validation + API errors)
- On success: redirect to `/` with toast
- Store user in auth store

**Files:**
- `web/src/pages/Register.tsx`
- `web/src/pages/Login.tsx`
- `web/src/components/auth/RegisterForm.tsx`
- `web/src/components/auth/LoginForm.tsx`

---

### Phase 4: Protected Routes & Interceptor `[PENDING]`

**Backend:**
- Auth middleware that validates JWT from cookie
- Apply to protected endpoints

**Frontend:**
- `RequireAuth` wrapper component
- Redirect unauthenticated users to `/login`
- Token refresh interceptor:
  - Intercept 401 responses
  - Call `/auth/refresh`
  - Retry original request
  - If refresh fails → logout

**Files:**
- `api/internal/middleware/auth.go`
- `web/src/components/auth/RequireAuth.tsx`
- `web/src/lib/api.ts` — add interceptor

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
