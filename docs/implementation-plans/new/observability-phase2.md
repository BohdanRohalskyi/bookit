---
title: "Observability Phase 2: Business & Security Metrics"
status: NEW
created: 2026-04-06
author: "Claude"
depends_on: "../done/observability-grafana.md"
---

# Plan: Observability Phase 2 — Business & Security Metrics

## Summary

Extends the core observability stack with business metrics, security monitoring, and custom application metrics. **Post-MVP** — requires auth, booking, and payment flows.

**Prerequisites:**
- [x] Phase 1 (observability-grafana.md) completed
- [ ] Auth endpoints implemented (for security dashboard)
- [ ] Booking flow implemented (for business metrics)
- [ ] Payment flow implemented (for revenue metrics)

---

## Phases

### Phase 1: Business Metrics Dashboard `[PENDING]`

Dashboard for business KPIs.

**Dashboard: "Bookit - Business Metrics"**

**Row 1: Bookings**
| Panel | Description |
|-------|-------------|
| Bookings Today | Counter |
| Bookings This Week | vs Last Week |
| Booking Funnel | Search → View → Book → Complete |
| Cancellation Rate | % cancelled |

**Row 2: Revenue**
| Panel | Description |
|-------|-------------|
| Revenue Today | Sum |
| Revenue Trend | Daily for last 30 days |
| Avg Booking Value | By vertical |
| Refunds | Amount and count |

**Row 3: Users**
| Panel | Description |
|-------|-------------|
| New Registrations | Daily |
| Active Users | DAU/WAU/MAU |
| User Retention | Cohort chart |

**Row 4: Supply**
| Panel | Description |
|-------|-------------|
| Active Providers | Count by vertical |
| New Providers | This week |
| Availability | Slots available next 7 days |

**Note:** Requires custom metrics or log-derived metrics in Grafana.

---

### Phase 2: Security Dashboard `[PENDING]`

Dashboard for security monitoring.

**Dashboard: "Bookit - Security"**

**Row 1: Authentication**
| Panel | Description |
|-------|-------------|
| Login Attempts | Success vs Failed |
| Failed Logins by IP | Top 10 IPs |
| Account Lockouts | Count |

**Row 2: Authorization**
| Panel | Description |
|-------|-------------|
| Permission Denials | Count by resource |
| Suspicious Activity | Flagged events |

**Row 3: API Security**
| Panel | Description |
|-------|-------------|
| Rate Limit Hits | By endpoint |
| Invalid Tokens | Count |
| Requests by Country | Geo distribution |

**Required log events:**
- `auth.login_success`
- `auth.login_failed`
- `auth.account_locked`
- `auth.permission_denied`
- `auth.token_invalid`

---

### Phase 3: Custom Metrics Implementation `[PENDING]`

Add OpenTelemetry for custom application metrics.

**Alternative (simpler):** Use log-derived metrics in Grafana Cloud instead of OpenTelemetry. Extract metrics directly from structured logs without code changes.

**If using OpenTelemetry:**

**Dependencies:**
```go
go get go.opentelemetry.io/otel
go get go.opentelemetry.io/otel/metric
go get github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric
```

**Implementation:**

```go
// internal/platform/metrics/metrics.go
package metrics

import (
    "context"
    "go.opentelemetry.io/otel/metric"
)

type Metrics struct {
    BookingsCreated   metric.Int64Counter
    BookingsCompleted metric.Int64Counter
    BookingsCancelled metric.Int64Counter
    BookingValue      metric.Float64Histogram
    PaymentSuccess    metric.Int64Counter
    PaymentFailure    metric.Int64Counter
    SearchQueries     metric.Int64Counter
    SearchLatency     metric.Float64Histogram
}

func New(meter metric.Meter) (*Metrics, error) {
    m := &Metrics{}
    var err error

    m.BookingsCreated, err = meter.Int64Counter("bookit.bookings.created",
        metric.WithDescription("Total bookings created"),
    )
    if err != nil {
        return nil, err
    }

    // ... initialize other metrics

    return m, nil
}

// Usage in handlers:
// metrics.BookingsCreated.Add(ctx, 1,
//     attribute.String("vertical", "beauty"),
//     attribute.String("provider_id", providerID),
// )
```

**Custom Metrics to Implement:**

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

## Verification Checklist

**Phase 1: Business Metrics**
- [ ] Dashboard created with all panels
- [ ] Booking metrics populating
- [ ] Revenue metrics accurate
- [ ] User metrics tracking

**Phase 2: Security**
- [ ] Auth events logging correctly
- [ ] Dashboard shows login patterns
- [ ] Failed login alerts working

**Phase 3: Custom Metrics**
- [ ] Metrics exporting to GCP/Grafana
- [ ] No significant performance impact
- [ ] Labels consistent across metrics

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed |
| `[CHANGED]` | Implementation differs from plan |
| `[REJECTED]` | Phase was not implemented |
