---
title: "Frontend Foundation"
status: IN_PROGRESS
created: 2026-04-01
author: "Claude"
---

# Plan: Frontend Foundation

## Summary

Set up minimal React frontend with Vite + TypeScript in `web/` folder. The app will display a health check indicator showing API connection status. Deploy to Firebase Hosting.

**Goal:** Minimal React app that verifies API connectivity via health check endpoint.

---

## Phases

### Phase 1: Initialize Vite + React + TypeScript `[IN_PROGRESS]`

Create React project in `web/` directory using Vite with TypeScript template.

```bash
cd /Users/brohalskyi/bookit/bookit
npm create vite@latest web -- --template react-ts
cd web
npm install
```

**Files created:**
- `web/` — Full Vite + React + TypeScript project structure

---

### Phase 2: Create Health Check Component `[PENDING]`

Replace default App.tsx with a simple component that:
1. Fetches `GET /api/v1/health` on mount
2. Displays connection status (Connected/Disconnected)
3. Shows API response data when connected

**Files to modify:**
- `web/src/App.tsx` — Health check component
- `web/src/App.css` — Minimal status indicator styling (green/red)

**Environment:**
- Create `web/.env.example` with `VITE_API_URL=http://localhost:8080`
- Create `web/.env` with same default

---

### Phase 3: Add CORS Support to Backend `[PENDING]`

Backend needs to allow requests from frontend origins. Add CORS middleware to Go API.

**Allowed origins:**
- `http://localhost:5173` (Vite dev server)
- `https://bookit-*.web.app` (Firebase Hosting)

**Files to modify:**
- `api/cmd/server/main.go` — Add CORS middleware

---

### Phase 4: Firebase Hosting Setup `[PENDING]`

Initialize Firebase Hosting for the web app.

```bash
cd web
firebase login
firebase init hosting
```

**Configuration:**
- Public directory: `dist`
- Single-page app: Yes
- Automatic builds: No (manual for now)

**Files created:**
- `web/firebase.json` — Hosting configuration
- `web/.firebaserc` — Project link

**Deploy:**
```bash
npm run build
firebase deploy
```

---

## Verification

1. **Local dev:** `cd web && npm run dev` — opens on http://localhost:5173
2. **With local API:** Start `docker-compose up`, check "Connected" status
3. **With prod API:** Set `VITE_API_URL` to Cloud Run URL, verify connection
4. **Production build:** `npm run build` succeeds
5. **Firebase deploy:** `firebase deploy` completes, app accessible at Firebase URL

---

## API URLs

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:8080` |
| Production | `https://bookit-api-prod-898535472060.europe-west3.run.app` |

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
