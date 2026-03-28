"""
Conduit Server — Pipeline service.
"""

import logging
from datetime import datetime
from typing import Any, Sequence
from uuid import UUID

from app.infra.database.models import Pipeline, Quarantine, Revision, Run, Step
from app.infra.database.repositories.pipeline import (
    EdgeRepository,
    PipelineRepository,
    RevisionRepository,
    StageRepository,
)
from conduit.domain.errors import NotFoundError

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
        logger.info("Pipeline '%s' created in workspace %s", name, workspace_id)
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

        logger.info("Created revision %d for pipeline %s", number, pipeline_id)

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

    async def publish_revision(self, pipeline_id: UUID, revision_id: UUID) -> Pipeline:
        """
        Publish a specific revision and mark it as the pipeline's active revision.
        """
        pipeline = await self.pipeline_repo.get(pipeline_id)
        if not pipeline:
            raise NotFoundError("Pipeline", str(pipeline_id))

        revision = await self.revision_repo.get(revision_id)
        if not revision or revision.pipeline_id != pipeline_id:
            raise NotFoundError("Revision", str(revision_id))

        # Clear any previously published revision flags.
        existing_revisions = await self.revision_repo.get_by_pipeline(pipeline_id)
        for existing in existing_revisions:
            if existing.is_published and existing.id != revision_id:
                await self.revision_repo.update(existing.id, {"is_published": False})

        await self.revision_repo.update(
            revision_id,
            {
                "is_published": True,
                "published_at": datetime.now(),
            },
        )
        await self.pipeline_repo.update(
            pipeline_id,
            {
                "published_revision_id": revision_id,
                "status": "active",
            },
        )

        updated = await self.pipeline_repo.get(pipeline_id)
        logger.info("Published revision %s for pipeline %s", revision_id, pipeline_id)
        return updated

    async def update_pipeline(self, pipeline_id: UUID, **kwargs) -> Pipeline | None:
        """Update a pipeline."""
        pipeline = await self.pipeline_repo.update(pipeline_id, kwargs)
        if pipeline:
            logger.info("Pipeline %s updated", pipeline_id)
        return pipeline

    async def delete_pipeline(self, pipeline_id: UUID) -> bool:
        """Delete a pipeline and all dependent data."""
        from sqlalchemy import delete as sa_delete
        from sqlalchemy import select as sa_select

        # Delete quarantine records for this pipeline
        await self.pipeline_repo._session.execute(
            sa_delete(Quarantine).where(Quarantine.pipeline_id == pipeline_id)
        )

        # Delete steps for runs of this pipeline
        run_ids_result = await self.pipeline_repo._session.execute(
            sa_select(Run.id).where(Run.pipeline_id == pipeline_id)
        )
        run_ids = [r[0] for r in run_ids_result.all()]
        if run_ids:
            await self.pipeline_repo._session.execute(
                sa_delete(Step).where(Step.run_id.in_(run_ids))
            )

        # Delete runs
        await self.pipeline_repo._session.execute(
            sa_delete(Run).where(Run.pipeline_id == pipeline_id)
        )

        # Clear published_revision_id to avoid circular FK
        await self.pipeline_repo.update(pipeline_id, {"published_revision_id": None})

        success = await self.pipeline_repo.delete(pipeline_id)
        if success:
            logger.info("Pipeline %s deleted", pipeline_id)
        return success
