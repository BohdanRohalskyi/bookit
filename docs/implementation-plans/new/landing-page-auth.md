---
title: "Landing Page + Auth"
status: NEW
created: 2026-04-06
author: "Claude"
---

# Plan: Landing Page + Auth

## Summary

First user-facing feature: landing page with authentication (register/login). Design to be provided later.

---

## Phases

### Phase 1: Frontend Setup (on-demand) `[PENDING]`

Add libraries as needed:
- shadcn/ui (buttons, forms, inputs)
- React Router (if not added)
- openapi-fetch + generated types
- Zustand (auth state)

---

### Phase 2: Landing Page `[PENDING]`

Static landing page with:
- Hero section
- Value proposition
- CTA buttons (Register / Login)
- Footer

**Blocked on:** Design

---

### Phase 3: Auth Backend `[PENDING]`

Implement endpoints:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

Include:
- Password hashing (bcrypt)
- JWT generation (access + refresh)
- httpOnly cookies
- Input validation

---

### Phase 4: Auth Frontend `[PENDING]`

Pages:
- `/register` — registration form
- `/login` — login form

Include:
- Form validation
- Error handling
- Redirect after auth
- Auth state management

---

### Phase 5: Protected Routes `[PENDING]`

- Auth middleware (backend)
- Route guards (frontend)
- Token refresh interceptor

---

## Dependencies

- [ ] Design for landing page
- [ ] Design for auth pages (or use defaults)

---

## Notes

Details to be refined when implementation starts.
