# Bookit API

Go backend for the Bookit multi-vertical booking platform.

## Prerequisites

- Go 1.22+
- Docker and Docker Compose
- Make

## Quick Start

### Using Docker Compose (recommended)

```bash
# From project root
docker-compose up
```

The API will be available at `http://localhost:8080`.

### Manual Setup

1. Start PostgreSQL:
```bash
docker-compose up db
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Run the server:
```bash
make run
```

## Make Targets

| Target | Description |
|--------|-------------|
| `make tools` | Install development tools |
| `make generate` | Generate code from OpenAPI spec |
| `make build` | Build binary |
| `make test` | Run tests |
| `make lint` | Run linter |
| `make security` | Run security scans |
| `make run` | Run locally |
| `make ci` | Run all CI checks |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENVIRONMENT` | Yes | - | `local`, `staging`, or `prod` |
| `API_PORT` | No | `8080` | Server port |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `JWT_SECRET` | Yes | - | JWT signing key |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `GCP_PROJECT` | No | - | GCP project ID |

## Project Structure

```
api/
├── cmd/server/          # Application entry point
├── internal/
│   ├── api/             # Generated API handlers
│   └── platform/        # Shared infrastructure
│       ├── config/      # Configuration loading
│       └── database/    # Database connection
├── migrations/          # SQL migrations
├── openapi/             # OpenAPI specification
└── Makefile
```

## API Endpoints

- `GET /api/v1/health` - Health check

## Deployment

The API is deployed to GCP Cloud Run via GitHub Actions:

- `main` branch → `bookit-api-prod`
- `develop` branch → `bookit-api-staging`
