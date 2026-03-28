"""
Conduit Server — Data lineage service.

Tracks how data flows between integrations across pipelines.
Lineage is derived from pipeline revision graphs — no separate storage needed.
"""

import logging
from typing import Any, Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infra.database.models import Integration, Pipeline, Revision, Stage

logger = logging.getLogger(__name__)


class LineageService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_integration_lineage(
        self, workspace_id: UUID
    ) -> dict[str, Any]:
        """
        Build a lineage graph showing how integrations are connected via pipelines.

        Returns: {nodes: [...], edges: [...]} where nodes are integrations
        and edges represent data flow through pipelines.
        """
        stmt = (
            select(Pipeline)
            .where(
                Pipeline.workspace_id == workspace_id,
                Pipeline.published_revision_id.isnot(None),
                Pipeline.deleted_at.is_(None),
            )
        )
        result = await self._session.execute(stmt)
        pipelines = result.scalars().all()

        integration_nodes: dict[str, dict] = {}
        edges: list[dict] = []

        for pipeline in pipelines:
            rev_stmt = (
                select(Revision)
                .options(selectinload(Revision.stages), selectinload(Revision.edges))
                .where(Revision.id == pipeline.published_revision_id)
            )
            rev_result = await self._session.execute(rev_stmt)
            revision = rev_result.scalar_one_or_none()
            if not revision:
                continue

            sources: list[str] = []
            targets: list[str] = []

            for stage in revision.stages:
                if not stage.integration_id:
                    continue

                int_id = str(stage.integration_id)
                if int_id not in integration_nodes:
                    integration_nodes[int_id] = {
                        "id": int_id,
                        "pipelines": [],
                    }

                if pipeline.name not in integration_nodes[int_id]["pipelines"]:
                    integration_nodes[int_id]["pipelines"].append(pipeline.name)

                base_kind = stage.kind.split("_")[-1] if "_" in stage.kind else stage.kind
                if base_kind == "extract":
                    sources.append(int_id)
                elif base_kind == "load":
                    targets.append(int_id)

            for src in sources:
                for tgt in targets:
                    if src != tgt:
                        edges.append(
                            {
                                "source": src,
                                "target": tgt,
                                "pipeline_id": str(pipeline.id),
                                "pipeline_name": pipeline.name,
                            }
                        )

        # Enrich nodes with integration details
        if integration_nodes:
            int_stmt = select(Integration).where(
                Integration.id.in_([UUID(k) for k in integration_nodes.keys()])
            )
            int_result = await self._session.execute(int_stmt)
            for integration in int_result.scalars().all():
                node = integration_nodes.get(str(integration.id))
                if node:
                    node["name"] = integration.name
                    node["adapter_type"] = integration.adapter_type
                    node["status"] = integration.status

        return {
            "nodes": list(integration_nodes.values()),
            "edges": edges,
        }

    async def get_pipeline_lineage(self, pipeline_id: UUID) -> dict[str, Any]:
        """Get detailed stage-level lineage for a single pipeline."""
        stmt = (
            select(Pipeline)
            .where(Pipeline.id == pipeline_id)
        )
        result = await self._session.execute(stmt)
        pipeline = result.scalar_one_or_none()
        if not pipeline or not pipeline.published_revision_id:
            return {"nodes": [], "edges": []}

        rev_stmt = (
            select(Revision)
            .options(selectinload(Revision.stages), selectinload(Revision.edges))
            .where(Revision.id == pipeline.published_revision_id)
        )
        rev_result = await self._session.execute(rev_stmt)
        revision = rev_result.scalar_one_or_none()
        if not revision:
            return {"nodes": [], "edges": []}

        nodes = []
        for stage in revision.stages:
            nodes.append(
                {
                    "id": str(stage.id),
                    "key": stage.key,
                    "label": stage.label,
                    "kind": stage.kind,
                    "integration_id": str(stage.integration_id) if stage.integration_id else None,
                }
            )

        edges = []
        for edge in revision.edges:
            edges.append(
                {
                    "source": str(edge.source_id),
                    "target": str(edge.target_id),
                }
            )

        return {"nodes": nodes, "edges": edges}
