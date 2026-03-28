"""
Conduit Server — Run service.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.infra.database.models import Integration, Revision, Run, Step
from app.infra.database.repositories.run import RunRepository, StepRepository
from app.services.vault import VaultService
from conduit.engine.adapters.registry import AdapterRegistry
from conduit.engine.contracts import validate_run_claim_payload

logger = logging.getLogger(__name__)


class RunService:
    def __init__(
        self,
        run_repo: RunRepository,
        step_repo: StepRepository,
        vault_service: VaultService,
    ):
        self.run_repo = run_repo
        self.step_repo = step_repo
        self.vault_service = vault_service

    async def initialize_run(
        self,
        workspace_id: UUID,
        pipeline_id: UUID,
        revision_id: UUID,
        trigger_type: str,
    ) -> Run:
        """Create a new run record in PENDING status."""
        run = await self.run_repo.create(
            {
                "workspace_id": workspace_id,
                "pipeline_id": pipeline_id,
                "revision_id": revision_id,
                "status": "pending",
                "trigger_type": trigger_type,
            },
        )
        logger.info("Initialized run %s for pipeline %s", run.id, pipeline_id)
        return run

    async def get_workspace_runs(
        self,
        workspace_id: UUID,
        limit: int = 50,
        status: str | None = None,
        trigger_type: str | None = None,
        search: str | None = None,
    ) -> Sequence[Run]:
        """List recent runs in a workspace."""
        return await self.run_repo.get_by_workspace(
            workspace_id=workspace_id,
            limit=limit,
            status=status,
            trigger_type=trigger_type,
            search=search,
        )

    async def log_step(
        self,
        run_id: UUID,
        stage_key: str,
        stage_kind: str,
        status: str,
        checkpoint: dict[str, Any],
    ) -> Step:
        """Log the execution result of a specific pipeline stage step."""
        return await self.step_repo.create(
            {
                "run_id": run_id,
                "stage_key": stage_key,
                "stage_kind": stage_kind,
                "status": status,
                "checkpoint": checkpoint,
            },
        )

    async def get_pipeline_runs(
        self, pipeline_id: UUID, limit: int = 50
    ) -> Sequence[Run]:
        """List recent runs for a specific pipeline."""
        return await self.run_repo.get_by_pipeline(pipeline_id, limit)

    async def get_run_with_steps(self, run_id: UUID) -> tuple[Run, Sequence[Step]] | None:
        """Fetch one run and its step execution history."""
        run = await self.run_repo.get(run_id)
        if not run:
            return None
        steps = await self.step_repo.get_by_run(run_id)
        return run, steps

    async def claim_pending_run(self) -> dict | None:
        """
        Atomically claim the oldest pending run using SELECT ... FOR UPDATE SKIP LOCKED,
        mark as running, and return the full execution payload.
        """
        session = self.run_repo._session

        # Atomic claim: row-level lock prevents race between multiple runners
        stmt = (
            select(Run)
            .where(Run.status == "pending")
            .order_by(Run.created_at.asc())
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        result = await session.execute(stmt)
        run = result.scalar_one_or_none()

        if not run:
            return None

        run.status = "running"
        run.started_at = datetime.now(timezone.utc)
        await session.flush()

        rev_stmt = (
            select(Revision)
            .options(selectinload(Revision.stages), selectinload(Revision.edges))
            .where(Revision.id == run.revision_id)
        )
        rev_result = await session.execute(rev_stmt)
        revision = rev_result.scalar_one_or_none()

        if not revision:
            logger.error("Revision %s not found for run %s", run.revision_id, run.id)
            run.status = "failed"
            run.error_message = "Revision not found"
            run.finished_at = datetime.now(timezone.utc)
            await session.flush()
            return None

        integration_ids: set[UUID] = set()
        nodes = {}
        edges = []

        for s in revision.stages:
            node_config = dict(s.config or {})
            if s.integration_id and "integration_id" not in node_config:
                node_config["integration_id"] = str(s.integration_id)

            nodes[str(s.id)] = {
                "kind": s.kind,
                "name": s.label,
                "config": node_config,
            }
            integration_id = node_config.get("integration_id")
            if integration_id:
                try:
                    integration_ids.add(UUID(str(integration_id)))
                except ValueError:
                    pass

        for e in revision.edges:
            edges.append(
                {
                    "id": str(e.id),
                    "source": str(e.source_id),
                    "target": str(e.target_id),
                }
            )

        integration_configs, adapter_type_map = await self._resolve_integration_configs(
            session, integration_ids
        )

        for _nid, ndata in nodes.items():
            int_id = ndata["config"].get("integration_id")
            if int_id and int_id in adapter_type_map:
                ndata["config"]["adapter_type"] = adapter_type_map[int_id]

        payload = {
            "run_id": str(run.id),
            "pipeline_id": str(run.pipeline_id),
            "workspace_id": str(run.workspace_id),
            "integration_configs": integration_configs,
            "graph": {
                "nodes": nodes,
                "edges": edges,
            },
        }
        validate_run_claim_payload(payload)
        return payload

    async def _resolve_integration_configs(
        self, session: Any, integration_ids: set[UUID]
    ) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
        """Resolve integration configs with vault secrets. Fails fast on missing secrets.
        Returns (configs, adapter_type_map).
        """
        if not integration_ids:
            return {}, {}

        int_stmt = select(Integration).where(Integration.id.in_(integration_ids))
        int_result = await session.execute(int_stmt)

        configs: dict[str, dict[str, Any]] = {}
        adapter_types: dict[str, str] = {}
        for integration in int_result.scalars().all():
            try:
                meta = AdapterRegistry.get(integration.adapter_type)
                resolved_config = self.vault_service.resolve_integration_config(
                    plain_config=integration.config or {},
                    vault_fields=meta.vault_fields,
                )
                configs[str(integration.id)] = resolved_config
                adapter_types[str(integration.id)] = integration.adapter_type
            except Exception:
                logger.exception(
                    "Failed to resolve secrets for integration %s (%s)",
                    integration.id, integration.name,
                )
                raise

        return configs, adapter_types

    async def update_run_status(
        self,
        run_id: UUID,
        status: str,
        error_message: str | None = None,
        duration_ms: int | None = None,
    ) -> Run | None:
        """Update the status of a run."""
        update_data: dict[str, Any] = {"status": status}
        if status in ("succeeded", "failed", "cancelled"):
            update_data["finished_at"] = datetime.now(timezone.utc)
            if error_message:
                update_data["error_message"] = error_message
            if duration_ms is not None:
                update_data["duration_ms"] = duration_ms

        return await self.run_repo.update(run_id, update_data)

    async def retry_run(self, run_id: UUID) -> Run | None:
        """
        Retry a failed run by creating a new run with the same parameters.
        Returns the new run.
        """
        original = await self.run_repo.get(run_id)
        if not original:
            return None

        if original.status not in ("failed", "cancelled"):
            from conduit.domain.errors import ValidationError
            raise ValidationError(
                f"Can only retry failed or cancelled runs (current: {original.status})",
                field="status",
            )

        new_run = await self.run_repo.create(
            {
                "workspace_id": original.workspace_id,
                "pipeline_id": original.pipeline_id,
                "revision_id": original.revision_id,
                "status": "pending",
                "trigger_type": "manual",
            },
        )
        logger.info("Retried run %s → new run %s", run_id, new_run.id)
        return new_run

    async def cancel_run(self, run_id: UUID) -> Run | None:
        """Cancel a pending or running run."""
        run = await self.run_repo.get(run_id)
        if not run:
            return None

        if run.status not in ("pending", "queued", "running"):
            from conduit.domain.errors import ValidationError
            raise ValidationError(
                f"Can only cancel pending/queued/running runs (current: {run.status})",
                field="status",
            )

        return await self.run_repo.update(
            run_id,
            {
                "status": "cancelled",
                "finished_at": datetime.now(timezone.utc),
            },
        )

    async def log_steps_batch(
        self,
        run_id: UUID,
        steps: list[dict[str, Any]],
    ) -> list[Step]:
        """Log multiple step results from the runner."""
        created = []
        for step_data in steps:
            step = await self.step_repo.create(
                {
                    "run_id": run_id,
                    "stage_key": step_data["stage_key"],
                    "stage_kind": step_data.get("stage_kind", ""),
                    "status": step_data.get("status", "succeeded"),
                    "records_in": step_data.get("records_in", 0),
                    "records_out": step_data.get("records_out", 0),
                    "records_failed": step_data.get("records_failed", 0),
                    "duration_ms": step_data.get("duration_ms"),
                    "error_message": step_data.get("error_message"),
                }
            )
            created.append(step)
        return created
