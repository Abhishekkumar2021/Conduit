# Conduit

> A channel through which data flows.

Production-grade data integration platform. Clean. Extensible. No fluff.

## Architecture

```
Control Plane (Server + Console)    Data Plane (Runner)
┌─────────────────────────────┐    ┌──────────────────────┐
│  Console (React SPA)        │    │  Runner Daemon        │
│  Server  (FastAPI)          │    │  Engine (Adapters,    │
│  PostgreSQL                 │    │    Processors, DAG)   │
└─────────────────────────────┘    └──────────────────────┘
        ↕ HTTP (Poll/Claim)               ↕ Data Systems
```

- **Server** — API gateway. Manages metadata: pipelines, integrations, runs.
- **Console** — React SPA. Clean, minimal UI for managing pipelines and monitoring runs.
- **Runner** — Standalone daemon. Polls the API for pending runs, executes pipeline graphs.
- **Engine** — Adapters + processors + quality gates + DAG executor. Shared library.
- **Domain** — Pure domain model. Entities, enums, errors, protocols. Zero I/O.

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
│   └── engine/          # conduit.engine — adapters, processors, quality, DAG executor
├── server/              # FastAPI control plane
├── runner/              # Conduit Runner daemon (data plane)
├── console/             # React console (UI)
└── tools/               # conduit-dev CLI
```

## Execution Model

1. User designs a pipeline in the Console (visual DAG builder)
2. Pipeline revision is published via the Server API
3. A run is triggered (manual, schedule, or API)
4. Runner daemon claims the run via `POST /runs/claim` (row-level locking prevents races)
5. Engine builds the DAG, executes nodes in topological order:
   - **Extract** — read batches from source adapters
   - **Transform/Processor** — apply registered processors (filter, map, cast, etc.)
   - **Gate** — score records against quality rules, quarantine failures
   - **Load** — write batches to target adapters
6. Runner reports final status back to the Server

## CI/CD

- `CI` workflow runs lint + tests + build checks on pull requests and pushes to `main`.
- Python jobs enforce a coverage gate of `>=90%` for `domain`, `engine`, `runner`, and `server`.
- `CD` workflow runs full verification, builds release artifacts, then:
  - deploys to `staging` on pushes to `main`
  - creates GitHub Releases on tags like `v1.2.3`
  - deploys to `production` on version tags or manual dispatch

## License

MIT
