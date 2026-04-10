# Bookit API

Go backend for the Bookit multi-vertical booking platform.

## Prerequisites

- Go 1.22+
- Docker and Docker Compose

## Quick Start

### Using Docker Compose (recommended)

```bash
# From project root
docker compose up
```

The API will be available at `http://localhost:8080`.

### Manual Setup

1. Start PostgreSQL and Mailpit:
```bash
docker compose up db mailpit
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Run the server:
```bash
go run cmd/server/main.go
```

## Make Targets

Run these from the **project root**:

| Target | Description |
|--------|-------------|
| `make up` | Start all services |
| `make test` | Run tests |
| `make lint` | Run golangci-lint |
| `make migrate` | Run pending migrations |
| `make migrate-down` | Rollback 1 migration |
| `make migrate-create name=<name>` | Create a new migration file |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENVIRONMENT` | Yes | — | `local`, `staging`, or `prod` |
| `API_PORT` | No | `8080` | Server port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | JWT signing key |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `APP_URL` | Yes | — | Consumer app origin (for CORS) |
| `CORS_ALLOWED_ORIGINS` | Yes | — | Comma-separated allowed origins |
| `MAIL_PROVIDER` | Yes | — | `smtp` or `sendgrid` |
| `SMTP_HOST` / `SMTP_PORT` | No | — | Required when `MAIL_PROVIDER=smtp` |
| `MAIL_FROM` | Yes | — | Sender address |
| `GCP_PROJECT` | No | — | GCP project ID (for Firebase flags) |

## Project Structure

```
api/
├── cmd/server/             # Entry point
├── internal/
│   ├── api/                # Generated types (types.gen.go) + handler registration
│   ├── config/             # Env-based config
│   ├── database/           # DB pool + migration runner
│   ├── logger/             # Structured logger
│   ├── middleware/         # Auth, CORS, request logging
│   ├── flags/              # Feature flag service (Firebase Admin SDK)
│   └── domain/
│       ├── identity/       # Auth, users
│       ├── catalog/        # Businesses, services, staff
│       ├── scheduling/     # Availability, slots
│       ├── booking/        # Appointments
│       ├── payment/        # Transactions
│       └── notification/   # Email
├── migrations/             # SQL migration files (embedded)
└── openapi/spec.yaml       # API contract — source of truth
```

## Deployment

The API is deployed to GCP Cloud Run via GitHub Actions:

- PR to `main` → `bookit-api-staging` (auto-deploys on PR open)
- Merged to `main` → `bookit-api-prod` (auto-deploys on merge)
