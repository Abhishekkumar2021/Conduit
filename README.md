# Conduit

> A channel through which data flows.

Production-grade data integration platform. Clean. Extensible. No fluff.

## Architecture

```
Control Plane (Server + Console)    Data Plane (Runner)
┌─────────────────────────────┐    ┌──────────────────────┐
│  Console (React SPA)        │    │  Runner               │
│  Server  (FastAPI)          │    │  Engine (Adapters,     │
│  PostgreSQL · Redis         │    │    Transforms, DAG)    │
└─────────────────────────────┘    └──────────────────────┘
        ↕ Task Queue (Redis)              ↕ Data Systems
```

- **Server** — API gateway. Manages metadata: pipelines, integrations, runs, schedules.
- **Console** — React SPA. Clean, minimal UI for managing pipelines and monitoring runs.
- **Runner** — Executes pipeline runs. Lives where the data lives. Owns credentials.
- **Engine** — Adapters + transforms + DAG executor. Shared between runner and server.

## Quick Start

```bash
# First-time setup
conduit-dev setup

# Start all services + local infra (detached)
conduit-dev start --with-infra

# Run tests
conduit-dev test

# Run server tests with dockerized Postgres
conduit-dev test server --with-docker

# Inspect service/infra state and logs
conduit-dev status
tail -f .runtime/logs/server.log .runtime/logs/console.log .runtime/logs/runner.log

# Stop app services (and optionally infra)
conduit-dev stop
conduit-dev stop --with-infra
```

## Project Structure

```
conduit/
├── packages/
│   ├── domain/          # conduit.domain — entities, enums, protocols (zero deps)
│   └── engine/          # conduit.engine — adapters, transforms, DAG executor
├── server/              # FastAPI control plane
├── runner/              # Conduit Runner (data plane)
├── console/             # React console (UI)
└── tools/               # conduit-dev CLI
```

## Documentation

- [Architecture Blueprint](docs/architecture.md)
- [Contributing](docs/CONTRIBUTING.md)

## CI/CD

- `CI` workflow runs lint + tests + build checks on pull requests and pushes to `main`.
- Python jobs enforce a coverage gate of `>=90%` for `domain`, `engine`, `runner`, and `server`.
- `CD` workflow runs full verification, builds release artifacts, then:
  - deploys to `staging` on pushes to `main`
  - creates GitHub Releases on tags like `v1.2.3`
  - deploys to `production` on version tags or manual dispatch

Required GitHub configuration:

- Environments:
  - `staging`
  - `production` (recommended: require manual approval)
- Optional repository variables (for custom env names):
  - `STAGING_ENVIRONMENT` (defaults to `staging`)
  - `PRODUCTION_ENVIRONMENT` (defaults to `production`)
  - `DEPLOY_HEALTHCHECK_TIMEOUT_SECONDS` (defaults to `300`)
  - `DEPLOY_HEALTHCHECK_INTERVAL_SECONDS` (defaults to `10`)
- Environment secrets:
  - `staging`: `DEPLOY_WEBHOOK_URL`
  - `staging`: `DEPLOY_HEALTHCHECK_URL` (optional but recommended)
  - `production`: `DEPLOY_WEBHOOK_URL`
  - `production`: `DEPLOY_HEALTHCHECK_URL` (required)

## License

MIT
