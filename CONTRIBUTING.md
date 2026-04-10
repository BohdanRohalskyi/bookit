# Contributing to Bookit

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- Git
- [Claude Code](https://claude.ai/code) (strongly recommended — the project is set up for it)

---

## First-time setup

```bash
git clone https://github.com/BohdanRohalskyi/bookit.git
cd bookit
docker compose up
```

Verify everything is running:

| Check | Command |
|-------|---------|
| API healthy | `curl http://localhost:8080/api/v1/health` → `{"status":"ok"}` |
| Consumer app | open http://localhost:5173 |
| Business app | open http://localhost:5174 |
| Mailpit (email) | open http://localhost:8025 |

The API runs database migrations automatically on startup. No manual DB setup needed.

### Frontend env vars (optional for local)

Docker Compose injects the required env vars automatically. If you run the frontend
outside Docker, copy the example:

```bash
cp web/.env.example web/packages/consumer/.env.local
cp web/.env.example web/packages/biz/.env.local
```

Firebase vars can stay blank locally — feature flags will default to `false`.

---

## Claude Code setup

Open Claude Code at the project root. Before first use, make sure your git email is set — it's used for plan ownership:

```bash
git config user.email   # should return your email
git config --global user.email "you@example.com"   # set it if empty
```

The following files load automatically:

| File | Loaded when |
|------|-------------|
| `CLAUDE.md` | Always — git flow, architecture, domains, plan workflow |
| `api/CLAUDE.md` | Working in `api/` — Go conventions, domain structure |
| `web/CLAUDE.md` | Working in `web/` — monorepo layout, design tokens, rules |

### Slash commands

| Command | Use it for |
|---------|-----------|
| `/plan` | Designing a new feature — creates a structured plan with feature flag phase |
| `/new-branch` | Create a feature branch from an up-to-date `main` |
| `/code-react` | React/TypeScript implementation — loads all frontend conventions |
| `/code-go` | Go backend implementation — loads all backend conventions |
| `/open-plan` | Open an existing implementation plan by description |

Start every new feature with `/plan`. It will ask clarifying questions and produce
a `docs/implementation-plans/new/<feature>.md` file with the right structure.

---

## Git flow

```
main  ←──── your PR (auto-deploys to staging for review)
 └── feat/your-feature-name  ← work here
```

1. **Branch from `main`** (or let Claude do it with `/new-branch`):
   ```bash
   git checkout main && git pull
   git checkout -b feat/your-feature-name
   ```

2. **Open a PR to `main`** — GitHub Actions automatically deploys to staging:
   - API → `bookit-api-staging`
   - Consumer web → https://bookit-staging.web.app

3. **Test on staging** before requesting review.

4. **Merge** → auto-deploys to production.

> Never commit directly to `main`.

Pre-push hooks run `golangci-lint` (API changes) and `tsc + eslint` (web changes) automatically.

---

## Feature flags

**Every new user-facing feature must ship behind a feature flag.** This lets you merge
and deploy incomplete work safely, and roll back without a redeploy.

We use Firebase Remote Config. The `/plan` command walks you through which flag type to use:

| Feature scope | Flag type |
|---------------|-----------|
| Frontend only | Client flag — `useFeatureFlag(FLAGS.MY_FLAG)` |
| Backend only | Server flag — `h.flags.IsEnabled(ctx, "my_flag")` |
| Both | Same key on both sides |

Register all flags in `web/packages/shared/src/features/flags.ts`:

```ts
export const FLAGS = {
  FEATURE_TEST: 'feature_test', // existing
  MY_FEATURE:   'my_feature',   // ← add yours here
} as const
```

Enable in Firebase Console → Remote Config → add the string key → set to `true`.

---

## Code conventions

Full conventions are in the subdirectory CLAUDE.md files, and loaded automatically by Claude Code:

- **Go backend:** [`api/CLAUDE.md`](./api/CLAUDE.md)
- **React frontend:** [`web/CLAUDE.md`](./web/CLAUDE.md)

Key rules at a glance:

| Rule | Why |
|------|-----|
| Update `api/openapi/spec.yaml` before writing handlers | Single source of truth for types |
| Never use `<h1>`/`<h2>` in React | Global CSS overrides their color/size |
| Never use axios | Use openapi-fetch from `@bookit/shared/api` |
| Always RFC 7807 error format in Go | API contract |
| Feature flag first | Safe deployment |

---

## PR checklist

Before opening a PR:

- [ ] Feature is behind a flag (or explicitly not user-facing)
- [ ] `curl http://localhost:8080/api/v1/health` passes
- [ ] API changes: `cd api && go build ./... && go vet ./...`
- [ ] Web changes: `cd web && npm run typecheck`
- [ ] Tested on local Docker setup end-to-end
- [ ] Implementation plan updated (if one exists for this feature)
