"""
Conduit Domain — Workspace and User entities.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from conduit.domain.enums import AuthProvider, MemberRole


@dataclass
class User:
    """A registered user."""

    id: UUID = field(default_factory=uuid4)
    email: str = ""
    display_name: str = ""
    password_hash: str | None = None
    auth_provider: AuthProvider = AuthProvider.LOCAL
    is_active: bool = True
    last_login_at: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Workspace:
    """A tenancy boundary. All entities belong to exactly one workspace."""

    id: UUID = field(default_factory=uuid4)
    name: str = ""
    slug: str = ""
    created_by: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Member:
    """A user's membership in a workspace."""

    workspace_id: UUID = field(default_factory=uuid4)
    user_id: UUID = field(default_factory=uuid4)
    role: MemberRole = MemberRole.VIEWER
    joined_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
