"""
Conduit Server — Quarantine management service.

Handles quarantined records from quality gates: view, approve, reject.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Sequence
from uuid import UUID

from sqlalchemy import func, select

from app.infra.database.models import Quarantine
from app.infra.database.repositories.quarantine import QuarantineRepository

logger = logging.getLogger(__name__)


class QuarantineService:
    def __init__(self, quarantine_repo: QuarantineRepository):
        self.quarantine_repo = quarantine_repo

    async def get_unresolved(
        self, workspace_id: UUID, limit: int = 100, pipeline_id: UUID | None = None
    ) -> Sequence[Quarantine]:
        """Get unresolved quarantined records for a workspace."""
        return await self.quarantine_repo.get_unresolved_by_workspace(
            workspace_id, limit=limit, pipeline_id=pipeline_id
        )

    async def resolve(
        self,
        quarantine_id: UUID,
        resolution: str,
        resolved_by: UUID | None = None,
    ) -> Quarantine | None:
        """Approve or reject a quarantined record."""
        if resolution not in ("approved", "rejected"):
            from conduit.domain.errors import ValidationError
            raise ValidationError(
                f"Invalid resolution: '{resolution}'. Must be 'approved' or 'rejected'.",
                field="resolution",
            )

        return await self.quarantine_repo.update(
            quarantine_id,
            {
                "resolution": resolution,
                "resolved_by": resolved_by,
                "resolved_at": datetime.now(timezone.utc),
            },
        )

    async def bulk_resolve(
        self,
        quarantine_ids: list[UUID],
        resolution: str,
        resolved_by: UUID | None = None,
    ) -> int:
        """Bulk approve/reject quarantined records. Returns count resolved."""
        count = 0
        for qid in quarantine_ids:
            result = await self.resolve(qid, resolution, resolved_by)
            if result:
                count += 1
        return count

    async def get_summary(self, workspace_id: UUID) -> dict[str, Any]:
        """Get quarantine summary stats for a workspace."""
        session = self.quarantine_repo._session
        stmt = (
            select(
                Quarantine.resolution,
                func.count().label("count"),
            )
            .where(Quarantine.workspace_id == workspace_id)
            .group_by(Quarantine.resolution)
        )
        result = await session.execute(stmt)
        counts = {row.resolution: row.count for row in result.all()}
        return {
            "pending": counts.get("pending", 0),
            "approved": counts.get("approved", 0),
            "rejected": counts.get("rejected", 0),
            "total": sum(counts.values()),
        }
