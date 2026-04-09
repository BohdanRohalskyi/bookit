# Plan: Feature / Task Preparation

You are helping prepare an implementation plan for the Bookit project. Follow the project's plan workflow exactly.

## Your job

1. **Understand the feature** — Ask clarifying questions until you have enough to write a solid plan. Cover: what problem it solves, which domain it touches (Identity / Catalog / Scheduling / Booking / Payment / Notification), which app(s) are affected (consumer, biz, api), and any dependencies or constraints.

2. **Read relevant context** before drafting:
   - `docs/BACKEND-SPEC-Bookit-20260331.md` — for API/backend work
   - `docs/FRONTEND-SPEC-Bookit-20260331.md` — for frontend work
   - `api/openapi/spec.yaml` — for endpoint contracts
   - Any existing in-progress plans in `docs/implementation-plans/in-progress/`

3. **Determine the feature flag type** (see section below) and include a dedicated flag phase in the plan.

4. **Draft the plan** using `docs/implementation-plans/TEMPLATE.md` as the base structure:
   - Break work into discrete, committable phases
   - Each phase should be independently testable
   - Note dependencies between phases explicitly
   - For backend phases: list affected endpoints, business rules, DB queries
   - For frontend phases: list components, routes, state changes
   - **Phase 1 is always the feature flag** (see below)

5. **Save the plan** to `docs/implementation-plans/new/<kebab-case-title>.md`

6. **Update the plan status** as work progresses:
   - Move file to `in-progress/` when development starts
   - Update phase status to `[IN_PROGRESS]` → `[DONE]` (with commit hash) as each phase completes
   - Move to `done/` when all phases complete

---

## Feature Flag Rules

Every new user-facing feature ships behind a feature flag. **Phase 1 of every plan must be the flag setup.**

### Which flag type to use

| Feature scope | Flag type | Where defined |
|---------------|-----------|---------------|
| Frontend only | **Client flag** (Firebase Remote Config) | Firebase Console |
| Backend only | **Server flag** (Firebase Remote Config via Admin SDK) | Firebase Console |
| Backend + frontend | **Both** — same flag key, checked on both sides | Firebase Console |

### Client flag (frontend only)

1. Add the constant to `web/packages/shared/src/features/flags.ts`:
   ```ts
   export const FLAGS = {
     FEATURE_TEST: 'feature_test', // existing
     MY_FEATURE: 'my_feature',     // ← add like this: UPPER_SNAKE_CASE key, snake_case string value
   } as const
   ```

2. Gate the UI with the hook — always use the constant, never a raw string:
   ```tsx
   import { useFeatureFlag } from '@bookit/shared'
   import { FLAGS } from '@bookit/shared/features'

   const isEnabled = useFeatureFlag(FLAGS.MY_FEATURE)
   if (!isEnabled) return null
   ```

3. Enable in Firebase Console → Remote Config → add key `my_feature` = `true`.

### Server flag (backend only or backend + frontend)

1. Add the same constant to `flags.ts` (for frontend gating, if applicable — use same string key on both sides).

2. In the Go handler or service, check via the flag service (see `internal/flags/` if it exists,
   or the feature-flags implementation plan):
   ```go
   if !h.flags.IsEnabled(ctx, "my_feature") {
       c.JSON(http.StatusNotFound, ...)
       return
   }
   ```

3. Enable in Firebase Console → Remote Config → add key `my_feature` = `true`.

### Flag naming convention

- Constant name: `UPPER_SNAKE_CASE` (e.g. `BOOKING_INSTANT_CONFIRM`)
- String value: `snake_case`, domain-prefixed (e.g. `booking_instant_confirm`)
- The string value is what Firebase Remote Config and the backend use as the key

---

## Phase status rules

| Status | When to use |
|--------|-------------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed — add `> Commit: <hash> (<date>)` below |
| `[CHANGED]` | Implemented differently — document what/why |
| `[REJECTED]` | Skipped — document reason |

---

## Arguments

$ARGUMENTS
