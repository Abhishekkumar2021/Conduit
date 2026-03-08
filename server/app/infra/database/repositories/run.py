from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import Run, Step
from app.infra.database.repositories.base import BaseRepository


class RunRepository(BaseRepository[Run]):
    """Repository for Run model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Run, session)

    async def get_by_pipeline(
        self, pipeline_id: UUID, limit: int = 50
    ) -> Sequence[Run]:
        """Get recent runs for a pipeline."""
        stmt = (
            select(self.model)
            .where(self.model.pipeline_id == pipeline_id)
            .order_by(self.model.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def get_by_workspace(
        self, workspace_id: UUID, limit: int = 50
    ) -> Sequence[Run]:
        """Get recent runs in a workspace."""
        stmt = (
            select(self.model)
            .where(self.model.workspace_id == workspace_id)
            .order_by(self.model.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()


class StepRepository(BaseRepository[Step]):
    """Repository for Step model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Step, session)

    async def get_by_run(self, run_id: UUID) -> Sequence[Step]:
        """Get all steps for a specific run."""
        stmt = select(self.model).where(self.model.run_id == run_id)
        result = await self._session.execute(stmt)
        return result.scalars().all()
