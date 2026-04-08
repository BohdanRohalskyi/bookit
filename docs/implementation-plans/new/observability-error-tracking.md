---
title: "Observability & Error Tracking"
status: NEW
created: 2026-04-08
author: "Bohdan Rohalskyi"
---

# Plan: Observability & Error Tracking

## Summary

The platform currently uses `console.warn` as a placeholder in a handful of
critical spots (auth store rehydration failure, failed app-switch tokens, etc.).
This plan establishes a proper observability layer — error tracking in the
frontend and structured alerting hooks in the backend — so production issues
surface proactively rather than via user reports.

**Goal:** Replace all `console.warn` / `console.error` placeholders with a
real error tracking service and ensure both the API and frontend emit
structured, actionable signals for production incidents.

---

## Phases

### Phase 1: Choose and integrate an error tracking service `[PENDING]`

Evaluate and integrate one of:
- **Sentry** — most mature, free tier covers MVP volume, excellent React and Go SDKs
- **Highlight.io** — session replay + errors, good privacy story for EU
- **Datadog** — already used at many GCP shops, integrates with Cloud Run logs

Decision criteria: GDPR compliance (Lithuania / EU), free-tier limits, SDK quality
for both Go and React, and effort to set up.

Once chosen:
- Add the SDK to `web/packages/shared` (frontend) and `api/` (backend)
- Store the DSN/API key in Secret Manager for staging and prod
- Gate initialisation on `ENVIRONMENT !== 'local'` so local dev stays clean

---

### Phase 2: Frontend — replace console.warn placeholders `[PENDING]`

Locations that currently use `console.warn` and need proper capture:

| File | Event | Priority |
|------|-------|----------|
| `shared/src/stores/auth.ts` | Auth store rehydration validation failed | High |
| `shared/src/hooks/useAppSwitch.ts` | App-switch token creation/exchange failed | Medium |
| `shared/src/api/client.ts` | Token refresh failed (user force-logged out) | High |

For each location, replace `console.warn(...)` with:
```typescript
captureException(error, {
  tags: { area: 'auth' },
  extra: { details },
})
```

Also add a top-level `ErrorBoundary` in both consumer and biz that captures
unhandled React errors before showing a fallback UI.

---

### Phase 3: Backend — structured error alerting `[PENDING]`

The Go API already logs all 5xx errors via `slog`. Wire those logs into
Cloud Monitoring alerts:

- Create a **log-based metric** in GCP for `severity=ERROR` entries in
  Cloud Run logs
- Create a **Cloud Monitoring alert policy** that pages (email / PagerDuty)
  when the error rate exceeds threshold (e.g. >5 errors/min sustained for 2min)
- Add `error_budget` label to structured log entries so alerts can distinguish
  between auth errors, DB errors, and business logic errors

No code changes required in the Go API itself — existing `slog.Error(...)` calls
are sufficient; this is pure GCP configuration.

---

### Phase 4: Local development — keep noise-free `[PENDING]`

Ensure the error tracking service does not fire during local development:

- Frontend: initialise only when `import.meta.env.PROD === true`
- Backend: gate on `ENVIRONMENT !== 'local'`
- Add `SENTRY_DSN` (or equivalent) to `.env.example` with a comment explaining
  it is optional for local dev

---

### Phase 5: Verify and document `[PENDING]`

- Trigger a test error in staging and confirm it appears in the tracking dashboard
- Add a `## Observability` section to `README.md` documenting:
  - Which service is used and where the dashboard is
  - How to access staging vs production projects
  - On-call escalation path (when alerts fire, who gets paged)

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
