# NFR — Bookit

> **Non-Functional Requirements Document**
>
> Derived from: BRD-Bookit-20260327.md, PRD-Bookit-20260327.md

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Document version | v1.0 |
| Created date | 2026-03-27 |
| Status | Draft |
| BRD Reference | BRD-Bookit-20260327.md |
| PRD Reference | PRD-Bookit-20260327.md |
| MVP Target | June 30, 2026 |

---

## 1. Performance & Scalability

### 1.1 Concurrency & Load Profile

| Attribute | Target | Notes |
|-----------|--------|-------|
| **Design target** | 1,000+ concurrent users | Ambitious scale target — MVP traffic will be lower |
| **MVP reality** | < 200 concurrent users | Based on 10-25 providers initially |
| **Load pattern** | Unknown | No usage data yet; assume daily peaks |
| **Scaling approach** | Architect for horizontal scaling from day one | Over-provision for growth |

### 1.2 Throughput

| Attribute | Target | Notes |
|-----------|--------|-------|
| **Initial throughput** | < 100 requests/sec | Sufficient for MVP |
| **Scaling plan** | Horizontal scaling when needed | Architecture must support scale-out |

### 1.3 Response Time Targets

| Operation | Target | Percentile | Priority |
|-----------|--------|------------|----------|
| **Page/screen load** | < 1 second | Time to interactive | Critical |
| **API response** | < 100ms | p95 | Critical |
| **Search/discovery** | < 200ms | p95 | Critical |
| **Background jobs** | < 30 seconds | Completion time | High |

**Note:** < 100ms p95 API response at scale requires careful architecture: query optimization, caching strategy, possibly read replicas.

### 1.4 Data Volume

| Attribute | Target | Notes |
|-----------|--------|-------|
| **Database storage (launch)** | < 1 GB | Minimal MVP data |
| **Database growth rate** | < 100 MB/month | MVP period |
| **Media storage** | S3 (external) | Images, logos — separate from DB |
| **Video** | YouTube embeds | No video hosting — store URLs only |
| **Record count (1-2 years)** | < 100,000 records | Bookings, users, services combined |
| **Data retention** | `Assumption: pending legal review` | GDPR may impose requirements |

### 1.5 Performance Degradation Policy

| Policy | Description |
|--------|-------------|
| **Primary** | Protect booking/payment flow at all costs |
| **Secondary** | Rate-limit non-critical requests under extreme load |
| **Behavior** | Return clear error (429) rather than slow response |

**Priority order under load:**
1. Booking creation & confirmation
2. Payment callbacks
3. Authentication
4. Provider calendar
5. Search/discovery
6. Notifications (can queue)

---

## 2. Availability & Reliability

### 2.1 Uptime SLA

| Attribute | Target | Notes |
|-----------|--------|-------|
| **Uptime target** | 99.95% | ~21 minutes max downtime/month |
| **Measurement period** | Per calendar month | Reset each month |
| **Scope** | Entire system | All features equally (prioritization TBD) |

**Infrastructure implications:**
- Multi-AZ deployment required
- Automated health checks
- Load balancing with health-aware routing

### 2.2 Maintenance Windows

| Attribute | Policy |
|-----------|--------|
| **Scheduled downtime** | Allowed during off-peak hours (e.g., Sunday 02:00-04:00) |
| **Maintenance mode** | Degraded mode acceptable — core booking flow must remain available |
| **Communication** | Advance notice to providers (email) |

### 2.3 Recovery Objectives

| Metric | Target | Implications |
|--------|--------|--------------|
| **RTO (Recovery Time Objective)** | < 30 minutes | Automated recovery with runbooks |
| **RPO (Recovery Point Objective) — Transactional** | Zero data loss | Synchronous replication for bookings/payments |
| **RPO — Analytics/logs** | < 24 hours | Daily backups acceptable |

### 2.4 Degraded Mode Requirements

All features considered critical, but practical priority order:

| Priority | Capability | Rationale |
|----------|------------|-----------|
| P0 | Booking flow | Core revenue path |
| P0 | Payment processing | Must complete transactions |
| P1 | Authentication | Users must access accounts |
| P1 | Provider calendar | Providers must see schedule |
| P2 | Search/discovery | Can show cached results |
| P2 | Email notifications | Can queue and retry |

---

## 3. Security & Compliance

### 3.1 Regulatory Frameworks

| Framework | Applicability | Status |
|-----------|---------------|--------|
| **GDPR** | Required | EU/Lithuania launch |
| **PCI-DSS** | `Assumption: SAQ-A (redirect model)` | Pending Paysera verification |
| **SOC 2** | Not required for MVP | Consider post-MVP for B2B |
| **Data residency** | Lithuania/EU | GCP region selection |

**Target market:** Lithuania (EU)

### 3.2 Authentication & Authorization

| Requirement | MVP | Post-MVP |
|-------------|-----|----------|
| **Username + password** | Yes | Yes |
| **OAuth — Google** | Yes | Yes |
| **OAuth — Facebook** | Yes | Yes |
| **OAuth — Paysera** | Yes | Yes |
| **API tokens** | Yes (for AI agents) | Yes |
| **MFA** | No | Yes |
| **SSO (enterprise)** | No | Consider |
| **RBAC** | Implicit (customer/provider) | Explicit roles |

**Session management:**
- Secure session tokens (httpOnly, secure, sameSite)
- Session timeout: TBD (recommend 24h for customers, 8h for providers)

### 3.3 Data Classification & Protection

| Data Category | Classification | Encryption | MVP |
|---------------|----------------|------------|-----|
| **PII** (name, email, phone, address) | Sensitive | In transit + at rest | Yes |
| **Authentication credentials** | Critical | Hashed (bcrypt/argon2) + encrypted | Yes |
| **Financial data** (booking amounts, earnings) | Sensitive | In transit + at rest | Yes |
| **Location data** (business addresses) | Sensitive | In transit + at rest | Yes |
| **Behavioral/analytics** | Internal | In transit | Post-MVP |
| **Health/medical** (vet services) | Restricted | In transit + at rest | Post-MVP |

`Assumption: Encryption approach — pending security review (recommend: TLS 1.3 in transit, AES-256 at rest)`

### 3.4 Audit Logging

| Event Category | Logged | Retention |
|----------------|--------|-----------|
| **Authentication events** | Yes | 90 days (recommend: 1 year) |
| **Data access events** | Yes | 90 days |
| **Data modification events** | Yes | 90 days |
| **Administrative actions** | Yes | 90 days |
| **Booking/payment events** | Yes | 90 days |
| **API access logs** | Yes | 90 days |

**Log requirements:**
- Timestamps (UTC)
- Actor identification (user_id, IP, user agent)
- Action performed
- Affected resources
- Result (success/failure)

**Recommendation:** Extend auth/access log retention to 1 year for GDPR audit support.

### 3.5 Security Testing

| Testing Type | MVP | Post-MVP |
|--------------|-----|----------|
| **SAST (static analysis)** | Yes — CI/CD | Yes |
| **DAST (dynamic analysis)** | Yes — CI/CD | Yes |
| **Dependency scanning** | Yes — CI/CD | Yes |
| **Penetration testing** | No | Annual |
| **Bug bounty** | No | Consider |

### 3.6 GDPR Compliance

| Requirement | MVP | Post-MVP |
|-------------|-----|----------|
| **Privacy policy** | Yes | Yes |
| **Cookie consent** | Yes | Yes |
| **Right to deletion** | Yes (soft delete + anonymization) | Yes |
| **Data subject access requests (DSAR)** | No | Yes |
| **Consent management** | No | Yes |
| **Data portability** | No | Yes |

**Right to deletion approach:**
- Soft delete user record
- Anonymize PII in booking history (preserve for provider records)
- Hard delete authentication credentials
- Retain anonymized transaction data for financial records

---

## 4. Maintainability & Operability

### 4.1 Deployment

| Attribute | Target |
|-----------|--------|
| **Deployment frequency** | Multiple times per day (continuous deployment) |
| **Deployment strategy** | Zero-downtime (rolling/blue-green) |
| **Feature flags** | Required — gradual rollout, easy rollback |
| **Automated rollback** | Required — revert on health check failure |
| **Deployment pipeline** | Fully automated CI/CD |

### 4.2 Environments

| Environment | Infrastructure | Purpose |
|-------------|----------------|---------|
| **Development** | Local | Developer workstations |
| **Staging** | GCP | Pre-production testing, production-like |
| **Production** | GCP | Live environment |

**Environment parity:** Similar architecture between staging and production (same GCP services, scaled down for staging).

### 4.3 Infrastructure

| Attribute | Choice | Notes |
|-----------|--------|-------|
| **Cloud provider** | GCP | Primary platform |
| **Service preference** | GCP-native | Cloud Run, Cloud SQL, Cloud Storage, etc. |
| **Compute** | Serverless/managed preferred | Minimize ops overhead |
| **Database** | Cloud SQL (PostgreSQL) | Managed, Multi-AZ |
| **Object storage** | Cloud Storage (S3-compatible) | Media files |
| **CDN** | Cloud CDN | Static assets, media |

### 4.4 Observability

| Component | Tool/Approach | MVP |
|-----------|---------------|-----|
| **Application metrics** | Cloud Monitoring / custom | Yes |
| **Infrastructure metrics** | Cloud Monitoring | Yes |
| **Centralized logging** | Cloud Logging | Yes |
| **Distributed tracing** | Cloud Trace | Yes |
| **Uptime monitoring** | Cloud Monitoring uptime checks | Yes |
| **Alerting** | Cloud Monitoring alerts | Yes |
| **Error tracking** | Sentry or equivalent | Recommended |

**Key metrics to track:**
- Request latency (p50, p95, p99)
- Error rate (4xx, 5xx)
- Booking completion rate
- Payment success rate
- Authentication failures
- Database connection pool usage
- Memory/CPU utilization

### 4.5 Alerting

| Channel | Use Case | MVP |
|---------|----------|-----|
| **Email** | Non-urgent alerts, daily summaries | Yes |
| **Slack** | Real-time team notifications | Yes |
| **PagerDuty/Opsgenie** | On-call escalation | Post-MVP |
| **SMS** | Critical alerts | Post-MVP |

**Alert thresholds (examples):**
- Error rate > 1% for 5 minutes
- p95 latency > 500ms for 5 minutes
- Uptime check failure
- Database connection errors
- Payment callback failures

### 4.6 Incident Response

| Attribute | MVP Approach |
|-----------|--------------|
| **Response model** | Founder/team handles everything |
| **On-call rotation** | None (best effort) |
| **Response time SLA** | None (best effort) |
| **Escalation path** | Direct team communication (Slack) |
| **Post-mortems** | Informal, document major incidents |

**Post-MVP evolution:**
- Formal on-call rotation
- Defined response time SLAs
- Incident management tool (PagerDuty/Opsgenie)
- Structured post-mortems

### 4.7 Backup & Disaster Recovery

| Component | Strategy | Frequency | Retention |
|-----------|----------|-----------|-----------|
| **Database** | Automated snapshots | Daily | 7 days (recommend: 30) |
| **Database** | Transaction logs | Continuous | 7 days |
| **Media files** | Cloud Storage versioning | Continuous | 30 days |
| **Configuration** | Infrastructure as Code (Git) | Every change | Indefinite |

**Disaster recovery:**

| Attribute | MVP | Post-MVP |
|-----------|-----|----------|
| **Architecture** | Multi-AZ within region | Multi-region active-passive |
| **Failover** | Automatic within AZ | Cross-region failover |
| **RTO** | < 30 minutes | < 15 minutes |
| **DR testing** | Manual, quarterly | Automated, monthly |

### 4.8 Documentation

| Document Type | MVP | Notes |
|---------------|-----|-------|
| **README** | Yes | Setup, local development |
| **Architecture overview** | Basic | High-level diagrams |
| **Deployment runbook** | Yes | How to deploy, rollback |
| **Incident runbook** | Yes | Common issues, fixes |
| **API documentation** | Yes | OpenAPI/Swagger — essential for AI agents |
| **Database schema** | Yes | ERD, migration history |

---

## 5. Assumptions & Pending Decisions

### 5.1 Tagged Assumptions

| # | Assumption | Owner | Validation Method | Status |
|---|------------|-------|-------------------|--------|
| 1 | Data retention period compliant with GDPR | Legal | Legal review | Pending |
| 2 | PCI-DSS scope is SAQ-A (redirect to Paysera) | Engineering | Paysera integration docs | Pending |
| 3 | Encryption: TLS 1.3 in transit, AES-256 at rest | Security | Security review | Pending |
| 4 | 90-day log retention sufficient for compliance | Legal | Legal review | Pending |

### 5.2 Pending Decisions

| # | Decision | Owner | Due Date | Impact |
|---|----------|-------|----------|--------|
| 1 | Session timeout duration | Product | Before MVP | Auth implementation |
| 2 | Specific GCP region for Lithuania | Engineering | Before MVP | Latency, data residency |
| 3 | Backup retention period | Engineering | Before MVP | Storage costs, compliance |
| 4 | Alert thresholds | Engineering | Before MVP | Monitoring setup |

### 5.3 Recommendations

| # | Recommendation | Rationale | Priority |
|---|----------------|-----------|----------|
| 1 | Extend auth/access log retention to 1 year | GDPR audit support | High |
| 2 | Implement structured error responses | Better debugging, AI agent integration | Medium |
| 3 | Plan for multi-region from architecture phase | Avoid costly refactor later | Medium |
| 4 | Add error tracking (Sentry) | Faster debugging | High |
| 5 | Define incident severity levels | Prioritize response | Medium |

---

## 6. NFR to Architecture Mapping

> This table is filled in during the HLD phase to track how each NFR is addressed in the architecture.

| NFR Requirement | Architecture Decision | Status |
|-----------------|----------------------|--------|
| 99.95% uptime | Multi-AZ deployment | TBD |
| < 100ms API response | Caching strategy, query optimization | TBD |
| Zero RPO for transactions | Sync database replication | TBD |
| Continuous deployment | CI/CD pipeline design | TBD |
| GDPR compliance | Data handling architecture | TBD |
| Future AI agent integration | API-first design, OpenAPI docs | TBD |

---

## 7. Traceability

### 7.1 BRD → NFR Mapping

| BRD Requirement | NFR Coverage |
|-----------------|--------------|
| MVP deadline June 30, 2026 | Deployment frequency, CI/CD requirements |
| 10-25 providers target | Concurrency, throughput sizing |
| Single country launch (Lithuania) | GDPR compliance, data residency |
| Paysera Checkout integration | PCI-DSS scope, payment reliability |
| Email notifications | Background job performance |
| Future AI agent integration | API documentation, token auth |

### 7.2 PRD → NFR Mapping

| PRD Requirement | NFR Coverage |
|-----------------|--------------|
| Booking flow < 60 seconds | Page load, API response targets |
| Mobile-first design | Performance targets apply to mobile |
| OAuth authentication | Security, session management |
| Multi-service bookings | Transaction integrity, zero RPO |
| Provider/customer data | PII protection, GDPR compliance |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **SLA** | Service Level Agreement — contractual uptime commitment |
| **SLO** | Service Level Objective — internal target (often stricter than SLA) |
| **RTO** | Recovery Time Objective — max time to restore service after failure |
| **RPO** | Recovery Point Objective — max acceptable data loss (time) |
| **p95** | 95th percentile — 95% of requests are faster than this value |
| **Multi-AZ** | Deployment across multiple availability zones for redundancy |
| **SAST** | Static Application Security Testing — analyze code without running |
| **DAST** | Dynamic Application Security Testing — test running application |
| **SAQ-A** | PCI Self-Assessment Questionnaire A — simplest level for redirect-only |
| **GDPR** | General Data Protection Regulation — EU data protection law |

---

## Appendix B: GCP Service Recommendations

Based on NFR requirements, recommended GCP services:

| Requirement | GCP Service | Notes |
|-------------|-------------|-------|
| Compute | Cloud Run | Serverless, auto-scaling, zero-downtime deploys |
| Database | Cloud SQL (PostgreSQL) | Managed, Multi-AZ, automated backups |
| Object storage | Cloud Storage | Media files, S3-compatible |
| CDN | Cloud CDN | Static assets, low latency |
| Secrets | Secret Manager | API keys, credentials |
| CI/CD | Cloud Build | Native GCP integration |
| Monitoring | Cloud Monitoring | Metrics, uptime, alerting |
| Logging | Cloud Logging | Centralized, searchable |
| Tracing | Cloud Trace | Distributed tracing |
| Load balancing | Cloud Load Balancing | Global, health-aware |
| DNS | Cloud DNS | Managed DNS |

---

*Generated by nfr-definer from BRD-Bookit-20260327.md and PRD-Bookit-20260327.md*
