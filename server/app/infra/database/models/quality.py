from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Quarantine(Base):
    __tablename__ = "quarantine"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id"))
    pipeline_id: Mapped[UUID] = mapped_column(ForeignKey("pipelines.id"))
    run_id: Mapped[UUID] = mapped_column(ForeignKey("runs.id"))
    step_id: Mapped[UUID] = mapped_column(ForeignKey("steps.id"))
    record_data: Mapped[dict] = mapped_column(JSONB)
    quality_score: Mapped[int] = mapped_column(SmallInteger)
    failed_rules: Mapped[dict] = mapped_column(JSONB)
    resolution: Mapped[str] = mapped_column(String(20), server_default="pending")
    resolved_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    __table_args__ = (
        CheckConstraint("quality_score BETWEEN 0 AND 100", name="ck_quarantine_score"),
        CheckConstraint(
            "resolution IN ('pending', 'approved', 'rejected')",
            name="ck_quarantine_resolution",
        ),
        Index("idx_quarantine_ws", "workspace_id", "resolution", "created_at"),
    )


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id"))
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50))
    entity_type: Mapped[str] = mapped_column(String(30))
    entity_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True))
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    __table_args__ = (Index("idx_audit_ws", "workspace_id", "created_at"),)
