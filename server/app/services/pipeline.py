"""
Conduit Server — Pipeline service.
"""

import logging
from typing import Any, Sequence
from uuid import UUID

from app.infra.database.models import Pipeline, Revision
from app.infra.database.repositories.pipeline import (
    EdgeRepository,
    PipelineRepository,
    RevisionRepository,
    StageRepository,
)

logger = logging.getLogger(__name__)


class PipelineService:
    def __init__(
        self,
        pipeline_repo: PipelineRepository,
        revision_repo: RevisionRepository,
        stage_repo: StageRepository,
        edge_repo: EdgeRepository,
    ):
        self.pipeline_repo = pipeline_repo
        self.revision_repo = revision_repo
        self.stage_repo = stage_repo
        self.edge_repo = edge_repo

    async def create_pipeline(
        self,
        workspace_id: UUID,
        name: str,
        description: str = "",
    ) -> Pipeline:
        """Create a new pipeline in a workspace."""
        pipeline = await self.pipeline_repo.create(
            {"workspace_id": workspace_id, "name": name, "description": description},
        )
        logger.info(f"Pipeline '{name}' created in workspace {workspace_id}")
        return pipeline

    async def get_pipeline(self, pipeline_id: UUID) -> Pipeline | None:
        """Get pipeline by ID."""
        return await self.pipeline_repo.get(pipeline_id)

    async def get_workspace_pipelines(self, workspace_id: UUID) -> Sequence[Pipeline]:
        """List all pipelines in a workspace."""
        return await self.pipeline_repo.get_by_workspace(workspace_id)

    async def create_revision(
        self,
        pipeline_id: UUID,
        number: int,
        summary: str,
        stages: list[dict[str, Any]],
        edges: list[dict[str, Any]],
    ) -> Revision:
        """Create a new immutable revision of a pipeline with its stages and edges."""
        # 1. Create Revision
        revision = await self.revision_repo.create(
            {
                "pipeline_id": pipeline_id,
                "number": number,
                "summary": summary,
            },
        )

        # 2. Bulk/Iterative Create Stages
        stage_map = {}  # key -> db_id mapping
        for s in stages:
            # Handle integration_id if provided
            integration_id = s.get("integration_id")
            if integration_id:
                try:
                    integration_id = UUID(str(integration_id))
                except ValueError:
                    integration_id = None

            db_stage = await self.stage_repo.create(
                {
                    "revision_id": revision.id,
                    "key": s["key"],
                    "label": s["label"],
                    "kind": s["kind"],
                    "integration_id": integration_id,
                    "config": s.get("config", {}),
                    "position_x": float(s.get("position_x", 0)),
                    "position_y": float(s.get("position_y", 0)),
                },
            )
            stage_map[s["key"]] = db_stage.id

        # 3. Bulk/Iterative Create Edges
        for e in edges:
            source_id = stage_map.get(e["source_key"])
            target_id = stage_map.get(e["target_key"])
            if source_id and target_id:
                await self.edge_repo.create(
                    {
                        "revision_id": revision.id,
                        "source_id": source_id,
                        "target_id": target_id,
                    },
                )

        logger.info(f"Created revision {number} for pipeline {pipeline_id}")

        # Re-fetch with eagerly loaded relationships to avoid MissingGreenlet
        # during Pydantic serialization
        loaded = await self.revision_repo.get_by_id_with_relations(revision.id)
        return loaded

    async def get_pipeline_revisions(self, pipeline_id: UUID) -> Sequence[Revision]:
        """Get all revisions for a pipeline, including stages and edges."""
        revisions = await self.revision_repo.get_by_pipeline(pipeline_id)
        # We need to ensure stages and edges are loaded if we want to show the DAG
        # For simplicity in this step, we'll assume the repo or a joined query handles it,
        # or we implement it here.
        for rev in revisions:
            rev.stages = await self.stage_repo.get_by_revision(rev.id)
            rev.edges = await self.edge_repo.get_by_revision(rev.id)
        return revisions
