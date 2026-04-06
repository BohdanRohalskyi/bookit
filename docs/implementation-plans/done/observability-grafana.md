---
title: "Observability with Grafana Cloud"
status: DONE
created: 2026-04-03
author: "Claude"
started: 2026-04-06
completed: 2026-04-06
---

# Plan: Observability with Grafana Cloud

## Summary

Implement core observability for Bookit: structured logging, metrics collection, dashboards, and alerting. Uses Grafana Cloud (free tier) connected to GCP for a unified view of system health and performance across staging and production.

**Goal:** Full visibility into system behavior and fast incident detection.

**Phase 2:** Business metrics, security dashboards, and custom metrics are in [`../new/observability-phase2.md`](../new/observability-phase2.md) (blocked on auth/booking/payment features).

---

## What to Log

### Application Logs

| Category | Events | Log Level | Fields |
|----------|--------|-----------|--------|
| **Requests** | Every HTTP request | INFO | `request_id`, `method`, `path`, `status`, `latency_ms`, `client_ip`, `user_id` |
| **Errors** | Unhandled exceptions, panics | ERROR | `request_id`, `error`, `stack_trace`, `context` |
| **Warnings** | Recoverable issues | WARN | `request_id`, `message`, `details` |
| **Debug** | Detailed flow (dev only) | DEBUG | Varies |

### Security Logs

| Event | Log Level | Fields | Alert? |
|-------|-----------|--------|--------|
| Login success | INFO | `user_id`, `method` (password/oauth), `ip` | No |
| Login failure | WARN | `email`, `reason`, `ip`, `attempt_count` | Yes (>5 in 5min) |
| Password reset requested | INFO | `email`, `ip` | No |
| Permission denied | WARN | `user_id`, `resource`, `action`, `ip` | Yes (pattern) |
| Token refresh | INFO | `user_id` | No |
| Token revoked | INFO | `user_id`, `reason` | No |
| Account locked | WARN | `user_id`, `reason` | Yes |
| Suspicious activity | WARN | `user_id`, `type`, `details` | Yes |

### Business Event Logs

| Domain | Event | Fields | Purpose |
|--------|-------|--------|---------|
| **Booking** | `booking.created` | `booking_id`, `user_id`, `provider_id`, `service_id`, `slot_time`, `price` | Funnel analysis |
| **Booking** | `booking.confirmed` | `booking_id`, `confirmation_time_ms` | Conversion tracking |
| **Booking** | `booking.cancelled` | `booking_id`, `reason`, `cancelled_by`, `refund_amount` | Churn analysis |
| **Booking** | `booking.completed` | `booking_id`, `actual_duration`, `rating` | Quality metrics |
| **Booking** | `booking.no_show` | `booking_id`, `user_id` | No-show rate |
| **Payment** | `payment.initiated` | `payment_id`, `booking_id`, `amount`, `method` | Payment funnel |
| **Payment** | `payment.succeeded` | `payment_id`, `provider_fee`, `net_amount` | Revenue tracking |
| **Payment** | `payment.failed` | `payment_id`, `error_code`, `error_message` | Payment issues |
| **Payment** | `refund.processed` | `refund_id`, `booking_id`, `amount`, `reason` | Refund tracking |
| **Search** | `search.executed` | `query`, `filters`, `results_count`, `latency_ms` | Search quality |
| **Search** | `search.no_results` | `query`, `filters`, `location` | Content gaps |
| **Provider** | `provider.registered` | `provider_id`, `vertical`, `location` | Supply growth |
| **Provider** | `provider.availability_updated` | `provider_id`, `slots_added`, `slots_removed` | Supply health |
| **User** | `user.registered` | `user_id`, `method`, `referral_source` | Growth tracking |
| **User** | `user.profile_updated` | `user_id`, `fields_changed` | Engagement |
| **Notification** | `notification.sent` | `type`, `channel`, `recipient_id`, `template` | Delivery tracking |
| **Notification** | `notification.failed` | `type`, `channel`, `error` | Delivery issues |

### External Service Logs

| Service | Events | Fields |
|---------|--------|--------|
| **Database** | Slow queries (>100ms) | `query_hash`, `duration_ms`, `rows_affected` |
| **Firebase** | Remote Config fetch | `success`, `latency_ms`, `flags_count` |
| **Payment Gateway** | API calls | `endpoint`, `status`, `latency_ms`, `error` |
| **Email Service** | Send attempts | `template`, `recipient`, `status`, `message_id` |
| **SMS Service** | Send attempts | `template`, `recipient`, `status` |
| **Cloud Storage** | Upload/download | `bucket`, `object`, `size_bytes`, `latency_ms` |

---

## What to Monitor

### Infrastructure Metrics (GCP Native)

| Resource | Metric | Alert Threshold |
|----------|--------|-----------------|
| **Cloud Run** | Request count | - |
| **Cloud Run** | Request latency p50/p95/p99 | p95 > 2s |
| **Cloud Run** | Error rate (4xx, 5xx) | 5xx > 5% |
| **Cloud Run** | Instance count | - |
| **Cloud Run** | CPU utilization | > 80% |
| **Cloud Run** | Memory utilization | > 80% |
| **Cloud Run** | Cold start latency | p95 > 5s |
| **Cloud Run** | Billable instance time | Budget threshold |
| **Cloud SQL** | CPU utilization | > 80% |
| **Cloud SQL** | Memory utilization | > 80% |
| **Cloud SQL** | Disk utilization | > 85% |
| **Cloud SQL** | Active connections | > 80% of max |
| **Cloud SQL** | Replication lag | > 10s (if replica) |
| **Cloud Storage** | Request count | - |
| **Cloud Storage** | Egress bandwidth | Budget threshold |

### Application Metrics (Custom)

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `http_requests_total` | Counter | `method`, `path`, `status` | Request volume |
| `http_request_duration_seconds` | Histogram | `method`, `path` | Latency distribution |
| `http_requests_in_flight` | Gauge | - | Concurrency |
| `db_query_duration_seconds` | Histogram | `query_type` | DB performance |
| `db_connections_active` | Gauge | - | Connection pool |
| `external_request_duration_seconds` | Histogram | `service`, `endpoint` | Dependency health |
| `cache_hits_total` | Counter | `cache_name` | Cache effectiveness |
| `cache_misses_total` | Counter | `cache_name` | Cache effectiveness |

### Business Metrics (Custom)

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `bookings_created_total` | Counter | `vertical`, `provider_id` | Booking volume |
| `bookings_completed_total` | Counter | `vertical` | Completion rate |
| `bookings_cancelled_total` | Counter | `vertical`, `reason` | Cancellation analysis |
| `booking_value_euros` | Histogram | `vertical` | Revenue distribution |
| `payment_success_total` | Counter | `method` | Payment health |
| `payment_failure_total` | Counter | `method`, `error_code` | Payment issues |
| `search_queries_total` | Counter | `vertical`, `has_results` | Search usage |
| `search_latency_seconds` | Histogram | `vertical` | Search performance |
| `users_registered_total` | Counter | `method` | User growth |
| `providers_active` | Gauge | `vertical` | Supply health |
| `slots_available` | Gauge | `vertical`, `region` | Inventory health |

---

## How to Implement

### Log Format (JSON)

```json
{
  "time": "2026-04-03T14:30:00.000Z",
  "level": "INFO",
  "msg": "booking.created",
  "request_id": "abc-123",
  "trace_id": "xyz-789",
  "user_id": "user_456",
  "booking_id": "book_789",
  "provider_id": "prov_012",
  "service_id": "svc_345",
  "vertical": "beauty",
  "price_cents": 5000,
  "slot_time": "2026-04-05T10:00:00Z"
}
```

### Log Levels Usage

| Level | When to Use | Examples |
|-------|-------------|----------|
| **ERROR** | System cannot continue, requires attention | Unhandled panic, DB connection lost, payment gateway down |
| **WARN** | Unexpected but recoverable | Failed login, validation error, rate limit hit |
| **INFO** | Normal business operations | Request completed, booking created, user registered |
| **DEBUG** | Development troubleshooting | Function entry/exit, variable values (never in prod) |

### Structured Logging Implementation

```go
// Log a business event
log.Info("booking.created",
    "booking_id", booking.ID,
    "user_id", userID,
    "provider_id", booking.ProviderID,
    "service_id", booking.ServiceID,
    "vertical", booking.Vertical,
    "price_cents", booking.PriceCents,
    "slot_time", booking.SlotTime,
)

// Log an error with context
log.Error("payment.failed",
    "payment_id", payment.ID,
    "booking_id", payment.BookingID,
    "error_code", err.Code,
    "error", err.Error(),
)

// Log security event
log.Warn("auth.login_failed",
    "email", email,
    "reason", "invalid_password",
    "ip", clientIP,
    "attempt_count", attemptCount,
)
```

---

## Prerequisites

- [x] Structured logging implemented (JSON format)
- [x] Grafana Cloud account (free tier)
- [x] GCP service account with read-only access

---

## Phases

### Phase 1: GCP Service Account Setup `[DONE]`

> Completed: 2026-04-06

Create a dedicated service account for Grafana with minimal read-only permissions.

**Tasks:**
1. Create service account `grafana-reader`
2. Grant `roles/monitoring.viewer` (read metrics)
3. Grant `roles/logging.viewer` (read logs)
4. Generate and securely store JSON key

**Result:**
- Service account: `grafana-reader@pt-duo-bookit.iam.gserviceaccount.com`
- Key file: `~/grafana-key.json`

**Security notes:**
- Key file must never be committed to git
- Rotate key quarterly
- Delete key immediately if compromised

---

### Phase 2: Grafana Cloud Setup `[DONE]`

> Completed: 2026-04-06

Create Grafana Cloud account and configure GCP data sources.

**Tasks:**
1. Sign up at https://grafana.com/products/cloud/ (free tier)
2. Add data source: **Google Cloud Monitoring**
   - Upload service account JSON key
   - Set default project: `pt-duo-bookit`
3. ~~Add data source: Google Cloud Logging~~ → Using GCP Logs Explorer instead

**Result:**
- Grafana Cloud: Active
- GCP Monitoring data source: Connected
- Logs: Using GCP Logs Explorer (https://console.cloud.google.com/logs/query?project=pt-duo-bookit)

**Decision:** Google Cloud Logging data source not available as core plugin in Grafana Cloud. Using GCP Logs Explorer directly for MVP — sufficient for current scale, no additional setup.

**Free tier limits:**
| Resource | Limit |
|----------|-------|
| Metrics | 10,000 series |
| Logs | 50 GB/month (Loki, if used later) |
| Traces | 50 GB/month |
| Users | 3 |
| Retention | 14 days |

---

### Phase 3: API Health Dashboard `[DONE]`

> Completed: 2026-04-06

Create primary dashboard for API health and performance.

**Dashboard: "Bookit API - Health"**

**Implemented Panels:**
| Panel | Type | Description |
|-------|------|-------------|
| Requests by Status | Time series | Request volume by 2xx/4xx/5xx |
| Request Latency (p99) | Time series | 99th percentile latency |
| 5xx Errors | Gauge | Error count with thresholds |
| Active Instances | Stat | Cloud Run instance count (active/idle) |

**Deferred to Phase 2:**
- CPU/Memory utilization panels
- Environment variable ($environment)
- Additional latency percentiles (p50, p90)

---

### Phase 4: Database Dashboard `[DEFERRED]`

> Moved to `../new/observability-phase2.md` — Phase 0

Dashboard for Cloud SQL monitoring. Deferred to keep MVP scope focused on API health.

---

### Phase 5: Log Exploration `[DONE]`

> Completed: 2026-04-06

Log queries documented for GCP Logs Explorer (saved directly in GCP console).

**Queries documented:**
- All logs (prod/staging)
- Errors (all, 5xx, 4xx)
- Performance (slow requests)
- Authentication events
- Business events (booking, payment)
- Debugging (by request_id, user_id, path)

---

### Phase 6: Alerting `[DEFERRED]`

> Moved to `../new/observability-phase3.md`

Alerting configuration deferred to Phase 3 plan.

---

## Verification Checklist

**Phase 1-2: Setup**
- [x] Service account created with minimal permissions
- [x] Grafana Cloud account active
- [x] GCP Monitoring data source connected (green)
- [x] Logs accessible via GCP Logs Explorer (using native GCP logging)

**Phase 3-4: Dashboards**
- [x] API Health dashboard shows live data
- [ ] Database dashboard (deferred to Phase 2)
- [ ] Environment switcher (deferred to Phase 2)
- [x] All panels load without errors

**Phase 5: Logs**
- [x] Query reference documented (saved in GCP Logs Explorer)
- [x] GCP Logs Explorer accessible

**Phase 6: Alerting**
- [ ] Deferred to `../new/observability-phase3.md`

**See [`../new/observability-phase2.md`](../new/observability-phase2.md) for business metrics, security, and custom metrics verification.**

---

## Cost Analysis

| Service | Free Tier | Our Usage | Cost |
|---------|-----------|-----------|------|
| Grafana Cloud | 10k metrics, 50GB logs | Well under | $0 |
| GCP Cloud Logging | 50GB/month | ~1GB/month | $0 |
| GCP Cloud Monitoring | 150MB metrics | ~10MB/month | $0 |

**Estimated monthly cost: $0**

**When to upgrade:**
- Grafana Pro ($29/user/month): Need >14 day retention or >3 users
- GCP: Unlikely to exceed free tier for MVP

---

## Rollback

If Grafana Cloud doesn't work out:

```bash
# Remove Grafana access
gcloud iam service-accounts delete grafana-reader@pt-duo-bookit.iam.gserviceaccount.com
```

**Alternatives:**
1. **GCP Cloud Monitoring Dashboards** - Built-in, less powerful UI
2. **Self-hosted Grafana on Cloud Run** - Full control, more maintenance
3. **Datadog** - More powerful, but expensive ($15/host/month)

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed |
| `[CHANGED]` | Implementation differs from plan |
| `[REJECTED]` | Phase was not implemented |
