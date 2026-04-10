---
title: "Landing Page"
status: IN_PROGRESS
created: 2026-04-07
author: "bohdan.rohalskyi@paysera.com"
---

# Plan: Landing Page

## Summary

Public landing page for Bookit — the first thing users see. Phase 1 delivers a minimal placeholder; Phase 2 implements the final design.

**Goal:** Marketing landing page with CTA buttons leading to register/login.

---

## Phases

### Phase 1: Simple Landing Page `[DONE]`

Minimal placeholder page with:
- Bookit logo/title
- One-liner tagline ("Book beauty, sport & pet care services")
- Two CTA buttons: "Get Started" → `/register`, "Login" → `/login`
- Simple footer with copyright

**Tech:**
- React components with CSS (using existing CSS variables)
- React Router v7 for navigation

**Files created:**
- `web/src/pages/Landing.tsx` + `Landing.css`
- `web/src/pages/Login.tsx` + `AuthPage.css`
- `web/src/pages/Register.tsx`
- `web/src/pages/DevStatus.tsx` + `DevStatus.css` (moved health check here)
- `web/src/App.tsx` — router setup

**Routes:**
- `/` — Landing page
- `/login` — Login placeholder
- `/register` — Register placeholder
- `/dev` — Dev status/health check

> Commit: 855e389 (2026-04-07)

---

### Phase 2: Design Implementation `[PENDING]`

Implement final design provided by user.

**Blocked on:** Design from user

**Expected sections:**
- Hero with value proposition
- Features/benefits grid
- How it works (3 steps)
- Testimonials (optional)
- CTA section
- Footer with links

---

## Dependencies

- [ ] Design for Phase 2 (user will provide)

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
