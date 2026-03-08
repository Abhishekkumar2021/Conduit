"""
Conduit Domain — Enumerations.

All status values, kinds, and categorical types used across the system.
Every enum is the single source of truth for its domain.
"""

from enum import StrEnum, auto


# ── Identity ──


class MemberRole(StrEnum):
    """Workspace membership roles (ordered by privilege)."""

    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class AuthProvider(StrEnum):
    """Supported authentication providers."""

    LOCAL = "local"
    GOOGLE = "google"
    OIDC = "oidc"


# ── Integrations ──


class AdapterCategory(StrEnum):
    """Adapter classification for grouping in the UI."""

    SQL = "sql"
    NOSQL = "nosql"
    STORAGE = "storage"
    API = "api"


class IntegrationStatus(StrEnum):
    """Health status of an integration (set after test)."""

    UNTESTED = "untested"
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNREACHABLE = "unreachable"


class VaultStatus(StrEnum):
    """Whether the runner has credentials configured for an integration."""

    NOT_CONFIGURED = "not_configured"
    CONFIGURED = "configured"
    ERROR = "error"


class AssetType(StrEnum):
    """Type of data asset discovered in a catalog."""

    TABLE = "table"
    VIEW = "view"
    FILE = "file"
    COLLECTION = "collection"
    ENDPOINT = "endpoint"


# ── Pipelines ──


class PipelineStatus(StrEnum):
    """Lifecycle status of a pipeline."""

    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class StageKind(StrEnum):
    """Type of processing stage in a pipeline DAG."""

    EXTRACT = "extract"
    TRANSFORM = "transform"
    LOAD = "load"
    GATE = "gate"


# ── Execution ──


class RunnerStatus(StrEnum):
    """Online status of a runner."""

    ONLINE = "online"
    BUSY = "busy"
    OFFLINE = "offline"


class RunStatus(StrEnum):
    """Execution status of a pipeline run."""

    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(StrEnum):
    """Execution status of a single stage within a run."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    SKIPPED = "skipped"


class TriggerType(StrEnum):
    """How a pipeline run was initiated."""

    MANUAL = "manual"
    SCHEDULE = "schedule"
    API = "api"


# ── Quality ──


class QuarantineResolution(StrEnum):
    """Resolution status of a quarantined record."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
