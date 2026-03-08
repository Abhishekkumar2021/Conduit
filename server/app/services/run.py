"""
Conduit Server — Run service.
"""

import logging
from datetime import datetime
from typing import Any, Sequence
from uuid import UUID

from app.infra.database.models import Run, Step, Revision
from app.infra.database.repositories.run import RunRepository, StepRepository
from app.services.vault import VaultService
from conduit.engine.contracts import validate_run_claim_payload
from sqlalchemy import select
from sqlalchemy.orm import selectinload

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
        logger.info(f"Initialized run {run.id} for pipeline {pipeline_id}")
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
        step = await self.step_repo.create(
            {
                "run_id": run_id,
                "stage_key": stage_key,
                "stage_kind": stage_kind,
                "status": status,
                "checkpoint": checkpoint,
            },
        )
        return step

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
        """Find the oldest pending run, mark as running, and return full details."""
        stmt = (
            select(Run)
            .where(Run.status == "pending")
            .order_by(Run.created_at.asc())
            .limit(1)
        )
        result = await self.run_repo._session.execute(stmt)
        run = result.scalar_one_or_none()

        if not run:
            return None

        # 1. Pending -> Running
        run.status = "running"
        run.started_at = datetime.now()
        await self.run_repo._session.commit()

        # 2. Fetch the Revision to build Execution Graph
        rev_stmt = (
            select(Revision)
            .options(selectinload(Revision.stages), selectinload(Revision.edges))
            .where(Revision.id == run.revision_id)
        )

        rev_result = await self.run_repo._session.execute(rev_stmt)
        revision = rev_result.scalar_one_or_none()

        # Return dict representation suitable for Runner
        integration_ids: set[UUID] = set()
        nodes = {}
        edges = []

        if revision:
            from uuid import UUID

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

        integration_configs = {}
        if integration_ids:
            from conduit.engine.adapters.registry import AdapterRegistry
            from app.infra.database.models import Integration

            int_stmt = select(Integration).where(Integration.id.in_(integration_ids))
            int_result = await self.run_repo._session.execute(int_stmt)
            for integration in int_result.scalars().all():
                try:
                    meta = AdapterRegistry.get(integration.adapter_type)
                    # Use vault to inject plaintext secrets into the runner execution graph payload
                    resolved_config = self.vault_service.resolve_integration_config(
                        plain_config=integration.config or {},
                        vault_fields=meta.vault_fields,
                    )
                    integration_configs[str(integration.id)] = resolved_config
                except Exception as e:
                    logger.error(
                        f"Failed to resolve secrets for integration {integration.id}: {e}"
                    )
                    integration_configs[str(integration.id)] = integration.config

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

    async def update_run_status(
        self,
        run_id: UUID,
        status: str,
        error_message: str | None = None,
        duration_ms: int | None = None,
    ) -> Run:
        """Update the status of a run."""
        update_data = {"status": status}
        if status in ["succeeded", "failed"]:
            update_data["finished_at"] = datetime.now()
            if error_message:
                update_data["error_message"] = error_message
            if duration_ms is not None:
                update_data["duration_ms"] = duration_ms

        run = await self.run_repo.update(run_id, update_data)
        await self.run_repo._session.commit()
        return run
