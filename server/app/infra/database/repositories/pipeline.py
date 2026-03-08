from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import Edge, Pipeline, Revision, Stage
from app.infra.database.repositories.base import BaseRepository


class PipelineRepository(BaseRepository[Pipeline]):
    """Repository for Pipeline model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Pipeline, session)

    async def get_by_workspace(self, workspace_id: UUID) -> Sequence[Pipeline]:
        """Get all pipelines in a workspace."""
        stmt = select(self.model).where(self.model.workspace_id == workspace_id)
        result = await self._session.execute(stmt)
        return result.scalars().all()


class RevisionRepository(BaseRepository[Revision]):
    """Repository for Revision model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Revision, session)

    async def get_by_pipeline(self, pipeline_id: UUID) -> Sequence[Revision]:
        """Get all revisions for a pipeline, newest first."""
        stmt = (
            select(self.model)
            .options(selectinload(self.model.stages), selectinload(self.model.edges))
            .where(self.model.pipeline_id == pipeline_id)
            .order_by(self.model.number.desc())
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def get_by_id_with_relations(self, revision_id: UUID) -> Revision | None:
        """Get a single revision with stages and edges eagerly loaded."""
        stmt = (
            select(self.model)
            .options(selectinload(self.model.stages), selectinload(self.model.edges))
            .where(self.model.id == revision_id)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()


class StageRepository(BaseRepository[Stage]):
    """Repository for Stage model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Stage, session)

    async def get_by_revision(self, revision_id: UUID) -> Sequence[Stage]:
        """Get all stages for a specific revision."""
        stmt = select(self.model).where(self.model.revision_id == revision_id)
        result = await self._session.execute(stmt)
        return result.scalars().all()


class EdgeRepository(BaseRepository[Edge]):
    """Repository for Edge model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Edge, session)

    async def get_by_revision(self, revision_id: UUID) -> Sequence[Edge]:
        """Get all edges for a specific revision."""
        stmt = select(self.model).where(self.model.revision_id == revision_id)
        result = await self._session.execute(stmt)
        return result.scalars().all()
