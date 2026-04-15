---
title: "Business CRUD"
status: IN_PROGRESS
created: 2026-04-15
author: "bohdan.rohalskyi@paysera.com"
---

# Plan: Business CRUD

## Summary

Providers can create, view, edit, and delete businesses. The backend catalog domain
(businesses table, repository, service, handlers) does not exist yet and must be built from
scratch. Logo images are stored in GCP Cloud Storage — the backend proxies uploads, stores
the public URL in `logo_url`. The spec needs `logo_url` added to create/update and a
DELETE endpoint. The frontend gets a file-picker create form, edit modal, and delete confirmation.

**Goal:** Full CRUD for businesses — provider creates a business with name, logo (file upload → GCS),
and category; views all their businesses; edits; deletes.

---

## Phases

### Phase 1: Database migration — businesses table `[DONE]`

Create `api/migrations/000006_create_businesses_table.up.sql`:

```sql
CREATE TABLE businesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  category    VARCHAR(20) NOT NULL CHECK (category IN ('beauty', 'sport', 'pet_care')),
  description TEXT,
  logo_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_businesses_provider_id ON businesses(provider_id);
```

`000006_create_businesses_table.down.sql`:
```sql
DROP TABLE IF EXISTS businesses;
```

---

### Phase 2: OpenAPI spec — logo_url + DELETE + logo upload endpoint `[DONE]`

**Changes to `api/openapi/spec.yaml`:**

1. Add `logo_url` (optional, nullable URI string) to `BusinessCreate`
2. Add `logo_url` (optional, nullable URI string) to `BusinessUpdate`
3. Add `DELETE /api/v1/businesses/{id}` — 204 on success, 401/403/404 on error
4. Add `POST /api/v1/businesses/{id}/logo` — multipart/form-data upload, returns updated `Business`

After spec changes: `cd api && make generate` to regenerate `internal/api/types.gen.go`.

---

### Phase 3: GCS infrastructure `[DONE]`

**Bucket provisioning** (run once per environment, user runs these commands):

```bash
# Production
gcloud storage buckets create gs://bookit-media-prod \
  --project=pt-duo-bookit \
  --location=europe-west3 \
  --uniform-bucket-level-access

gcloud storage buckets update gs://bookit-media-prod \
  --cors-file=infra/gcs-cors.json

gcloud storage buckets add-iam-policy-binding gs://bookit-media-prod \
  --member=allUsers \
  --role=roles/storage.objectViewer

# Staging — same commands with gs://bookit-media-staging
```

**CORS config** — create `infra/gcs-cors.json`:
```json
[{
  "origin": ["https://pt-duo-bookit-biz.web.app", "https://bookit-biz-staging.web.app"],
  "method": ["GET"],
  "responseHeader": ["Content-Type"],
  "maxAgeSeconds": 3600
}]
```
(No upload CORS needed — backend proxies the upload.)

**Cloud Run service account** needs `roles/storage.objectAdmin` on the bucket:
```bash
gcloud storage buckets add-iam-policy-binding gs://bookit-media-prod \
  --member=serviceAccount:<cloud-run-sa>@pt-duo-bookit.iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin
```

**Secret Manager** — add `GCS_BUCKET` secret for each environment:
```bash
echo -n "bookit-media-prod" | gcloud secrets create GCS_BUCKET --data-file=- --project=pt-duo-bookit
```

**Cloud Run deploy** — add `--set-secrets GCS_BUCKET=GCS_BUCKET:latest` to the deploy step in
`.github/workflows/api.yml`.

**`api/internal/platform/config/config.go`** — add `GCSBucket string` field read from `GCS_BUCKET` env var.

---

### Phase 4: Go GCS upload service `[PENDING]`

Create `api/internal/platform/storage/gcs.go`:

- `type GCSClient struct` — wraps `*storage.Client` and bucket name
- `func NewGCSClient(ctx, bucket) (*GCSClient, error)` — uses ADC (Application Default Credentials)
- `func (g *GCSClient) UploadFile(ctx, objectName string, r io.Reader, contentType string) (publicURL string, error)` — streams upload, returns `https://storage.googleapis.com/<bucket>/<object>`

GCS object naming: `businesses/<businessID>/logo.<ext>` (deterministic — re-upload overwrites).

---

### Phase 5: Go catalog domain `[PENDING]`

Create `api/internal/catalog/` package:

**`catalog.go`** — domain errors:
```go
var (
    ErrBusinessNotFound = errors.New("business not found")
    ErrNotOwner         = errors.New("not the business owner")
)
```

**`repository.go`** — pgx queries (5 methods):
- `Create(ctx, providerID UUID, name, category, description string, logoURL *string) (Business, error)`
- `GetByID(ctx, id UUID) (Business, error)`
- `ListByProviderID(ctx, providerID UUID, page, perPage int) ([]Business, int, error)`
- `Update(ctx, id UUID, fields map) (Business, error)` — COALESCE patch pattern
- `Delete(ctx, id UUID) error`
- `UpdateLogoURL(ctx, id UUID, logoURL string) (Business, error)`

**`service.go`** — ownership checks on all mutating operations:
- `CreateBusiness`, `GetBusiness`, `ListBusinesses`, `UpdateBusiness`, `DeleteBusiness`, `UploadLogo`
- `UploadLogo` calls GCSClient.UploadFile then UpdateLogoURL

**`handler.go`** — thin Gin handlers, RFC 7807 errors, reads providerID from auth context:
- `ListBusinesses`, `CreateBusiness`, `GetBusiness`, `UpdateBusiness`, `DeleteBusiness`, `UploadLogo`

`UploadLogo` handler:
1. Validates file size (max 5 MB) and type (image/jpeg, image/png, image/webp)
2. Calls service.UploadLogo
3. Returns updated Business (200)

---

### Phase 6: Register catalog routes in main.go `[PENDING]`

```go
gcsClient, err := storage.NewGCSClient(ctx, cfg.GCSBucket)
// handle err — fatal if GCSBucket is set, warn+skip if empty (local dev)

catalogRepo := catalog.NewRepository(db.Pool)
catalogService := catalog.NewService(catalogRepo, userRepo, gcsClient)
catalogHandler := catalog.NewHandler(catalogService)

biz := router.Group("/api/v1/businesses")
biz.Use(authHandler.AuthMiddleware())
{
    biz.GET("",      catalogHandler.ListBusinesses)
    biz.POST("",     catalogHandler.CreateBusiness)
    biz.GET("/:id",  catalogHandler.GetBusiness)
    biz.PUT("/:id",  catalogHandler.UpdateBusiness)
    biz.DELETE("/:id", catalogHandler.DeleteBusiness)
    biz.POST("/:id/logo", catalogHandler.UploadLogo)
}
```

Local dev: `GCS_BUCKET` is empty → GCSClient is nil → UploadLogo returns a "storage not configured" error (acceptable — logo upload can be skipped in local dev).

---

### Phase 7: Frontend — BusinessForm with file picker `[PENDING]`

Update `web/packages/biz/src/pages/BusinessForm.tsx`:
- Replace logo_url text field with image file picker
- On file select: preview with `URL.createObjectURL`
- On form submit:
  1. `POST /api/v1/businesses` — create business (name, category, description)
  2. If logo file selected: `POST /api/v1/businesses/:id/logo` — upload file
  3. Invalidate `['businesses']` query, navigate to `/dashboard/businesses`
- Show upload progress state

---

### Phase 8: Frontend — Edit business modal `[PENDING]`

Create `web/packages/biz/src/components/EditBusinessModal.tsx`:
- Pre-fills name, description, logo (shows current logo, allows replacement)
- On logo change: upload immediately via `POST /api/v1/businesses/:id/logo`
- On save: `PUT /api/v1/businesses/:id` (name, description, is_active)
- Invalidates `['businesses']` on success

Update `Businesses.tsx`:
- Enable Edit button on each BusinessCard
- Mount `EditBusinessModal` with selected business

---

### Phase 9: Frontend — Delete business `[PENDING]`

Update `Businesses.tsx`:
- Enable Delete button on each BusinessCard
- Inline confirm step: show "Delete [name]? This cannot be undone." with Cancel / Delete
- On confirm: `DELETE /api/v1/businesses/:id` via `useMutation`
- Optimistic removal from list + invalidate query on settle

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
