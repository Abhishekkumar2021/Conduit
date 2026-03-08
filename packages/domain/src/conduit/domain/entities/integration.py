"""
Conduit Domain — Integration and Asset entities.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from conduit.domain.enums import AssetType, IntegrationStatus, VaultStatus


@dataclass
class Integration:
    """A named reference to an external data system."""

    id: UUID = field(default_factory=uuid4)
    workspace_id: UUID = field(default_factory=uuid4)
    name: str = ""
    adapter_type: str = ""
    description: str = ""
    vault_status: VaultStatus = VaultStatus.NOT_CONFIGURED
    status: IntegrationStatus = IntegrationStatus.UNTESTED
    status_message: str | None = None
    status_checked_at: datetime | None = None
    runner_labels: list[str] = field(default_factory=list)
    created_by: UUID | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: datetime | None = None


@dataclass
class Asset:
    """A single addressable data object within an integration's catalog."""

    id: UUID = field(default_factory=uuid4)
    integration_id: UUID = field(default_factory=uuid4)
    workspace_id: UUID = field(default_factory=uuid4)
    qualified_name: str = ""
    asset_type: AssetType = AssetType.TABLE
    schema_info: dict = field(default_factory=dict)
    contract: dict = field(default_factory=dict)
    row_count: int | None = None
    size_bytes: int | None = None
    discovered_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
