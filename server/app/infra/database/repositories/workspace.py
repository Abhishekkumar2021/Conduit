from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import Workspace
from app.infra.database.repositories.base import BaseRepository


class WorkspaceRepository(BaseRepository[Workspace]):
    """Repository for Workspace model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Workspace, session)

    async def get_by_slug(self, slug: str) -> Workspace | None:
        """Get a workspace by its URL slug."""
        stmt = select(self.model).where(self.model.slug == slug)
        result = await self._session.execute(stmt)
        return result.scalars().first()
