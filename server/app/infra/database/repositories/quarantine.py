from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import Quarantine
from app.infra.database.repositories.base import BaseRepository


class QuarantineRepository(BaseRepository[Quarantine]):
    """Repository for Quarantine model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Quarantine, session)

    async def get_unresolved_by_workspace(
        self, workspace_id: UUID
    ) -> Sequence[Quarantine]:
        """Get all unresolved quarantine items for a workspace."""
        stmt = (
            select(self.model)
            .where(
                self.model.workspace_id == workspace_id,
                self.model.resolution == "pending",
            )
            .order_by(self.model.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()
