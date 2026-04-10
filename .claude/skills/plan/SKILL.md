---
name: plan
description: Plan a new feature or task for the Bookit project. Creates an implementation plan with phases, feature flags, and ownership tracking.
---

# Plan: Feature / Task Preparation

You are helping prepare an implementation plan for the Bookit project. Follow the project's plan workflow exactly.

## Your job

### Step 0 — Identify yourself

Run `git config user.email` and store the result as `CURRENT_AUTHOR`. This is used for
ownership checks throughout the workflow.

### Step 1 — Check for duplicates

Before asking any questions or writing anything, search **all** plan folders for an existing plan
covering the same feature:

```bash
grep -rl "<feature keyword>" docs/implementation-plans/
```

Check: `new/`, `ready-for-dev/`, `in-progress/`, `done/`, `canceled/`.

- If a matching plan exists in **any** status → stop and tell the user:
  > "A plan for this feature already exists: `<path>` (status: `<status>`, author: `<author>`).
  > Open it with `/open-plan` or discuss before creating a new one."
  Do not proceed until the user explicitly confirms they want a separate plan.

- If a matching plan exists in **`done/`** → it was already shipped. Confirm with the user
  whether this is an extension/follow-up or a duplicate.

### Step 2 — Ownership check (in-progress plans only)

If asked to work on, update, or continue an **in-progress** plan:

1. Read the plan's `author` frontmatter field.
2. Compare to `CURRENT_AUTHOR` (git email).
3. If they **do not match** → stop and say:
   > "This plan is owned by `<author>`. Only the plan author can move it forward.
   > If you need to take over, the author must update the `author` field to your email first."
   Do not modify the plan or proceed with implementation.

### Step 3 — Understand the feature

Ask clarifying questions until you have enough to write a solid plan. Cover: what problem it
solves, which domain it touches (Identity / Catalog / Scheduling / Booking / Payment /
Notification), which app(s) are affected (consumer, biz, api), and any dependencies or constraints.

### Step 4 — Read relevant context

- `docs/BACKEND-SPEC-Bookit-20260331.md` — for API/backend work
- `docs/FRONTEND-SPEC-Bookit-20260331.md` — for frontend work
- `api/openapi/spec.yaml` — for endpoint contracts
- Any existing in-progress plans in `docs/implementation-plans/in-progress/`

### Step 5 — Draft the plan

Use `docs/implementation-plans/TEMPLATE.md` as the base structure:
- Set `author` in frontmatter to `CURRENT_AUTHOR` (the git email from Step 0)
- Break work into discrete, committable phases
- Each phase should be independently testable
- Note dependencies between phases explicitly
- For backend phases: list affected endpoints, business rules, DB queries
- For frontend phases: list components, routes, state changes
- **Phase 1 is always the feature flag** (see below)

### Step 6 — Save and track

- Save to `docs/implementation-plans/new/<kebab-case-title>.md`
- Move to `in-progress/` when development starts (only the author may do this)
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

3. Note the flag key (`my_feature`) in your PR description — the project owner will activate it in Firebase Remote Config. You don't need Firebase access.

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

3. Note the flag key (`my_feature`) in your PR description — the project owner will activate it in Firebase Remote Config. You don't need Firebase access.

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
