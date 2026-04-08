# Bookit Codebase Review

**Date:** 2026-04-08  
**Reviewer:** Claude Code (claude-sonnet-4-6)  
**Scope:** Full codebase — `api/` (Go) and `web/` (React/TypeScript)

---

## Overall Rating: 6.5 / 10

The codebase has solid architectural foundations — correct conventions, clean package organization, and good security primitives in the auth layer. However, it has zero test coverage across both halves, a large spec-vs-implementation mismatch in the API, and a handful of concrete security and correctness bugs that need addressing before production.

---

## Table of Contents

1. [Go API Review](#go-api-review)
   - [Package Structure](#1-package-structure--organization)
   - [Error Handling](#2-error-handling)
   - [Context Propagation](#3-context-propagation)
   - [HTTP Handlers (Gin)](#4-http-handler-patterns-gin)
   - [Configuration](#5-configuration-management)
   - [Database Access](#6-database-access-patterns)
   - [Middleware](#7-middleware)
   - [Code Style](#8-code-style--naming)
   - [Security](#9-security)
   - [OpenAPI Spec](#10-openapi-spec-quality)
   - [Logging & Observability](#11-logging--observability)
   - [Testing](#12-testing)
   - [Dependencies & Build](#13-dependencies--build)
2. [React Web Review](#react-web-review)
   - [Project Structure](#1-project-structure--organization-1)
   - [Component Design](#2-component-design--composition)
   - [TypeScript Usage](#3-typescript-usage--type-safety)
   - [State Management](#4-state-management)
   - [API Client](#5-api-client-setup--usage)
   - [Routing](#6-routing)
   - [Code Style](#7-code-style--naming-1)
   - [Imports & Exports](#8-imports--exports)
   - [Build Configuration](#9-build-configuration)
   - [Dependencies](#10-packagejson-dependencies--workspace)
3. [Cross-Cutting Summary](#cross-cutting-summary)
4. [Priority Action Plan](#priority-action-plan)

---

## Go API Review

### 1. Package Structure & Organization

**Rating: 8/10**

**Good:**
- Clear hierarchy: `cmd/`, `internal/auth/`, `internal/domain/`, `internal/platform/` — all domains properly separated
- All implementation details in `internal/` — prevents accidental external usage
- Domain packages (`identity`, `mail`, `auth`) follow Single Responsibility Principle
- Infrastructure abstraction via `platform/` packages (config, database, logger, flags)

**Issues:**

> **[CRITICAL]** `internal/api/` directory is empty — `types.gen.go` does not exist

`oapi-codegen.yaml` points to `internal/api/types.gen.go` which was never generated. This means the code generation step has never been run (or its output is not committed). 25+ endpoints defined in `api/openapi/spec.yaml` have no corresponding Go implementation.

Unimplemented endpoints include:
- `GET/PUT /api/v1/users/me`
- All `/api/v1/providers/*` endpoints
- All `/api/v1/businesses/*` endpoints
- All `/api/v1/locations/*` endpoints
- All `/api/v1/services/*` endpoints
- All `/api/v1/staff/*` endpoints
- All `/api/v1/equipment/*` endpoints
- Booking, availability, search, payment webhook endpoints
- OAuth flow (`/api/v1/auth/oauth/{provider}`)

Either run `make generate` and commit the output, or trim the spec to match what is actually implemented.

---

### 2. Error Handling

**Rating: 8/10**

**Good:**
- Consistent use of `fmt.Errorf("context: %w", err)` throughout (`cmd/server/main.go:42,58,66`, `platform/database/postgres.go:18,30,36`)
- Sentinel errors well-defined in `domain/identity/repository.go`:
  ```go
  var (
      ErrUserNotFound = errors.New("user not found")
      ErrEmailExists  = errors.New("email already exists")
      ErrInvalidToken = errors.New("invalid or expired token")
  )
  ```
- `errors.Is()` used correctly for error identity checks throughout `auth/service.go`
- Security-aware error design: `ForgotPassword` returns identical response regardless of email existence (prevents enumeration)

**Issues:**

> **[HIGH]** `domain/identity/repository.go:113-116` — error detection via string matching

```go
if strings.Contains(err.Error(), "idx_users_email_lower") {
    return nil, ErrEmailExists
}
```

This is fragile. PostgreSQL error messages can vary across versions. Use the pgx error interface instead:

```go
var pgErr *pgconn.PgError
if errors.As(err, &pgErr) && pgErr.Code == "23505" {
    return nil, ErrEmailExists
}
```

> **[MEDIUM]** Inconsistent error logging across handlers — `Login` handler (`auth/handler.go:134`) does not log errors while `Register`, `VerifyEmail`, `ResendVerification` all do.

---

### 3. Context Propagation

**Rating: 8/10**

**Good:**
- All handlers use `c.Request.Context()` consistently
- All DB operations accept and thread context
- `context.WithoutCancel()` used correctly for background email sending (`auth/service.go:79-91`) — request cancellation does not abort in-flight emails

**Issues:**

> **[MEDIUM]** `cmd/server/main.go:36-37` — cancellable context created but never passed to the HTTP server

```go
ctx, cancel := context.WithCancel(context.Background())
defer cancel()
// ctx is never used for server initialization
```

The server uses a separate `shutdownCtx` for graceful shutdown, which is correct. But the `ctx` from `run()` is only used for Firebase initialization. This is not a bug, but is misleading.

---

### 4. HTTP Handler Patterns (Gin)

**Rating: 7/10**

**Good:**
- Clean route registration with clear grouping (`cmd/server/main.go:119-140`)
- Proper protected route group using auth middleware (`main.go:132-136`)
- Correct middleware ordering: logger → recovery → CORS

**Issues:**

> **[CRITICAL]** `cmd/server/main.go:198-200` — CORS allows any Firebase project

```go
if !allowed && len(origin) > 0 &&
    (strings.HasSuffix(origin, ".web.app") || strings.HasSuffix(origin, ".firebaseapp.com")) {
    allowed = true
}
```

This grants any Firebase project CORS access to your API. An attacker can create a `.web.app` project and call your API cross-origin.

**Fix:** Whitelist your specific domains:
```go
allowedOrigins := map[string]bool{
    "https://pt-duo-bookit.web.app":      true,
    "https://bookit-staging.web.app":     true,
    "https://pt-duo-bookit.firebaseapp.com": true,
}
```

> **[LOW]** `PATCH` is listed in CORS allowed methods (`main.go:207`) but no PATCH handlers are registered.

> **[MEDIUM]** Error response construction is duplicated in every handler. Extract to a helper:
```go
func respondError(c *gin.Context, status int, errType, title, detail string) {
    c.JSON(status, ErrorResponse{Type: errType, Title: title, Detail: detail})
}
```

---

### 5. Configuration Management

**Rating: 7/10**

**Good:**
- Centralized config in `platform/config/config.go` — single source of truth
- Sensible environment-aware defaults
- Required values validated at startup (`config.go:62-70`)

**Issues:**

> **[HIGH]** `config/config.go:42` + `logger/logger.go:27` — `LOG_LEVEL` is loaded but the logger always uses `slog.LevelInfo`

```go
// config.go
LogLevel: getEnv("LOG_LEVEL", "info"),  // loaded but ignored

// logger.go
opts := &slog.HandlerOptions{
    Level: slog.LevelInfo,  // hardcoded, never reads cfg.LogLevel
}
```

**Fix:**
```go
func New(environment, logLevel string) *slog.Logger {
    var level slog.Level
    if err := level.UnmarshalText([]byte(logLevel)); err != nil {
        level = slog.LevelInfo
    }
    opts := &slog.HandlerOptions{Level: level}
    // ...
}
```

> **[MEDIUM]** `config.go:89-94` — `strconv.Atoi` failure silently falls back to default port with no log warning. If `API_PORT=invalid`, the server starts on a different port with no indication.

> **[LOW]** No minimum length validation for `JWT_SECRET`. A short secret is a security risk.
```go
if len(cfg.JWTSecret) < 32 {
    return nil, errors.New("JWT_SECRET must be at least 32 characters")
}
```

---

### 6. Database Access Patterns

**Rating: 8/10**

**Good:**
- Connection pool configured correctly (`platform/database/postgres.go:22-26`):
  - Max connections: 25, Min: 5, Health check: 1m, Idle timeout: 30m — all reasonable
- All queries use parameterized placeholders (`$1`, `$2`) — no SQL injection risk
- Tokens hashed with SHA-256 before storage (`repository.go:140-142`)
- IP-based validation for app-switch tokens

**Issues:**

> **[HIGH]** String-based error detection (see §2 above — same issue at `repository.go:129-131`)

> **[MEDIUM]** No timeout on health check DB ping (`cmd/server/main.go:237`) — if the database hangs, the health endpoint blocks indefinitely. Wrap in a `context.WithTimeout`.

---

### 7. Middleware

**Rating: 7/10**

**Good:**
- Request logging middleware generates and logs request IDs with fallback to UUID
- Auth middleware correctly distinguishes expired vs invalid tokens
- Log level set based on HTTP status code (4xx = warn, 5xx = error)
- User ID stored in Gin context for downstream handlers

**Issues:**

> **[HIGH]** No rate limiting — OpenAPI spec references rate limits (spec lines 15-19) but no implementation exists anywhere.

> **[MEDIUM]** Request ID is logged but not propagated into structured log fields. Downstream service logs cannot be correlated with request logs.

> **[LOW]** JWT context key is a raw string literal (`auth/handler.go:289`):
```go
c.Get("userID")  // should be a typed const
```
A typo in any call site silently returns `nil`. Define:
```go
const contextKeyUserID = "userID"
```

---

### 8. Code Style & Naming

**Rating: 8/10**

**Good:**
- Consistent CamelCase/camelCase naming throughout
- Self-documenting function names (`ValidateRefreshToken`, `RevokeAllUserTokens`, `SetEmailVerified`)
- Short, meaningful package names with no redundant prefixes

**Issues:**

> **[LOW]** Magic numbers without explanation:
- `auth/service.go:22-26` — token expiry durations (24h, 1h, 5m) with no comment on why
- `platform/database/postgres.go:22-26` — pool sizes (25, 5) with no rationale
- `internal/auth/service.go` — bcrypt cost 12 with no comment

> **[LOW]** Exported functions and types lack godoc comments (`auth/jwt.go`, `mail/provider.go`).

---

### 9. Security

**Rating: 7/10**

**Good:**
- bcrypt with cost 12 for password hashing ✓
- SHA-256 token hashing before DB storage ✓
- Refresh token rotation on every use ✓
- All tokens revoked on password change ✓
- No email enumeration on forgot-password ✓
- Parameterized queries throughout (no SQL injection) ✓

**Issues:**

> **[CRITICAL]** CORS wildcard for `*.web.app` — see §4 above.

> **[MEDIUM]** No JWT secret length validation — see §5 above.

> **[LOW]** `auth/handler.go:194` — intentional `errcheck` suppression on logout:
```go
_ = h.service.Logout(c.Request.Context(), req.RefreshToken) //nolint:errcheck
```
This is a reasonable design decision (idempotent logout), but the intent should be documented with a comment, not just a nolint directive.

---

### 10. OpenAPI Spec Quality

**Rating: 6/10**

**Good:**
- Comprehensive: 2563 lines, 29 endpoints, 50+ schemas
- Proper error responses with RFC 7807 format
- Parameter validation (min/max lengths, formats) defined
- Lithuania phone number example (`+37061234567`) is realistic
- `expires_in: 1800` matches the 30-minute access token lifetime in code

**Issues:**

> **[CRITICAL]** Spec-implementation mismatch — 25+ endpoints defined with no Go implementation (see §1).

> **[HIGH]** Security scheme name inconsistency — `bearerAuth` (lowercase) used at line 339 but `BearerAuth` (PascalCase) defined in components at line 1349. These must match exactly.

> **[MEDIUM]** `/api/v1/flags` endpoint is implemented in code (`main.go:94`) but not documented in the spec.

> **[LOW]** No rate limit response headers documented despite spec mentioning rate limiting.

---

### 11. Logging & Observability

**Rating: 6/10**

**Good:**
- Structured logging via `slog` (standard library, Cloud Logging compatible)
- JSON format in production, text in development
- Request ID, method, path, status, latency, client IP all logged per-request

**Issues:**

> **[HIGH]** `LOG_LEVEL` not respected — see §5.

> **[MEDIUM]** No distributed tracing — no trace ID propagation across service calls.

> **[MEDIUM]** No metrics — no Prometheus counters/histograms for request rates, latencies, or error rates.

> **[LOW]** Inconsistent error logging across handlers — some log failures, `Login` does not.

---

### 12. Testing

**Rating: 0/10**

> **[CRITICAL]** Zero test files exist in the entire `api/` directory.

Critical untested paths:
- Auth service (register, login, token refresh, password reset)
- JWT generation and validation (expiry, invalid signatures, claims)
- Repository operations (CRUD, duplicate email, token lookup)
- Email template generation
- Configuration validation
- Middleware (auth header parsing, expired vs invalid token distinction)

Minimum recommended test files:
```
api/internal/auth/service_test.go
api/internal/auth/jwt_test.go
api/internal/domain/identity/repository_test.go
api/internal/platform/config/config_test.go
api/cmd/server/main_test.go  (integration)
```

---

### 13. Dependencies & Build

**Rating: 7/10**

**Good:**
- All major dependencies are appropriate and current
- `make test` includes `-race` flag
- `make lint`, `make security`, `make ci` targets present

**Issues:**

> **[HIGH]** `make generate` target exists but generated output (`internal/api/types.gen.go`) is absent and not committed. CI cannot catch implementation drift from spec.

> **[MEDIUM]** No `make format` target for `gofmt`/`goimports` enforcement.

> **[LOW]** No Docker build target in Makefile despite Dockerfile existing.

---

## React Web Review

### 1. Project Structure & Organization

**Rating: 8/10**

**Good:**
- Clean npm workspaces monorepo: `consumer`, `biz`, `shared`
- TypeScript project references enable incremental builds
- Shared package exports via explicit `package.json` entry points
- Clear separation: UI components, hooks, stores, API client

**Issues:**

> **[MEDIUM]** `consumer/vite.config.ts` and `biz/vite.config.ts` are identical — a DRY violation. Any Vite change must be applied twice.

**Fix:** Extract a shared factory:
```typescript
// web/vite.config.shared.ts
export function createViteConfig(dirname: string) {
  return defineConfig({
    plugins: [react(), tailwindcss()],
    envDir: path.resolve(dirname, '../..'),
    resolve: {
      alias: {
        '@': path.resolve(dirname, './src'),
        '@bookit/shared': path.resolve(dirname, '../shared/src'),
      },
    },
  })
}
```

> **[LOW]** `shared/tsconfig.json` targets `ES2020` while consumer/biz target `ES2023`. The difference should be documented.

---

### 2. Component Design & Composition

**Rating: 7/10**

**Good:**
- Functional components with proper TypeScript throughout
- Good compositional structure: `Card` → `CardHeader` / `CardTitle` / `CardFooter`
- UI components properly extend primitive types (`ButtonPrimitive.Props`, `React.ComponentProps`)
- Reusable components exported from shared package

**Issues:**

> **[HIGH]** Inconsistent form handling — `consumer` uses `react-hook-form` + Zod, `biz` uses manual `useState`:

`biz/src/pages/Login.tsx`:
```typescript
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [error, setError] = useState<string | null>(null)
const [isSubmitting, setIsSubmitting] = useState(false)
```

`consumer/src/pages/Login.tsx`:
```typescript
const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
  resolver: zodResolver(loginSchema),
})
```

Both approaches do the same thing. Standardize on `react-hook-form` + Zod across all packages.

> **[MEDIUM]** `consumer/src/components/auth/RequireAuth.tsx` — only checks `isAuthenticated` boolean, not whether `user` object exists. A race condition where `isAuthenticated=true` but `user=null` would render a broken page:

```typescript
// Current
if (!isAuthenticated) return <Navigate to="/" ... />

// Safer
if (!isAuthenticated || !user) return <Navigate to="/" ... />
```

---

### 3. TypeScript Usage & Type Safety

**Rating: 6/10**

**Good:**
- `strict: true` enabled in all tsconfig files
- `noUnusedLocals`, `noUnusedParameters` enabled
- Generated OpenAPI types used for API schema
- Zod schemas for form validation

**Issues:**

> **[CRITICAL]** Type assertions used instead of proper generic inference in every form submission:

`consumer/src/pages/Login.tsx:44`, `Register.tsx:46`, `ForgotPassword.tsx:35`, `biz/src/pages/Login.tsx:35`:
```typescript
const authResult = result as AuthResponse          // bypasses type checker
const err = apiError as { detail?: string; ... }  // unverified assumption
```

`openapi-fetch` returns typed data when the client is properly configured. These assertions indicate the client isn't fully typed. Fix by ensuring the `paths` generic is correctly applied to `createClient<paths>()` and using the `data` / `error` destructuring directly.

> **[HIGH]** API error shape cast as `{ detail?: string; title?: string }` in multiple pages. Extract to a shared type and a utility function:

```typescript
// shared/src/api/errors.ts
export type ApiError = { type?: string; title?: string; detail?: string; status?: number }

export function parseApiError(err: unknown): ApiError {
  if (err && typeof err === 'object') return err as ApiError
  return { title: 'Unknown error' }
}
```

> **[MEDIUM]** `consumer/src/pages/DevStatus.tsx:10-15` — `HealthResponse` type defined locally instead of imported from generated types. Duplicates backend knowledge with no guarantee of accuracy.

---

### 4. State Management

**Rating: 7/10**

**Good:**
- Zustand with `persist` + `partialize` — only necessary state is stored
- Auth store methods are well-named and focused
- Token refresh strategy with 30-second pre-expiry buffer is correct

**Issues:**

> **[HIGH]** `shared/src/api/client.ts:44-75` — token refresh has two separate triggers (pre-request check + 401 response). The `isRefreshing` module-level flag does not prevent a double-refresh when both conditions fire simultaneously on concurrent requests:

```typescript
// Current — fragile
let isRefreshing = false

// Robust fix — use a shared Promise
let refreshPromise: Promise<boolean> | null = null

async function ensureValidToken(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = refreshTokens().finally(() => { refreshPromise = null })
  }
  await refreshPromise
}
```

> **[MEDIUM]** `shared/src/stores/auth.ts` — rehydrated localStorage state is not validated. Corrupted or tampered data is loaded as-is. Add Zod validation on rehydration via the `onRehydrateStorage` option.

> **[MEDIUM]** `useFeatureFlag` hook has a stale-closure / unmount bug — no cleanup in `useEffect`. If the component unmounts before `initFeatureFlags()` resolves, `setState` is called on an unmounted component:

```typescript
useEffect(() => {
  let active = true
  initFeatureFlags().then(() => {
    if (active) {
      setEnabled(isFeatureEnabled(flagName))
      setLoading(false)
    }
  })
  return () => { active = false }
}, [flagName])
```

---

### 5. API Client Setup & Usage

**Rating: 8/10**

**Good:**
- `openapi-fetch` is the correct choice (type-safe, no axios)
- Middleware pattern for auth interceptor is clean
- `credentials: 'include'` set for cookie support
- Single client instance exported from shared package

**Issues:**

> **[MEDIUM]** `API_URL` defined in two places — `shared/src/api/client.ts` AND `consumer/src/pages/DevStatus.tsx`. Export and reuse:

```typescript
// shared/src/api/client.ts — already defined here
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
```

> **[MEDIUM]** `shared/src/api/client.ts:28` — refresh response parsed without validation:
```typescript
const data = await response.json()
useAuthStore.getState().setAuth(data.user, data.tokens) // assumed shape
```
Validate with Zod before calling `setAuth`.

> **[LOW]** `shared/src/hooks/useAppSwitch.ts` — app-switch token failure falls back silently with only a `console.warn`. No distinction between network error, auth failure, or server error.

---

### 6. Routing

**Rating: 6/10**

**Good:**
- React Router v7 used correctly
- `RequireAuth` wrapper component for protected routes
- Clean page-level route definitions

**Issues:**

> **[MEDIUM]** No 404 catch-all route in either app:

```typescript
// Add as last route in both App.tsx files
<Route path="*" element={<NotFound />} />
```

> **[LOW]** `consumer/src/pages/ResetPassword.tsx` — shows an error if the URL token param is missing, but doesn't pre-validate token with the backend before rendering the form. Users with expired links see the form, submit it, then get an error.

---

### 7. Code Style & Naming

**Rating: 7/10**

**Good:**
- PascalCase for components, camelCase for hooks/utilities — consistent
- Descriptive component names (`RequireAuth`, `DevStatus`)
- Consistent import ordering

**Issues:**

> **[MEDIUM]** Mixed styling approaches — `Landing.tsx` and `DevStatus.tsx` import CSS files while all other components use Tailwind classes inline. Decide on one approach and document it.

> **[MEDIUM]** Feature flag names are magic strings prone to typos:
```typescript
useFeatureFlag('feature_test')  // in DevStatus.tsx
feature_test: false             // in firebase.ts
```

Extract to constants:
```typescript
// shared/src/constants/featureFlags.ts
export const FLAGS = {
  TEST: 'feature_test',
} as const
```

> **[LOW]** `consumer/index.html` title is `"web"` — should be the product name. `biz/index.html` correctly says `"Bookit Business"`.

---

### 8. Imports & Exports

**Rating: 7/10**

**Good:**
- Barrel exports in `shared/src/index.ts` for UI components
- Path aliases configured consistently in both tsconfig and vite.config
- Named exports used throughout (no ambiguous default exports)

**Issues:**

> **[MEDIUM]** Dual export system in shared package — consumers use both `import { Button } from '@bookit/shared'` (barrel) and `import { useAuthStore } from '@bookit/shared/stores'` (path import). This inconsistency is undocumented and confusing.

Document the convention or consolidate: re-export hooks and stores from the main `index.ts`.

---

### 9. Build Configuration

**Rating: 7/10**

**Good:**
- Vite 8 with React plugin and Tailwind CSS plugin
- TypeScript incremental builds via project references
- Environment directory points to web root correctly

**Issues:**

> **[MEDIUM]** Vite config duplicated — see §1.

> **[LOW]** No chunk splitting configured for production builds. Vendor dependencies (React, TanStack Query) are not split into separate chunks, increasing initial load time:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'query-vendor': ['@tanstack/react-query'],
      },
    },
  },
},
```

---

### 10. Package.json Dependencies & Workspace

**Rating: 7/10**

**Good:**
- Modern versions: React 19.2, React Router 7.14, TypeScript 5.9, Vite 8
- No unnecessary dependencies
- `@types/*` packages present for all major deps

**Issues:**

> **[MEDIUM]** `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query` declared identically in both consumer and biz `package.json`. These should be hoisted to the workspace root to guarantee a single version.

> **[LOW]** No `engines` field specifying minimum Node.js version, and no `packageManager` field to enforce which package manager is used. Developers could use different package managers and produce different lockfiles.

> **[CRITICAL]** Zero test libraries anywhere in the project. No `vitest`, no `@testing-library/react`, no `@testing-library/jest-dom`.

---

## Cross-Cutting Summary

| Severity | Issue | Location |
|---|---|---|
| **Critical** | Zero tests (Go) | `api/**` |
| **Critical** | Zero tests (React) | `web/**` |
| **Critical** | 25+ OpenAPI endpoints with no Go implementation | `api/internal/api/` |
| **Critical** | CORS allows any `*.web.app` project | `api/cmd/server/main.go:198` |
| **Critical** | Type assertions bypass type checking | `web/packages/consumer/src/pages/*.tsx` |
| **High** | `LOG_LEVEL` config loaded but never used | `api/internal/platform/logger/logger.go:27` |
| **High** | DB error detection via string matching | `api/internal/domain/identity/repository.go:113` |
| **High** | Token refresh race condition | `web/packages/shared/src/api/client.ts:44-75` |
| **High** | Inconsistent form handling (consumer vs biz) | `web/packages/biz/src/pages/Login.tsx` |
| **High** | Vite config duplicated | `web/packages/{consumer,biz}/vite.config.ts` |
| **High** | No rate limiting despite spec reference | `api/` |
| **Medium** | No health check timeout | `api/cmd/server/main.go:237` |
| **Medium** | JWT context key is a raw string | `api/internal/auth/handler.go:289` |
| **Medium** | `RequireAuth` doesn't check `user` existence | `web/packages/consumer/src/components/auth/RequireAuth.tsx` |
| **Medium** | No 404 catch-all route | `web/packages/{consumer,biz}/src/App.tsx` |
| **Medium** | `useFeatureFlag` unmount bug | `web/packages/shared/src/hooks/useFeatureFlag.ts` |
| **Medium** | Auth store rehydration not validated | `web/packages/shared/src/stores/auth.ts` |
| **Medium** | `API_URL` defined in two places | `web/packages/shared/src/api/client.ts` + `DevStatus.tsx` |
| **Low** | No JWT secret length validation | `api/internal/platform/config/config.go` |
| **Low** | Magic numbers without comments | `api/internal/auth/service.go`, `database/postgres.go` |
| **Low** | Feature flag names are magic strings | `web/packages/consumer/src/pages/DevStatus.tsx` |
| **Low** | Consumer app HTML title is `"web"` | `web/packages/consumer/index.html` |
| **Low** | Mixed CSS approaches (files vs Tailwind) | `web/packages/consumer/src/pages/` |
| **Low** | No chunk splitting for production | `web/packages/{consumer,biz}/vite.config.ts` |

---

## Positive Highlights

Despite the issues above, the codebase demonstrates several production-ready patterns worth preserving:

**Go API:**
- `fmt.Errorf("...: %w", err)` used consistently for error wrapping
- `context.WithoutCancel()` for background email sending — correct and intentional
- Parameterized SQL queries throughout — no injection risk
- SHA-256 token hashing before DB storage
- Refresh token rotation on every use
- All tokens revoked on password change
- bcrypt with cost 12
- No email enumeration on forgot-password

**React Web:**
- `openapi-fetch` with generated types — type-safe API calls
- Zustand with `partialize` — clean, minimal persistence
- 30-second token pre-expiry buffer — sensible UX choice
- `credentials: 'include'` for proper httpOnly cookie support
- TypeScript strict mode enforced across all packages
- Clean monorepo with explicit package boundaries

---

## Priority Action Plan

### This Week (Blockers)

1. **Fix CORS** — whitelist specific domains instead of `*.web.app`
2. **Generate OpenAPI types** — run `cd api && make generate` and commit `internal/api/types.gen.go`, or remove unimplemented endpoints from the spec
3. **Fix `LOG_LEVEL`** — thread `cfg.LogLevel` through to the logger handler options
4. **Fix token refresh race** — replace `isRefreshing` flag with a shared `Promise`

### Before Next Feature (Quality Gate)

5. **Add Go tests** — minimum: `auth/service_test.go`, `auth/jwt_test.go`, `domain/identity/repository_test.go`
6. **Add React tests** — install `vitest` + `@testing-library/react`, test auth flow and protected routes
7. **Fix type assertions** — ensure `openapi-fetch` client is typed with `paths` generic; remove all `as` casts
8. **Standardize form handling** — migrate `biz` forms to `react-hook-form` + Zod
9. **Fix DB error detection** — use `pgconn.PgError.Code` instead of string matching

### Before Production

10. **Add rate limiting middleware** to the Gin router
11. **Add health check timeout** — wrap DB ping in `context.WithTimeout`
12. **Validate JWT secret length** at startup
13. **Add error tracking** (Sentry or equivalent) to both frontend apps
14. **Validate auth store rehydration** with Zod
15. **DRY the Vite config** — extract shared factory function
16. **Add 404 routes** to both React apps
17. **Extract `API_URL`** to shared export; remove duplicate in `DevStatus.tsx`
18. **Add feature flag constants** to replace magic strings
19. **Add chunk splitting** to Vite build config
20. **Fix consumer `index.html` title** from `"web"` to product name
