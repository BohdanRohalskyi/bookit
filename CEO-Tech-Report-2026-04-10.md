# Bookit — Technology & Architecture Report

**Prepared for:** CEO  
**Date:** April 10, 2026  
**MVP Target:** June 30, 2026  

---

## 1. What We Are Building

Bookit is a multi-vertical booking platform for beauty, sport, and pet care service
providers, targeting the Lithuanian market. It consists of two user-facing
applications backed by a single API:

| App | Who uses it | URL (production) |
|-----|-------------|-----------------|
| **Consumer app** | Clients making bookings | pt-duo-bookit.web.app |
| **Business app** | Providers managing their services | pt-duo-bookit-biz.web.app |
| **API** | Both apps | bookit-api-prod-898535472060.europe-west3.run.app |

Both staging and production environments are live and continuously deployed.

---

## 2. Technology Choices

### Backend — Go API

| Concern | Choice | Why |
|---------|--------|-----|
| Language | **Go 1.25** | Fast, low memory footprint, easy to deploy as a single binary |
| Web framework | **Gin** | Lightweight, battle-tested, excellent performance |
| Database | **PostgreSQL 15** | Reliable relational DB; strong EU hosting options |
| Authentication | **JWT** (30 min access / 30 day refresh) | Stateless, scales without shared session storage |
| Email | **SendGrid** (prod) / SMTP (dev) | Transactional email with fallback for local development |
| API contract | **OpenAPI 3.0** | Machine-readable spec drives both backend types and frontend types — single source of truth |

### Frontend — React

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | **React 19 + TypeScript** | Industry standard; strong ecosystem and hiring pool |
| Build tool | **Vite 8** | Fastest available build tooling |
| Styling | **Tailwind CSS v4** | Utility-first; consistent design system with low CSS overhead |
| State management | **Zustand** (client) + **TanStack Query** (server) | Right tool for each job; avoids unnecessary complexity |
| HTTP client | **openapi-fetch** | Type-safe API calls generated directly from the OpenAPI spec |
| Routing | **React Router v7** | Standard choice for React SPAs |

### Infrastructure — Google Cloud Platform

| Resource | Service | Notes |
|----------|---------|-------|
| API hosting | **Cloud Run** | Serverless containers; scales 0–10 instances automatically |
| Web hosting | **Firebase Hosting** | CDN-backed static hosting; global edge delivery |
| Database | **Cloud SQL** (PostgreSQL) | Managed DB with automated backups |
| Container registry | **Artifact Registry** | Stores versioned Docker images |
| Secrets | **Secret Manager** | DB credentials, JWT keys — never in code |
| Region | **europe-west3 (Frankfurt)** | EU data residency; low latency for Lithuanian users |
| Feature flags | **Firebase Remote Config** | Toggle features without deployments |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Users / Providers                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
          ┌─────────────────┴──────────────────┐
          │                                    │
   ┌──────▼──────┐                     ┌───────▼──────┐
   │ Consumer App│                     │  Business App│
   │ (React SPA) │                     │  (React SPA) │
   │Firebase CDN │                     │ Firebase CDN │
   └──────┬──────┘                     └───────┬──────┘
          │                                    │
          └────────────────┬───────────────────┘
                           │  HTTPS + httpOnly cookies
                    ┌──────▼──────┐
                    │  Bookit API │
                    │  (Go/Gin)   │
                    │  Cloud Run  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ PostgreSQL  │
                    │  Cloud SQL  │
                    └─────────────┘
```

**Key architectural principle:** Modular monolith — a single API codebase with clear
domain boundaries. This gives the speed of a monolith now with the option to extract
services later if scale demands it.

### Planned Business Domains (from API specification)

| Domain | Responsibility |
|--------|---------------|
| **Identity** | Users, authentication, sessions ✅ *implemented* |
| **Catalog** | Businesses, services, staff, equipment |
| **Scheduling** | Availability, time slots |
| **Booking** | Appointments, cancellations |
| **Payment** | Transactions, webhooks |
| **Notification** | Email, push notifications |
| **Search** | Public discovery of providers and services |

---

## 4. Security

- **Authentication:** JWT tokens stored in `httpOnly` cookies — not accessible to
  JavaScript, protecting against XSS attacks
- **Secrets management:** All credentials (database URL, JWT signing keys, API keys)
  live in Google Secret Manager; nothing sensitive is in the codebase
- **API contract:** All error responses follow RFC 7807 — a standard format that
  avoids leaking internal details
- **Rate limiting:** 100 requests/min for anonymous users, 1000/min for authenticated
- **EU data residency:** All infrastructure in Frankfurt (europe-west3); Cloud SQL
  data stays in the EU

---

## 5. Development & Delivery

### Environments

| Environment | Purpose | Triggered by |
|-------------|---------|--------------|
| **Local** | Development (Docker Compose) | Developer's machine |
| **Staging** | Testing before release | Opening a pull request |
| **Production** | Live users | Merging to `main` branch |

### Quality Gates (automated on every PR)

1. **Lint** — code style and static analysis
2. **Tests** — automated test suite with coverage reporting
3. **Build** — confirms the API compiles and the web apps bundle successfully
4. **Deploy to staging** — live staging environment for every PR
5. **Owner review** — all changes require explicit approval before merging

No code reaches production without passing all five gates.

### Release Cadence

Continuous delivery — changes go from development to production in a single pipeline
with no manual release steps. A typical change takes under 10 minutes from merge
to production.

---

## 6. Monitoring & Logs

### Dashboards — Grafana Cloud

A live monitoring dashboard is connected to Google Cloud and available at all times.
It covers the production API and updates in real time.

| Panel | What it shows |
|-------|--------------|
| **Requests by status** | Volume of successful (2xx), client error (4xx), and server error (5xx) responses over time |
| **Request latency (p99)** | How long the slowest 1% of requests take — the key indicator of user-perceived slowness |
| **5xx error count** | Server-side failures with colour-coded thresholds (green → yellow → red) |
| **Active instances** | Number of Cloud Run instances currently running (tracks auto-scaling in real time) |

Grafana Cloud is on the free tier — **cost: $0/month**. Alerting (PagerDuty / email
on error rate spikes) is planned for the next observability phase.

### Logs — GCP Logs Explorer

All API logs are structured JSON (every request, authentication event, warning, and
error is machine-readable). Logs are queried through Google Cloud Logs Explorer with
pre-saved queries for the most common operational needs:

- All errors / 5xx responses
- Slow requests (> threshold)
- Authentication events (login success, login failure, password reset)
- Activity by specific user or request ID

GCP Cloud Logging free tier covers ~50 GB/month. Current usage is well under 1 GB/month —
**cost: $0/month**.

---

## 7. Current Status

| Area | Status |
|------|--------|
| Infrastructure | ✅ Production + staging fully deployed |
| Authentication | ✅ Register, login, email verification, password reset, session refresh |
| Consumer app | ✅ Landing page, auth flows, account management |
| Business app | ✅ Landing page, auth flows, account management |
| Cross-app session handoff | ✅ Seamless switch between consumer and business apps |
| Feature flags | ✅ Server-side and client-side feature toggles |
| Email delivery | ✅ SendGrid integration with templated emails |
| Catalog (businesses, services) | 🔄 In specification — implementation planned |
| Booking flow | 🔄 In specification — implementation planned |
| Payments | 🔄 In specification — implementation planned |

---

## 8. Scalability & Cost

Cloud Run scales to zero when there is no traffic — the API costs nothing when idle.
Under load it scales automatically up to 10 instances (each handling 80 concurrent
requests), which is sufficient for tens of thousands of daily active users without
configuration changes.

Firebase Hosting for the web apps has no server to manage and serves globally from
Google's CDN edge nodes.

Database scaling is handled by Cloud SQL with the option to add read replicas as
read traffic grows.

---

## 9. What Comes Next (path to MVP)

1. **Catalog domain** — businesses, locations, services, staff, equipment
2. **Scheduling** — availability rules and bookable time slots
3. **Booking flow** — end-to-end appointment creation for consumers
4. **Payments** — transaction processing
5. **Notifications** — booking confirmations, reminders
6. **Search** — public provider and service discovery

MVP target remains **June 30, 2026**.
