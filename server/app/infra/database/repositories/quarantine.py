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
        self,
        workspace_id: UUID,
        limit: int = 100,
        pipeline_id: UUID | None = None,
    ) -> Sequence[Quarantine]:
        """Get unresolved quarantine items for a workspace."""
        stmt = (
            select(self.model)
            .where(
                self.model.workspace_id == workspace_id,
                self.model.resolution == "pending",
            )
        )
        if pipeline_id:
            stmt = stmt.where(self.model.pipeline_id == pipeline_id)
        stmt = stmt.order_by(self.model.created_at.desc()).limit(limit)
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def get_by_run(self, run_id: UUID) -> Sequence[Quarantine]:
        """Get all quarantine items for a specific run."""
        stmt = (
            select(self.model)
            .where(self.model.run_id == run_id)
            .order_by(self.model.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()
