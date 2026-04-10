---
title: "[Plan Title]"
status: NEW
created: YYYY-MM-DD
author: "author@email.com"
---

# Plan: [Plan Title]

## Summary

<!-- 2-3 sentences describing what this plan implements -->

**Goal:** <!-- One-line goal statement -->

---

## Phases

### Phase 1: Feature flag — `[FLAG_KEY]` `[PENDING]`

<!-- Add the flag constant to web/packages/shared/src/features/flags.ts.
     Gate frontend with useFeatureFlag(FLAGS.FLAG_KEY) and/or backend with h.flags.IsEnabled(ctx, "flag_key").
     Note the flag key in your PR description — the project owner activates it in Firebase Remote Config. -->

---

### Phase 2: [Phase Title] `[PENDING]`

<!-- Description of work to be done -->

---

<!-- Add more phases as needed -->

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |

### When a phase is DONE:

```markdown
### Phase 1: [Phase Title] `[DONE]`

<!-- Original description -->

> Commit: abc1234 (2026-03-31)
```

### When a phase is CHANGED:

```markdown
### Phase 1: [Phase Title] `[CHANGED]`

**Original plan:**
<!-- What was originally planned -->

**What changed:**
<!-- What was actually implemented -->

**Why:**
<!-- Reason for the change -->

> Commit: abc1234 (2026-03-31)
```

### When a phase is REJECTED:

```markdown
### Phase 1: [Phase Title] `[REJECTED]`

<!-- Original description -->

**Reason:** <!-- Why this phase was not implemented -->
```
