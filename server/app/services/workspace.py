"""
Conduit Server — Workspace service.
"""

import logging
from typing import Sequence
from uuid import UUID

from app.infra.database.models import Member, Workspace
from app.infra.database.repositories.member import MemberRepository
from app.infra.database.repositories.workspace import WorkspaceRepository

logger = logging.getLogger(__name__)


class WorkspaceService:
    def __init__(
        self, workspace_repo: WorkspaceRepository, member_repo: MemberRepository
    ):
        self.workspace_repo = workspace_repo
        self.member_repo = member_repo

    async def create_workspace(self, name: str, slug: str, owner_id: UUID) -> Workspace:
        """Create a new workspace and assign the owner."""
        existing = await self.workspace_repo.get_by_slug(slug)
        if existing:
            raise ValueError(f"Workspace with slug '{slug}' already exists")

        workspace = await self.workspace_repo.create(
            {"name": name, "slug": slug, "created_by": owner_id}
        )

        # Add the creator as the owner
        await self.member_repo.create(
            {
                "user_id": owner_id,
                "workspace_id": workspace.id,
                "role": "owner",
            },
        )
        logger.info(f"Workspace '{slug}' created by user {owner_id}")
        return workspace

    async def get_workspace(self, id: UUID) -> Workspace | None:
        """Get workspace by ID."""
        return await self.workspace_repo.get(id)

    async def get_user_workspaces(self, user_id: UUID) -> Sequence[Member]:
        """List all workspaces a user belongs to."""
        return await self.member_repo.get_user_workspaces(user_id)
