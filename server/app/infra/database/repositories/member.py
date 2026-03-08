from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import Member
from app.infra.database.repositories.base import BaseRepository


class MemberRepository(BaseRepository[Member]):
    """Repository for Member model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Member, session)

    async def get_by_user_and_workspace(
        self, user_id: UUID, workspace_id: UUID
    ) -> Member | None:
        """Get a member association by user and workspace."""
        stmt = select(self.model).where(
            self.model.user_id == user_id, self.model.workspace_id == workspace_id
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_user_workspaces(self, user_id: UUID) -> Sequence[Member]:
        """Get all workspace memberships for a user."""
        stmt = select(self.model).where(self.model.user_id == user_id)
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def get_workspace_members(self, workspace_id: UUID) -> Sequence[Member]:
        """Get all members of a specific workspace."""
        stmt = select(self.model).where(self.model.workspace_id == workspace_id)
        result = await self._session.execute(stmt)
        return result.scalars().all()
