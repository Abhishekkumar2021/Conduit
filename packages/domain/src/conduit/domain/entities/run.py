"""
Conduit Domain — Run, Step, and Quarantine entities.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from conduit.domain.enums import (
    QuarantineResolution,
    RunStatus,
    StepStatus,
    TriggerType,
)


@dataclass
class Run:
    """A single execution of a pipeline revision."""

    id: UUID = field(default_factory=uuid4)
    pipeline_id: UUID = field(default_factory=uuid4)
    revision_id: UUID = field(default_factory=uuid4)
    workspace_id: UUID = field(default_factory=uuid4)
    runner_id: UUID | None = None
    status: RunStatus = RunStatus.PENDING
    trigger_type: TriggerType = TriggerType.MANUAL
    is_dry_run: bool = False
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    error_message: str | None = None
    triggered_by: UUID | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Step:
    """The execution trace of one stage within a run."""

    id: UUID = field(default_factory=uuid4)
    run_id: UUID = field(default_factory=uuid4)
    stage_key: str = ""
    stage_kind: str = ""
    status: StepStatus = StepStatus.PENDING
    records_in: int = 0
    records_out: int = 0
    records_failed: int = 0
    bytes_processed: int = 0
    checkpoint: dict | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    error_message: str | None = None


@dataclass
class QuarantinedRecord:
    """A record that failed a quality gate, awaiting manual review."""

    id: UUID = field(default_factory=uuid4)
    workspace_id: UUID = field(default_factory=uuid4)
    pipeline_id: UUID = field(default_factory=uuid4)
    run_id: UUID = field(default_factory=uuid4)
    step_id: UUID = field(default_factory=uuid4)
    record_data: dict = field(default_factory=dict)
    quality_score: int = 0
    failed_rules: list[dict] = field(default_factory=list)
    resolution: QuarantineResolution = QuarantineResolution.PENDING
    resolved_by: UUID | None = None
    resolved_at: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
