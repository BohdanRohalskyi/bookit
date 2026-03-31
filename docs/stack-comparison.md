# Stack Decisions: Database & Event Processing

> Context: Bookit MVP, solo developer, Go backend, GCP deployment

---

## 1. Database: Where to store data?

### Two Options

| | Neon | Cloud SQL |
|--|------|-----------|
| **What is it** | Serverless PostgreSQL | GCP's managed PostgreSQL |
| **Cost** | Free tier available | ~$10-50/mo |
| **Cold starts** | Yes (slow first query after idle) | No (always on) |
| **GCP integration** | External service | Native |

---

## 2. Event Processing: How to handle background jobs?

Jobs we need: send confirmation emails, send reminders, process payment callbacks.

### Four Options

| Option | What is it | Extra cost | Complexity |
|--------|-----------|------------|------------|
| **river** | Jobs stored in PostgreSQL | $0 | Low |
| **Pub/Sub + Cloud Tasks** | GCP's native messaging | $0 | Medium |
| **RabbitMQ** | Classic message broker (via CloudAMQP) | $0 (free tier) | Medium |
| **asynq** | Jobs stored in Redis | $30+/mo | Medium |

### Free Tier Comparison

**Pub/Sub + Cloud Tasks (GCP):**

| Service | Free Tier | Paid Rate |
|---------|-----------|-----------|
| Pub/Sub | 10 GB/month | $40/TB |
| Cloud Tasks | 1M tasks/month | $0.40/million |

**RabbitMQ (CloudAMQP "Little Lemur"):**

| Limit | Value |
|-------|-------|
| Messages | 1M/month |
| Queues | 3 |
| Connections | 20 |
| Data | 20 MB |

**river / asynq:**

| Option | Cost |
|--------|------|
| river | $0 (uses your PostgreSQL) |
| asynq | $30+/mo (requires Redis, no GCP free tier) |

---

### MVP Usage Estimate (500-1,000 bookings/month)

| Metric | Estimate | Pub/Sub Free | RabbitMQ Free |
|--------|----------|--------------|---------------|
| Events per booking | ~3 | - | - |
| Total events/month | ~3,000 | 10M+ available | 1M available |
| Data volume | ~3 MB | 10 GB available | 20 MB available |

At scale (100K bookings/month):
- Pub/Sub + Tasks: ~$1-5/month
- RabbitMQ: ~$20/month (paid tier)

---

## 3. GCP Project Structure: One vs Two Projects

### Two Options

| | Two Projects | One Project |
|--|---------------------------|-------------|
| **Structure** | bookit-staging + bookit-prod | bookit (mixed) |
| **Isolation** | Full | Naming conventions only |
| **Risk** | Staging can't affect prod | Mistakes possible |
| **Cost** | Higher (duplicate infra) | Lower (shared) |

---

### Cost Comparison (Monthly)

| Service | Two Projects | One Project | Difference |
|---------|--------------|-------------|------------|
| Cloud SQL | $35-60 (micro + small) | $25-50 (shared) | +$10 |
| Cloud Run | ~$0-5 | ~$0-5 | Same |
| Cloud Storage | ~$1-5 | ~$1-5 | Same |
| Pub/Sub | ~$0 | ~$0 | Same |
| **Total** | **$40-70** | **$30-60** | **+$10** |

**Notes:**
- Cloud Run is pay-per-request — two projects doesn't double cost
- Staging instance can be tiny (db-f1-micro, ~$10/mo)

---

### Cloud SQL: Instances vs Databases

One Cloud SQL **instance** can host multiple **databases**:

```
Cloud SQL Instance (bookit-db)
  ├── bookit_staging (database)
  └── bookit_prod (database)
```

**Instance pricing (you pay per instance, not per query):**

| Instance Type | Specs | Cost |
|---------------|-------|------|
| db-f1-micro | Shared CPU, 0.6 GB | ~$10/mo |
| db-g1-small | Shared CPU, 1.7 GB | ~$25/mo |
| db-custom-2-4096 | 2 vCPU, 4 GB | ~$50/mo |

**Realistic cost comparison:**

| Setup | Staging | Prod | Total |
|-------|---------|------|-------|
| 2 instances | db-f1-micro ($10) | db-g1-small ($25-50) | **$35-60/mo** |
| 1 shared instance | — | db-g1-small ($25-50) | **$25-50/mo** |

**Shared instance trade-offs:** staging load affects prod, shared connection pool, one failure = both down.

---

### Database Setup Options

| Setup | Staging | Prod | Total DB Cost |
|-------|---------|------|---------------|
| 2 Cloud SQL instances | $10 (micro) | $25-50 | $35-60/mo |
| 1 Cloud SQL, 2 databases | shared | $25-50 | $25-50/mo |
| Neon + Cloud SQL | Free | $25-50 | $25-50/mo |
| Both Neon | Free | Free | $0/mo |

---

## 4. Discussion Questions

1. Is free tier worth the trade-offs (cold starts, external service)?

2. Do we want full GCP integration or keep options open?

---

*See full technical comparison in git history if needed.*
