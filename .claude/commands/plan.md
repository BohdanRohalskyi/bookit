# Plan: Feature / Task Preparation

You are helping prepare an implementation plan for the Bookit project. Follow the project's plan workflow exactly.

## Your job

1. **Understand the feature** — Ask clarifying questions until you have enough to write a solid plan. Cover: what problem it solves, which domain it touches (Identity / Catalog / Scheduling / Booking / Payment / Notification), which app(s) are affected (consumer, biz, api), and any dependencies or constraints.

2. **Read relevant context** before drafting:
   - `docs/BACKEND-SPEC-Bookit-20260331.md` — for API/backend work
   - `docs/FRONTEND-SPEC-Bookit-20260331.md` — for frontend work
   - `api/openapi/spec.yaml` — for endpoint contracts
   - Any existing in-progress plans in `docs/implementation-plans/in-progress/`

3. **Draft the plan** using `docs/implementation-plans/TEMPLATE.md` as the base structure:
   - Break work into discrete, committable phases
   - Each phase should be independently testable
   - Note dependencies between phases explicitly
   - For backend phases: list affected endpoints, business rules, DB queries
   - For frontend phases: list components, routes, state changes

4. **Save the plan** to `docs/implementation-plans/new/<kebab-case-title>.md`

5. **Update the plan status** as work progresses:
   - Move file to `in-progress/` when development starts
   - Update phase status to `[IN_PROGRESS]` → `[DONE]` (with commit hash) as each phase completes
   - Move to `done/` when all phases complete

## Phase status rules

| Status | When to use |
|--------|-------------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed — add `> Commit: <hash> (<date>)` below |
| `[CHANGED]` | Implemented differently — document what/why |
| `[REJECTED]` | Skipped — document reason |

## Arguments

$ARGUMENTS
