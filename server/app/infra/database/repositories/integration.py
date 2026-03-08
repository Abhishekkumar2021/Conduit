from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import Integration
from app.infra.database.repositories.base import BaseRepository


class IntegrationRepository(BaseRepository[Integration]):
    """Repository for Integration model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Integration, session)

    async def get_by_workspace(self, workspace_id: UUID) -> Sequence[Integration]:
        """Get all integrations for a workspace."""
        stmt = select(self.model).where(self.model.workspace_id == workspace_id)
        result = await self._session.execute(stmt)
        return result.scalars().all()
