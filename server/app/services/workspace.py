"""
Conduit Server — Workspace service.
"""

import logging
from typing import Sequence
from uuid import UUID

from app.infra.database.models import (
    AuditLog,
    Integration,
    Member,
    Pipeline,
    Quarantine,
    Run,
    Runner,
    Step,
    Workspace,
)
from app.infra.database.repositories.member import MemberRepository
from app.infra.database.repositories.workspace import WorkspaceRepository
from conduit.domain.errors import DuplicateError

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
            raise DuplicateError("Workspace", slug)

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
        logger.info("Workspace '%s' created by user %s", slug, owner_id)
        return workspace

    async def get_workspace(self, id: UUID) -> Workspace | None:
        """Get workspace by ID."""
        return await self.workspace_repo.get(id)

    async def update_workspace(self, id: UUID, **kwargs) -> Workspace | None:
        """Update workspace details."""
        workspace = await self.workspace_repo.update(id, kwargs)
        if workspace:
            logger.info("Workspace %s updated", id)
        return workspace

    async def delete_workspace(self, id: UUID) -> bool:
        """Delete a workspace and all dependent data."""
        from sqlalchemy import delete as sa_delete
        from sqlalchemy import select as sa_select

        session = self.workspace_repo._session

        # Delete quarantine records
        await session.execute(
            sa_delete(Quarantine).where(Quarantine.workspace_id == id)
        )

        # Delete steps for runs in this workspace
        run_ids_result = await session.execute(
            sa_select(Run.id).where(Run.workspace_id == id)
        )
        run_ids = [r[0] for r in run_ids_result.all()]
        if run_ids:
            await session.execute(
                sa_delete(Step).where(Step.run_id.in_(run_ids))
            )

        # Delete runs
        await session.execute(
            sa_delete(Run).where(Run.workspace_id == id)
        )

        # Clear published_revision_id on all pipelines to avoid circular FK
        from sqlalchemy import update as sa_update
        await session.execute(
            sa_update(Pipeline)
            .where(Pipeline.workspace_id == id)
            .values(published_revision_id=None)
        )

        # Delete pipelines (revisions/stages/edges cascade via FK)
        await session.execute(
            sa_delete(Pipeline).where(Pipeline.workspace_id == id)
        )

        # Delete integrations (assets/asset_events cascade via FK)
        await session.execute(
            sa_delete(Integration).where(Integration.workspace_id == id)
        )

        # Delete runners
        await session.execute(
            sa_delete(Runner).where(Runner.workspace_id == id)
        )

        # Delete audit log
        await session.execute(
            sa_delete(AuditLog).where(AuditLog.workspace_id == id)
        )

        success = await self.workspace_repo.delete(id)
        if success:
            logger.info("Workspace %s deleted", id)
        return success

    async def get_user_workspaces(self, user_id: UUID) -> Sequence[Member]:
        """List all workspaces a user belongs to."""
        return await self.member_repo.get_user_workspaces(user_id)
