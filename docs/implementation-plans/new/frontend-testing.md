---
title: "Frontend Test Suite"
status: NEW
created: 2026-04-08
author: "Bohdan Rohalskyi"
---

# Plan: Frontend Test Suite

## Summary

The web frontend has zero test coverage across all three packages (consumer,
biz, shared). This plan establishes the full testing infrastructure and covers
every currently implemented piece — auth flow, protected routes, hooks,
shared components, and the feature flag system.

**Goal:** Achieve meaningful coverage on all shipped code using Vitest +
React Testing Library + MSW, following TDD from this point forward.

---

## Phases

### Phase 1: Test infrastructure `[PENDING]`

Install and configure the testing stack in each package that needs it.

**Dependencies to add** (consumer, biz, shared as needed):
```json
"vitest": "^3.x",
"@vitest/coverage-v8": "^3.x",
"@testing-library/react": "^16.x",
"@testing-library/user-event": "^14.x",
"@testing-library/jest-dom": "^6.x",
"msw": "^2.x"
```

**Files to create per app:**
- `src/test/setup.ts` — imports `@testing-library/jest-dom`, starts MSW server
- `src/test/utils.tsx` — `renderWithProviders` wrapper (QueryClient +
  BrowserRouter + FeatureFlagProvider with stub init/evaluate)
- `src/mocks/server.ts` — MSW node server
- `src/mocks/handlers/index.ts` — barrel for all handlers
- `src/mocks/fixtures/auth.ts` — typed fixture builders for User, AuthResponse, Tokens

**Vitest config** — add `test` block to `vite.config.shared.ts`:
```typescript
test: {
  globals:     true,
  environment: 'jsdom',
  setupFiles:  ['./src/test/setup.ts'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    include:  ['src/**/*.{ts,tsx}'],
    exclude:  ['src/test/**', 'src/mocks/**'],
  },
},
```

---

### Phase 2: Shared package tests `[PENDING]`

**`shared/src/features/` — feature flag system:**
- `FeatureFlagProvider` renders children
- `useFeatureFlag` returns `false` before ready, correct value after init
- `useFeatureFlagsReady` returns `false` then `true`
- TypeScript: invalid flag name is a compile error (type-level test)

**`shared/src/stores/auth.ts` — auth store:**
- `setAuth` stores user and tokens, sets `isAuthenticated: true`
- `logout` clears all state
- `isTokenExpired` returns `true` when `expiresAt` is in the past
- Rehydration validation: corrupted tokens → `logout()` called, warning logged
- Rehydration validation: corrupted user → `logout()` called

**`shared/src/api/client.ts` — token refresh:**
- Concurrent 401 responses share one `refreshPromise` (not two refresh calls)
- Successful refresh retries the original request
- Failed refresh redirects to `/login`

---

### Phase 3: Consumer — auth pages `[PENDING]`

MSW handler: `POST /api/v1/auth/login`, `POST /api/v1/auth/register`,
`POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`

**`Login.tsx`:**
- Renders email and password fields
- Shows validation error on empty submit
- Calls API with correct body on valid submit
- Shows API error message on 401
- Redirects to `/account` on success, auth store populated

**`Register.tsx`:**
- Renders all four fields (name, email, phone, password)
- Shows field-level validation errors
- Redirects to `/account` on success

**`ForgotPassword.tsx`:**
- Shows success state regardless of whether email exists (no enumeration)
- Shows validation error for invalid email format

**`ResetPassword.tsx`:**
- Shows "Invalid Link" when no `?token=` param
- Shows error on expired/invalid token (API 400)
- Redirects to `/login` after successful reset

---

### Phase 4: Consumer — routing and auth guard `[PENDING]`

**`RequireAuth.tsx`:**
- Redirects to `/` when `isAuthenticated` is `false`
- Redirects to `/` when `user` is `null` (even if `isAuthenticated` is `true`)
- Renders children when both are valid

**`App.tsx` — routing:**
- `/unknown-path` renders `NotFound`
- `/account` renders `RequireAuth` wrapper
- Unauthenticated access to `/account` redirects to `/`

---

### Phase 5: Consumer — account and verify pages `[PENDING]`

**`Account.tsx`:**
- Renders user's name and email
- Resend verification button calls `POST /api/v1/auth/resend-verification`
- App switch button visible and calls `POST /api/v1/auth/app-switch-token`
- Logout clears store and redirects

**`VerifyEmail.tsx`:**
- Shows loading state while verifying
- Shows success on valid token (MSW 200)
- Shows error on invalid token (MSW 400)

---

### Phase 6: Biz — auth pages `[PENDING]`

Same scope as consumer auth but for the biz package. Biz uses the same
shared API client and auth store, so MSW handlers are identical — only
the page markup differs.

**`Login.tsx`:**
- Same assertions as consumer Login
- Redirects to `/` (not `/account`) on success

---

### Phase 7: CI integration `[PENDING]`

- Add `test` step to `web.yml` before the build steps:
  ```yaml
  - name: Run tests
    working-directory: web
    run: npm test -- --run --coverage
  ```
- Upload coverage to Codecov (same pattern as API workflow)
- Fail CI if any test fails

---

## Notes

- Tests follow TDD from Phase 2 onward: write the test first, then verify
  the existing implementation makes it pass (or fix the implementation)
- MSW handlers live in `src/mocks/handlers/` — shared fixtures ensure
  test data is consistent across all tests in a package
- `renderWithProviders` must include all providers the app wraps:
  `QueryClientProvider`, `FeatureFlagProvider` (with stub), `MemoryRouter`
- Auth store must be reset between tests — use `beforeEach(() => useAuthStore.getState().logout())`

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
