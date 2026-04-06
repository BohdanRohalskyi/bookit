---
title: "Observability Phase 3: Dashboards & Alerting"
status: NEW
created: 2026-04-06
author: "Claude"
depends_on: "../done/observability-grafana.md"
---

# Plan: Observability Phase 3 — Dashboards & Alerting

## Summary

Extend dashboards with additional panels and configure alerts in Grafana Cloud.

**Prerequisites:**
- [x] Grafana Cloud account active
- [x] GCP Monitoring data source connected
- [x] API Health dashboard created
- [ ] Slack webhook (optional, for Slack notifications)

---

## Phases

### Phase 0: Dashboard Enhancements `[PENDING]`

Extend dashboards with additional panels. **No dependencies** — can be done anytime.

**API Health Dashboard Additions:**
| Panel | Type | Description |
|-------|------|-------------|
| CPU Utilization | Time series | By instance |
| Memory Utilization | Time series | By instance |
| Latency (p50, p90) | Time series | Additional percentiles |

**Variables to Add:**
- `$environment`: Dropdown to switch between `staging` / `prod`

**Database Dashboard (new):**
| Panel | Type | Description |
|-------|------|-------------|
| Database CPU % | Gauge/Time series | Cloud SQL CPU utilization |
| Database Memory % | Gauge/Time series | Cloud SQL memory utilization |
| Connections | Stat | Active connections |
| Disk % | Gauge | Disk utilization |

---

### Phase 1: Notification Channels `[PENDING]`

Set up notification channels before creating alerts.

**Channels to Configure:**

| Channel | Type | Purpose |
|---------|------|---------|
| Email | Email | Primary, always on |
| Slack (#bookit-alerts) | Webhook | Team notifications (optional) |

**Setup:**
1. Grafana → Alerting → Contact points
2. Add email contact point
3. (Optional) Add Slack webhook

---

### Phase 2: Critical Alerts `[PENDING]`

Alerts requiring immediate action.

| Alert | Condition | For | Notify |
|-------|-----------|-----|--------|
| Service Down | 0 requests | 3 min | Email, Slack |
| High Error Rate | 5xx > 10% | 3 min | Email, Slack |
| Database Down | Connection errors | 1 min | Email, Slack |
| Payment Gateway Down | Payment errors > 50% | 2 min | Email, Slack |
| Disk Almost Full | Disk > 90% | 5 min | Email, Slack |

**GCP Monitoring Queries:**

**Service Down:**
```
Service: Cloud Run Revision
Metric: Request Count
Filter: service_name = bookit-api-prod
Condition: sum() = 0 for 3m
```

**High Error Rate:**
```
Service: Cloud Run Revision  
Metric: Request Count
Filter: service_name = bookit-api-prod, response_code_class = 5xx
Condition: rate() / total_rate() > 0.10 for 3m
```

---

### Phase 3: Warning Alerts `[PENDING]`

Alerts to investigate soon (not urgent).

| Alert | Condition | For | Notify |
|-------|-----------|-----|--------|
| Elevated Error Rate | 5xx > 5% | 5 min | Email |
| High Latency | p95 > 2s | 5 min | Email |
| High CPU | CPU > 80% | 10 min | Email |
| High Memory | Memory > 85% | 10 min | Email |
| High DB Connections | Connections > 80% | 10 min | Email |
| Many Failed Logins | >20 failures from same IP in 5min | - | Email |

---

### Phase 4: Info Alerts `[PENDING]`

Awareness notifications (no action required).

| Alert | Condition | Notify |
|-------|-----------|--------|
| Deployment Detected | New revision deployed | Slack |
| Scaling Event | Instance count changed significantly | Slack |

---

### Phase 5: Alert Settings `[PENDING]`

Configure global alert behavior.

| Setting | Value |
|---------|-------|
| Evaluation interval | 30 seconds |
| Pending period | Varies by alert |
| Resolved notifications | Yes |
| Repeat interval | 4 hours |

---

### Phase 6: Runbooks `[PENDING]`

Add runbook links to alerts for faster incident response.

**Runbooks to Create:**

| Alert | Runbook |
|-------|---------|
| Service Down | `docs/runbooks/service-down.md` |
| High Error Rate | `docs/runbooks/high-error-rate.md` |
| Database Issues | `docs/runbooks/database-issues.md` |
| Payment Failures | `docs/runbooks/payment-failures.md` |
| High Latency | `docs/runbooks/high-latency.md` |

**Runbook Template:**
```markdown
# Runbook: [Alert Name]

## Symptoms
- What the alert means
- What users might experience

## Immediate Actions
1. Check X
2. Verify Y
3. If Z, do W

## Investigation
- Useful log queries
- Metrics to check
- Common causes

## Resolution
- How to fix common issues
- When to escalate

## Prevention
- How to prevent recurrence
```

---

## Verification Checklist

**Phase 0: Dashboards**
- [ ] CPU/Memory panels added to API Health dashboard
- [ ] Environment variable working
- [ ] Database dashboard created

**Phase 1-5: Alerting**
- [ ] Email contact point configured and tested
- [ ] Slack contact point configured and tested (if using)
- [ ] Test alert fires correctly
- [ ] Test alert resolves and notifies
- [ ] Critical alerts configured
- [ ] Warning alerts configured
- [ ] Info alerts configured (optional)

**Phase 6: Runbooks**
- [ ] All critical alerts have runbooks
- [ ] Runbooks linked in alert annotations
- [ ] Team reviewed runbook content

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed |
| `[CHANGED]` | Implementation differs from plan |
| `[REJECTED]` | Phase was not implemented |
