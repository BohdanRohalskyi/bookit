---
title: "SendGrid Email Setup for Staging/Production"
status: NEW
created: 2026-04-07
author: "Claude"
---

# Plan: SendGrid Email Setup for Staging/Production

## Summary

Configure SendGrid as the email provider for staging and production environments. This enables email verification and password reset functionality to work in deployed environments.

**Goal:** Enable transactional emails (verification, password reset) on staging and production via SendGrid.

---

## Prerequisites

- SendGrid account (free tier: 100 emails/day)
- GCP project access with Secret Manager permissions
- GitHub repo admin access (for viewing workflow runs)

---

## Phases

### Phase 1: SendGrid Account Setup `[DONE]`

1. **Create SendGrid account** at https://sendgrid.com/free
   - Sign up with company email
   - Complete sender verification

2. **Verify sender identity** (required before sending):
   - Go to Settings > Sender Authentication
   - Choose "Single Sender Verification" (quick) or "Domain Authentication" (recommended for production)
   - For Single Sender: verify `noreply@bookit.app` or your domain email
   - For Domain Auth: add DNS records to your domain

3. **Create API keys** (one per environment for isolation):
   - Go to Settings > API Keys > Create API Key
   - Create `bookit-staging` with "Restricted Access" > Mail Send > Full Access
   - Create `bookit-prod` with "Restricted Access" > Mail Send > Full Access
   - Save both keys securely (shown only once)

---

### Phase 2: Configure GCP Secret Manager `[PENDING]`

Run these commands (replace `YOUR_KEY` with actual API keys):

```bash
# Set project
gcloud config set project pt-duo-bookit

# Create secrets for staging
echo -n "YOUR_STAGING_API_KEY" | gcloud secrets create sendgrid-api-key-staging \
  --data-file=- \
  --replication-policy="automatic"

# Create secrets for production
echo -n "YOUR_PROD_API_KEY" | gcloud secrets create sendgrid-api-key-prod \
  --data-file=- \
  --replication-policy="automatic"

# Grant Cloud Run service account access
PROJECT_NUMBER=$(gcloud projects describe pt-duo-bookit --format='value(projectNumber)')

gcloud secrets add-iam-policy-binding sendgrid-api-key-staging \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding sendgrid-api-key-prod \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Verify secrets exist:
```bash
gcloud secrets list --filter="name:sendgrid"
```

---

### Phase 3: Update CI/CD Workflow `[DONE]`

Update `.github/workflows/ci.yml` deploy step to include mail configuration.

**Current `--set-env-vars` line (around line 150):**
```yaml
--set-env-vars="ENVIRONMENT=${{ env.ENVIRONMENT }},LOG_LEVEL=info,GCP_PROJECT=${{ secrets.GCP_PROJECT_ID }}" \
```

**Updated `--set-env-vars` and `--set-secrets` lines:**
```yaml
--set-secrets="DATABASE_URL=bookit-database-url-${{ env.ENVIRONMENT }}:latest,JWT_SECRET=bookit-jwt-secret-${{ env.ENVIRONMENT }}:latest,SENDGRID_API_KEY=sendgrid-api-key-${{ env.ENVIRONMENT }}:latest" \
--set-env-vars="ENVIRONMENT=${{ env.ENVIRONMENT }},LOG_LEVEL=info,GCP_PROJECT=${{ secrets.GCP_PROJECT_ID }},MAIL_PROVIDER=sendgrid,MAIL_FROM=noreply@bookit.app,APP_URL=${{ env.ENVIRONMENT == 'prod' && 'https://pt-duo-bookit.web.app' || 'https://bookit-staging.web.app' }}" \
```

**Changes:**
1. Add `SENDGRID_API_KEY` to `--set-secrets`
2. Add `MAIL_PROVIDER=sendgrid` to env vars
3. Add `MAIL_FROM=noreply@bookit.app` to env vars
4. Add `APP_URL` with conditional value based on environment

---

### Phase 4: Deploy and Verify `[PENDING]`

1. **Commit and push** the CI/CD changes to trigger staging deployment:
   ```bash
   git add .github/workflows/ci.yml
   git commit -m "feat: configure SendGrid email for staging/prod"
   git push origin main
   ```

2. **Test on staging** (PR deployment):
   - Register a new user on staging frontend
   - Check SendGrid Activity Feed for sent email
   - Verify email arrives at test address

3. **Test password reset on staging**:
   - Request password reset for test user
   - Verify reset email arrives

4. **Merge to production** and repeat verification

---

### Phase 5: Monitoring Setup (Optional) `[PENDING]`

1. **SendGrid Activity Feed**: Monitor at https://app.sendgrid.com/email_activity

2. **Set up alerts** in SendGrid:
   - Settings > Mail Settings > Event Webhook (optional)
   - Settings > Alerts > Create Alert for bounces/blocks

3. **Consider upgrading** SendGrid plan if approaching 100 emails/day limit

---

## Rollback Plan

If emails fail in production:

1. **Check SendGrid dashboard** for errors (invalid API key, sender not verified, etc.)

2. **Temporarily disable** email features by setting env var:
   ```bash
   gcloud run services update bookit-api-prod \
     --region europe-west3 \
     --set-env-vars="MAIL_PROVIDER=noop"
   ```
   (Note: Would require adding a no-op provider to the code)

3. **Revert CI/CD** changes if needed

---

## Environment Summary

| Setting | Staging | Production |
|---------|---------|------------|
| MAIL_PROVIDER | sendgrid | sendgrid |
| MAIL_FROM | noreply@bookit.app | noreply@bookit.app |
| APP_URL | https://bookit-staging.web.app | https://pt-duo-bookit.web.app |
| SENDGRID_API_KEY | (from Secret Manager) | (from Secret Manager) |

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
