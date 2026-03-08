from typing import Sequence
from uuid import UUID

from sqlalchemy import String, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import Pipeline, Run, Step
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
        self,
        workspace_id: UUID,
        limit: int = 50,
        status: str | None = None,
        trigger_type: str | None = None,
        search: str | None = None,
    ) -> Sequence[Run]:
        """Get recent runs in a workspace."""
        stmt = (
            select(self.model)
            .join(Pipeline, Pipeline.id == self.model.pipeline_id)
            .where(self.model.workspace_id == workspace_id)
        )

        if status:
            stmt = stmt.where(self.model.status == status)
        if trigger_type:
            stmt = stmt.where(self.model.trigger_type == trigger_type)
        if search:
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Pipeline.name.ilike(term),
                    cast(self.model.id, String).ilike(term),
                )
            )

        stmt = stmt.order_by(self.model.created_at.desc()).limit(limit)
        result = await self._session.execute(stmt)
        return result.scalars().all()


class StepRepository(BaseRepository[Step]):
    """Repository for Step model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Step, session)

    async def get_by_run(self, run_id: UUID) -> Sequence[Step]:
        """Get all steps for a specific run."""
        stmt = (
            select(self.model)
            .where(self.model.run_id == run_id)
            .order_by(self.model.started_at.asc().nullslast(), self.model.id.asc())
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()
