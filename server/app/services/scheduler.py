"""
Conduit Server — Pipeline scheduler service.

Manages cron-based scheduling for pipelines. Uses an in-process scheduler
that checks for due pipelines on a fixed interval.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from croniter import croniter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import Pipeline

logger = logging.getLogger(__name__)


def is_valid_cron(expression: str) -> bool:
    """Validate a cron expression."""
    try:
        croniter(expression)
        return True
    except (ValueError, KeyError):
        return False


def next_fire_time(cron_expr: str, base_time: datetime | None = None) -> datetime:
    """Calculate the next fire time for a cron expression."""
    base = base_time or datetime.now(timezone.utc)
    return croniter(cron_expr, base).get_next(datetime)


class SchedulerService:
    """
    Evaluates which pipelines are due for scheduled runs.

    Not a long-running thread — designed to be called periodically
    (e.g., every 60s via a background task or external cron job).
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_due_pipelines(self) -> list[dict[str, Any]]:
        """
        Find all active pipelines with a cron schedule that are due to fire.
        Returns list of {pipeline_id, workspace_id, revision_id, cron}.
        """
        now = datetime.now(timezone.utc)

        stmt = (
            select(Pipeline)
            .where(
                Pipeline.status == "active",
                Pipeline.schedule_cron.isnot(None),
                Pipeline.published_revision_id.isnot(None),
                Pipeline.deleted_at.is_(None),
            )
        )
        result = await self._session.execute(stmt)
        pipelines = result.scalars().all()

        due = []
        for p in pipelines:
            if not p.schedule_cron:
                continue
            try:
                cron = croniter(p.schedule_cron, now)
                prev_fire = cron.get_prev(datetime)
                # If the previous fire time is within the last 90 seconds,
                # the pipeline is "due" in this evaluation window.
                if (now - prev_fire).total_seconds() <= 90:
                    due.append(
                        {
                            "pipeline_id": p.id,
                            "workspace_id": p.workspace_id,
                            "revision_id": p.published_revision_id,
                            "cron": p.schedule_cron,
                        }
                    )
            except Exception:
                logger.warning(
                    "Invalid cron expression for pipeline %s: %s",
                    p.id, p.schedule_cron,
                )

        return due

    async def update_schedule(
        self, pipeline_id: Any, cron_expr: str | None, timezone_str: str = "UTC"
    ) -> None:
        """Update a pipeline's schedule."""
        if cron_expr and not is_valid_cron(cron_expr):
            from conduit.domain.errors import ValidationError
            raise ValidationError(
                f"Invalid cron expression: '{cron_expr}'", field="schedule_cron"
            )

        from sqlalchemy import update
        stmt = (
            update(Pipeline)
            .where(Pipeline.id == pipeline_id)
            .values(schedule_cron=cron_expr, schedule_timezone=timezone_str)
        )
        await self._session.execute(stmt)
