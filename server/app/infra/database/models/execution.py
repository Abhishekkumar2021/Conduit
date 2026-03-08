from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Runner(Base):
    __tablename__ = "runners"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id"))
    name: Mapped[str] = mapped_column(String(100))
    client_id: Mapped[str] = mapped_column(String(100), unique=True)
    status: Mapped[str] = mapped_column(String(20), server_default="offline")
    version: Mapped[str | None] = mapped_column(String(30))
    host_info: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    labels: Mapped[list[str]] = mapped_column(
        ARRAY(Text), server_default=text("'{}'::text[]")
    )
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(
            "status IN ('online', 'busy', 'offline')", name="ck_runner_status"
        ),
        Index(
            "idx_runners_ws",
            "workspace_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    pipeline_id: Mapped[UUID] = mapped_column(ForeignKey("pipelines.id"))
    revision_id: Mapped[UUID] = mapped_column(ForeignKey("revisions.id"))
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id"))
    runner_id: Mapped[UUID | None] = mapped_column(ForeignKey("runners.id"))
    status: Mapped[str] = mapped_column(String(20), server_default="pending")
    trigger_type: Mapped[str] = mapped_column(String(20), server_default="manual")
    is_dry_run: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
    triggered_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled')",
            name="ck_run_status",
        ),
        CheckConstraint(
            "trigger_type IN ('manual', 'schedule', 'api')", name="ck_run_trigger"
        ),
        Index("idx_runs_pipeline", "pipeline_id", "created_at"),
        Index("idx_runs_ws", "workspace_id", "created_at"),
    )

    # Relationships
    pipeline = relationship("Pipeline", back_populates="runs")
    steps = relationship("Step", back_populates="run")


class Step(Base):
    __tablename__ = "steps"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    run_id: Mapped[UUID] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"))
    stage_key: Mapped[str] = mapped_column(String(100))
    stage_kind: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), server_default="pending")
    records_in: Mapped[int] = mapped_column(Integer, server_default="0")
    records_out: Mapped[int] = mapped_column(Integer, server_default="0")
    records_failed: Mapped[int] = mapped_column(Integer, server_default="0")
    bytes_processed: Mapped[int] = mapped_column(BigInteger, server_default="0")
    checkpoint: Mapped[dict | None] = mapped_column(JSONB)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'running', 'succeeded', 'failed', 'skipped')",
            name="ck_step_status",
        ),
        Index("idx_steps_run", "run_id"),
    )

    # Relationships
    run = relationship("Run", back_populates="steps")
