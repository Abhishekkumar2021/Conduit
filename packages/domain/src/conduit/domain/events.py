"""
Conduit Domain — Domain event definitions.

Events are emitted by services and consumed by event handlers.
They decouple cross-cutting concerns (audit, notifications, cache invalidation).
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID


@dataclass(frozen=True)
class DomainEvent:
    """Base domain event."""

    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ── Integration Events ──


@dataclass(frozen=True)
class IntegrationCreated(DomainEvent):
    workspace_id: UUID = field(default_factory=UUID)
    integration_id: UUID = field(default_factory=UUID)
    adapter_type: str = ""


@dataclass(frozen=True)
class IntegrationTested(DomainEvent):
    integration_id: UUID = field(default_factory=UUID)
    status: str = ""
    latency_ms: int = 0


# ── Pipeline Events ──


@dataclass(frozen=True)
class PipelineCreated(DomainEvent):
    workspace_id: UUID = field(default_factory=UUID)
    pipeline_id: UUID = field(default_factory=UUID)


@dataclass(frozen=True)
class RevisionPublished(DomainEvent):
    pipeline_id: UUID = field(default_factory=UUID)
    revision_id: UUID = field(default_factory=UUID)
    revision_number: int = 0


# ── Execution Events ──


@dataclass(frozen=True)
class RunStarted(DomainEvent):
    run_id: UUID = field(default_factory=UUID)
    pipeline_id: UUID = field(default_factory=UUID)
    runner_id: UUID | None = None


@dataclass(frozen=True)
class RunCompleted(DomainEvent):
    run_id: UUID = field(default_factory=UUID)
    status: str = ""
    duration_ms: int = 0


@dataclass(frozen=True)
class StepCompleted(DomainEvent):
    run_id: UUID = field(default_factory=UUID)
    stage_key: str = ""
    status: str = ""
    records_in: int = 0
    records_out: int = 0
    records_failed: int = 0


# ── Quality Events ──


@dataclass(frozen=True)
class RecordsQuarantined(DomainEvent):
    run_id: UUID = field(default_factory=UUID)
    pipeline_id: UUID = field(default_factory=UUID)
    count: int = 0
