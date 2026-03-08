from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import AuditLog
from app.infra.database.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository[AuditLog]):
    """Repository for AuditLog model."""

    def __init__(self, session: AsyncSession):
        super().__init__(AuditLog, session)

    async def get_by_workspace(
        self, workspace_id: UUID, limit: int = 100
    ) -> Sequence[AuditLog]:
        """Get recent audit logs for a workspace."""
        stmt = (
            select(self.model)
            .where(self.model.workspace_id == workspace_id)
            .order_by(self.model.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def get_by_entity(
        self, entity_type: str, entity_id: UUID, limit: int = 100
    ) -> Sequence[AuditLog]:
        """Get recent audit logs for a specific entity."""
        stmt = (
            select(self.model)
            .where(
                self.model.entity_type == entity_type,
                self.model.entity_id == entity_id,
            )
            .order_by(self.model.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()
