from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Integration(Base):
    __tablename__ = "integrations"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id"))
    name: Mapped[str] = mapped_column(String(100))
    adapter_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(String(500), server_default="")
    vault_status: Mapped[str] = mapped_column(
        String(20), server_default="not_configured"
    )
    config: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    status: Mapped[str] = mapped_column(String(20), server_default="untested")
    status_message: Mapped[str | None] = mapped_column(String(500))
    status_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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
        UniqueConstraint("workspace_id", "name", name="uq_integration_workspace_name"),
        CheckConstraint(
            "vault_status IN ('not_configured', 'configured', 'error')",
            name="ck_vault_status",
        ),
        CheckConstraint(
            "status IN ('untested', 'healthy', 'degraded', 'unreachable')",
            name="ck_int_status",
        ),
        Index(
            "idx_integrations_ws",
            "workspace_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="integrations")
    assets = relationship("Asset", back_populates="integration")


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    integration_id: Mapped[UUID] = mapped_column(
        ForeignKey("integrations.id", ondelete="CASCADE")
    )
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id"))
    qualified_name: Mapped[str] = mapped_column(String(500))
    asset_type: Mapped[str] = mapped_column(String(20))
    schema_info: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    contract: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    row_count: Mapped[int | None] = mapped_column(BigInteger)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    __table_args__ = (
        UniqueConstraint(
            "integration_id", "qualified_name", name="uq_asset_integration_name"
        ),
        CheckConstraint(
            "asset_type IN ('table', 'view', 'file', 'collection', 'endpoint', 'object', 'index', 'key')",
            name="ck_asset_type",
        ),
    )

    # Relationships
    integration = relationship("Integration", back_populates="assets")
    events = relationship("AssetEvent", back_populates="asset")


class AssetEvent(Base):
    __tablename__ = "asset_events"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    asset_id: Mapped[UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"))
    event_type: Mapped[str] = mapped_column(String(30))
    details: Mapped[dict] = mapped_column(JSONB)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    __table_args__ = (Index("idx_asset_events", "asset_id", "detected_at"),)

    # Relationships
    asset = relationship("Asset", back_populates="events")
