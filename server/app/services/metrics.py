"""
Conduit Server — Dashboard metrics service.

Aggregates pipeline and run statistics for the dashboard.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import case, cast, func, select, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import Integration, Pipeline, Run

logger = logging.getLogger(__name__)


class MetricsService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_workspace_summary(self, workspace_id: UUID) -> dict[str, Any]:
        """High-level summary stats for the dashboard."""
        pipeline_count = await self._count(Pipeline, workspace_id)
        integration_count = await self._count(Integration, workspace_id)

        now = datetime.now(timezone.utc)
        since_24h = now - timedelta(hours=24)
        since_7d = now - timedelta(days=7)

        runs_24h = await self._run_stats(workspace_id, since_24h)
        runs_7d = await self._run_stats(workspace_id, since_7d)

        return {
            "pipelines": pipeline_count,
            "integrations": integration_count,
            "runs_24h": runs_24h,
            "runs_7d": runs_7d,
        }

    async def get_run_trend(
        self, workspace_id: UUID, days: int = 14
    ) -> list[dict[str, Any]]:
        """Daily run counts and success rates for a time window."""
        since = datetime.now(timezone.utc) - timedelta(days=days)

        stmt = (
            select(
                func.date(Run.created_at).label("date"),
                func.count().label("total"),
                func.sum(
                    case((Run.status == "succeeded", 1), else_=0)
                ).label("succeeded"),
                func.sum(
                    case((Run.status == "failed", 1), else_=0)
                ).label("failed"),
            )
            .where(Run.workspace_id == workspace_id, Run.created_at >= since)
            .group_by(func.date(Run.created_at))
            .order_by(func.date(Run.created_at))
        )
        result = await self._session.execute(stmt)

        return [
            {
                "date": str(row.date),
                "total": row.total,
                "succeeded": row.succeeded or 0,
                "failed": row.failed or 0,
            }
            for row in result.all()
        ]

    async def get_pipeline_stats(
        self, workspace_id: UUID
    ) -> list[dict[str, Any]]:
        """Per-pipeline success/failure stats."""
        stmt = (
            select(
                Pipeline.id,
                Pipeline.name,
                Pipeline.status,
                func.count(Run.id).label("total_runs"),
                func.sum(
                    case((Run.status == "succeeded", 1), else_=0)
                ).label("succeeded"),
                func.sum(
                    case((Run.status == "failed", 1), else_=0)
                ).label("failed"),
                func.avg(Run.duration_ms).label("avg_duration_ms"),
                func.max(Run.created_at).label("last_run_at"),
            )
            .outerjoin(Run, Run.pipeline_id == Pipeline.id)
            .where(Pipeline.workspace_id == workspace_id, Pipeline.deleted_at.is_(None))
            .group_by(Pipeline.id, Pipeline.name, Pipeline.status)
            .order_by(Pipeline.name)
        )
        result = await self._session.execute(stmt)

        return [
            {
                "pipeline_id": str(row.id),
                "name": row.name,
                "status": row.status,
                "total_runs": row.total_runs or 0,
                "succeeded": row.succeeded or 0,
                "failed": row.failed or 0,
                "avg_duration_ms": round(row.avg_duration_ms) if row.avg_duration_ms else None,
                "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
            }
            for row in result.all()
        ]

    async def get_throughput(
        self, workspace_id: UUID, days: int = 7
    ) -> dict[str, Any]:
        """Total records processed and average duration over a period."""
        since = datetime.now(timezone.utc) - timedelta(days=days)

        from app.infra.database.models import Step

        stmt = (
            select(
                func.sum(Step.records_in).label("total_records_in"),
                func.sum(Step.records_out).label("total_records_out"),
                func.sum(Step.records_failed).label("total_records_failed"),
                func.sum(Step.bytes_processed).label("total_bytes"),
            )
            .join(Run, Run.id == Step.run_id)
            .where(Run.workspace_id == workspace_id, Run.created_at >= since)
        )
        result = await self._session.execute(stmt)
        row = result.one()

        return {
            "period_days": days,
            "total_records_in": row.total_records_in or 0,
            "total_records_out": row.total_records_out or 0,
            "total_records_failed": row.total_records_failed or 0,
            "total_bytes_processed": row.total_bytes or 0,
        }

    async def _count(self, model: Any, workspace_id: UUID) -> int:
        deleted_check = getattr(model, "deleted_at", None)
        stmt = select(func.count()).select_from(model).where(
            model.workspace_id == workspace_id
        )
        if deleted_check is not None:
            stmt = stmt.where(model.deleted_at.is_(None))
        result = await self._session.execute(stmt)
        return result.scalar() or 0

    async def _run_stats(
        self, workspace_id: UUID, since: datetime
    ) -> dict[str, int]:
        stmt = (
            select(
                func.count().label("total"),
                func.sum(case((Run.status == "succeeded", 1), else_=0)).label("succeeded"),
                func.sum(case((Run.status == "failed", 1), else_=0)).label("failed"),
                func.sum(case((Run.status == "running", 1), else_=0)).label("running"),
                func.sum(case((Run.status == "pending", 1), else_=0)).label("pending"),
            )
            .where(Run.workspace_id == workspace_id, Run.created_at >= since)
        )
        result = await self._session.execute(stmt)
        row = result.one()
        return {
            "total": row.total or 0,
            "succeeded": row.succeeded or 0,
            "failed": row.failed or 0,
            "running": row.running or 0,
            "pending": row.pending or 0,
        }
