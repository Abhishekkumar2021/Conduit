from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import Runner
from app.infra.database.repositories.base import BaseRepository


class RunnerRepository(BaseRepository[Runner]):
    """Repository for Runner model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Runner, session)

    async def get_by_workspace(self, workspace_id: UUID) -> Sequence[Runner]:
        """Get all runners in a workspace."""
        stmt = select(self.model).where(self.model.workspace_id == workspace_id)
        result = await self._session.execute(stmt)
        return result.scalars().all()
