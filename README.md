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

# Start all services (server + runner + console)
conduit-dev start

# Run tests
conduit-dev test

# Run server tests with dockerized Postgres
conduit-dev test server --with-docker
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

## License

MIT
