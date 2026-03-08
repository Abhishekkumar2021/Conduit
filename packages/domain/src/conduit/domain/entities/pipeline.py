"""
Conduit Domain — Pipeline, Revision, Stage, and Edge entities.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from conduit.domain.enums import PipelineStatus, StageKind


@dataclass
class Pipeline:
    """A versioned DAG of stages that processes data."""

    id: UUID = field(default_factory=uuid4)
    workspace_id: UUID = field(default_factory=uuid4)
    name: str = ""
    description: str = ""
    status: PipelineStatus = PipelineStatus.DRAFT
    schedule_cron: str | None = None
    schedule_timezone: str = "UTC"
    published_revision_id: UUID | None = None
    runner_labels: list[str] = field(default_factory=list)
    created_by: UUID | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: datetime | None = None


@dataclass
class Revision:
    """An immutable snapshot of a pipeline's stage graph."""

    id: UUID = field(default_factory=uuid4)
    pipeline_id: UUID = field(default_factory=uuid4)
    number: int = 1
    summary: str = ""
    is_published: bool = False
    published_at: datetime | None = None
    created_by: UUID | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    stages: list["Stage"] = field(default_factory=list)
    edges: list["Edge"] = field(default_factory=list)


@dataclass
class Stage:
    """A single unit of work in a pipeline DAG."""

    id: UUID = field(default_factory=uuid4)
    revision_id: UUID = field(default_factory=uuid4)
    key: str = ""
    label: str = ""
    kind: StageKind = StageKind.EXTRACT
    integration_id: UUID | None = None
    config: dict = field(default_factory=dict)
    position_x: float = 0.0
    position_y: float = 0.0


@dataclass
class Edge:
    """A directed connection between two stages in a pipeline DAG."""

    id: UUID = field(default_factory=uuid4)
    revision_id: UUID = field(default_factory=uuid4)
    source_id: UUID = field(default_factory=uuid4)
    target_id: UUID = field(default_factory=uuid4)
