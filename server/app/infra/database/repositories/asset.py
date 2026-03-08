from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import Asset, AssetEvent
from app.infra.database.repositories.base import BaseRepository


class AssetRepository(BaseRepository[Asset]):
    """Repository for Asset model."""

    def __init__(self, session: AsyncSession):
        super().__init__(Asset, session)

    async def get_by_integration(self, integration_id: UUID) -> Sequence[Asset]:
        """Get all assets for a specific integration."""
        stmt = select(self.model).where(self.model.integration_id == integration_id)
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def upsert_assets(
        self, integration_id: UUID, workspace_id: UUID, assets_data: list[dict]
    ) -> None:
        """
        Upsert a list of discovered assets.
        Uses PostgreSQL ON CONFLICT (integration_id, qualified_name) DO UPDATE.
        """
        if not assets_data:
            return

        from sqlalchemy.dialects.postgresql import insert
        from datetime import datetime

        values = []
        for a in assets_data:
            values.append(
                {
                    "integration_id": integration_id,
                    "workspace_id": workspace_id,
                    "qualified_name": a["qualified_name"],
                    "asset_type": a["asset_type"],
                    "discovered_at": datetime.now(),
                }
            )

        stmt = insert(self.model).values(values)

        # Update existing records on conflict
        stmt = stmt.on_conflict_do_update(
            index_elements=["integration_id", "qualified_name"],
            set_={
                "asset_type": stmt.excluded.asset_type,
                "discovered_at": stmt.excluded.discovered_at,
            },
        )

        await self._session.execute(stmt)
        await self._session.commit()


class AssetEventRepository(BaseRepository[AssetEvent]):
    """Repository for AssetEvent model."""

    def __init__(self, session: AsyncSession):
        super().__init__(AssetEvent, session)

    async def get_by_asset(
        self, asset_id: UUID, limit: int = 50
    ) -> Sequence[AssetEvent]:
        """Get recent events for a specific asset, ordered by detection time."""
        stmt = (
            select(self.model)
            .where(self.model.asset_id == asset_id)
            .order_by(self.model.detected_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()
