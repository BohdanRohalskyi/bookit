---
title: "Frontend Foundation"
status: DONE
created: 2026-04-01
completed: 2026-04-02
author: "Claude"
---

# Plan: Frontend Foundation

## Summary

Set up minimal React frontend with Vite + TypeScript in `web/` folder. The app displays a health check indicator showing API connection status. Deployed to Firebase Hosting.

**Goal:** Minimal React app that verifies API connectivity via health check endpoint.

**Result:** https://pt-duo-bookit.web.app - Connected to production API.

---

## Phases

### Phase 1: Initialize Vite + React + TypeScript `[DONE]`

Created React project in `web/` directory using Vite with TypeScript template.

> Commit: d0744aa (2026-04-02)

---

### Phase 2: Create Health Check Component `[DONE]`

Replaced default App.tsx with health check component:
- Fetches `GET /api/v1/health` on mount
- Displays connection status (Connected/Disconnected)
- Shows API response data (status, version, database)
- Refresh button for manual check

**Files:**
- `web/src/App.tsx` — Health check component
- `web/src/App.css` — Status indicator styling
- `web/src/vite-env.d.ts` — TypeScript environment types
- `web/.env.example` — Environment template

> Commit: d0744aa (2026-04-02)

---

### Phase 3: Add CORS Support to Backend `[DONE]`

Added CORS middleware to Go API allowing:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000`
- `*.web.app` (Firebase Hosting)
- `*.firebaseapp.com`

**Files:**
- `api/cmd/server/main.go` — CORS middleware

> Commit: d0744aa (2026-04-02)

---

### Phase 4: Firebase Hosting + CI/CD `[CHANGED]`

**Original plan:**
Manual Firebase deploy with `firebase deploy`

**What changed:**
Added GitHub Actions workflow for automated deployment.

**Why:**
User requested environment variables (VITE_API_URL) to be stored in GitHub Secrets rather than source code.

**Files:**
- `web/firebase.json` — Hosting configuration
- `web/.firebaserc` — Project link
- `.github/workflows/web.yml` — CI/CD workflow

**Secrets configured:**
- `VITE_API_URL` — Production API URL
- `FIREBASE_SERVICE_ACCOUNT` — Firebase deploy credentials

> Commit: a108fdc (2026-04-02)

---

## Verification

All verified:
1. Local dev: `cd web && npm run dev` — works on http://localhost:5173
2. Production: https://pt-duo-bookit.web.app — shows "Connected"
3. CI/CD: Push to main triggers build and deploy

---

## URLs

| Environment | URL |
|-------------|-----|
| Frontend (prod) | https://pt-duo-bookit.web.app |
| API (prod) | https://bookit-api-prod-898535472060.europe-west3.run.app |
| Local frontend | http://localhost:5173 |
| Local API | http://localhost:8080 |
