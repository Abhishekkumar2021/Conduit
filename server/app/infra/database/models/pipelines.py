from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Pipeline(Base):
    __tablename__ = "pipelines"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id"))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(1000), server_default="")
    status: Mapped[str] = mapped_column(String(20), server_default="draft")
    schedule_cron: Mapped[str | None] = mapped_column(String(100))
    schedule_timezone: Mapped[str | None] = mapped_column(
        String(50), server_default="UTC"
    )
    published_revision_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "revisions.id", use_alter=True, name="fk_pipelines_published_revision"
        )
    )
    runner_labels: Mapped[list[str]] = mapped_column(
        ARRAY(Text), server_default=text("'{}'::text[]")
    )
    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("workspace_id", "name", name="uq_pipeline_workspace_name"),
        CheckConstraint(
            "status IN ('draft', 'active', 'paused', 'archived')",
            name="ck_pipeline_status",
        ),
        Index(
            "idx_pipelines_ws",
            "workspace_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="pipelines")
    revisions = relationship(
        "Revision",
        back_populates="pipeline",
        primaryjoin="Pipeline.id == Revision.pipeline_id",
    )
    runs = relationship("Run", back_populates="pipeline")


class Revision(Base):
    __tablename__ = "revisions"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    pipeline_id: Mapped[UUID] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE")
    )
    number: Mapped[int] = mapped_column(Integer)
    summary: Mapped[str | None] = mapped_column(String(500), server_default="")
    is_published: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    __table_args__ = (
        UniqueConstraint("pipeline_id", "number", name="uq_revision_pipeline_number"),
    )

    # Relationships
    pipeline = relationship(
        "Pipeline",
        back_populates="revisions",
        primaryjoin="Revision.pipeline_id == Pipeline.id",
    )
    stages = relationship("Stage", back_populates="revision")
    edges = relationship("Edge", back_populates="revision")


class Stage(Base):
    __tablename__ = "stages"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("revisions.id", ondelete="CASCADE")
    )
    key: Mapped[str] = mapped_column(String(100))
    label: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(20))
    integration_id: Mapped[UUID | None] = mapped_column(ForeignKey("integrations.id"))
    config: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    position_x: Mapped[float] = mapped_column(Float, server_default="0")
    position_y: Mapped[float] = mapped_column(Float, server_default="0")

    __table_args__ = (
        UniqueConstraint("revision_id", "key", name="uq_stage_revision_key"),
        CheckConstraint(
            "kind IN ('extract', 'transform', 'load', 'gate')", name="ck_stage_kind"
        ),
    )

    # Relationships
    revision = relationship("Revision", back_populates="stages")


class Edge(Base):
    __tablename__ = "edges"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("revisions.id", ondelete="CASCADE")
    )
    source_id: Mapped[UUID] = mapped_column(ForeignKey("stages.id", ondelete="CASCADE"))
    target_id: Mapped[UUID] = mapped_column(ForeignKey("stages.id", ondelete="CASCADE"))

    __table_args__ = (
        UniqueConstraint(
            "revision_id",
            "source_id",
            "target_id",
            name="uq_edge_revision_source_target",
        ),
        CheckConstraint("source_id != target_id", name="ck_edge_cycles"),
    )

    # Relationships
    revision = relationship("Revision", back_populates="edges")
