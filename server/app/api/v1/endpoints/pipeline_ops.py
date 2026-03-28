"""Pipeline operations: clone, export, import."""

import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.dependencies.services import get_pipeline_service
from app.services.pipeline import PipelineService

router = APIRouter()


class CloneRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)


@router.post(
    "/pipelines/{pipeline_id}/clone",
    status_code=status.HTTP_201_CREATED,
)
async def clone_pipeline(
    pipeline_id: UUID,
    req: CloneRequest,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    """Clone a pipeline with its latest revision."""
    source = await pipeline_service.get_pipeline(pipeline_id)
    if not source:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    new_pipeline = await pipeline_service.create_pipeline(
        workspace_id=source.workspace_id,
        name=req.name,
        description=req.description or source.description,
    )

    revisions = await pipeline_service.get_pipeline_revisions(pipeline_id)
    if revisions:
        latest = revisions[0]
        stages = [
            {
                "key": s.key,
                "label": s.label,
                "kind": s.kind,
                "integration_id": str(s.integration_id) if hasattr(s, "integration_id") and s.integration_id else None,
                "config": dict(s.config) if s.config else {},
                "position_x": s.position_x,
                "position_y": s.position_y,
            }
            for s in latest.stages
        ]
        edges = [
            {
                "source_key": _find_stage_key(latest.stages, e.source_id),
                "target_key": _find_stage_key(latest.stages, e.target_id),
            }
            for e in latest.edges
        ]
        edges = [e for e in edges if e["source_key"] and e["target_key"]]

        await pipeline_service.create_revision(
            pipeline_id=new_pipeline.id,
            number=1,
            summary=f"Cloned from {source.name}",
            stages=stages,
            edges=edges,
        )

    return {"id": str(new_pipeline.id), "name": new_pipeline.name}


@router.get("/pipelines/{pipeline_id}/export")
async def export_pipeline(
    pipeline_id: UUID,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    """Export a pipeline and its latest revision as JSON."""
    pipeline = await pipeline_service.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    revisions = await pipeline_service.get_pipeline_revisions(pipeline_id)

    export_data = {
        "version": "1.0",
        "pipeline": {
            "name": pipeline.name,
            "description": pipeline.description or "",
            "schedule_cron": pipeline.schedule_cron,
            "schedule_timezone": pipeline.schedule_timezone,
        },
        "revisions": [],
    }

    for rev in revisions:
        export_data["revisions"].append(
            {
                "number": rev.number,
                "summary": rev.summary,
                "stages": [
                    {
                        "key": s.key,
                        "label": s.label,
                        "kind": s.kind,
                        "config": dict(s.config) if s.config else {},
                        "position_x": s.position_x,
                        "position_y": s.position_y,
                    }
                    for s in rev.stages
                ],
                "edges": [
                    {
                        "source_key": _find_stage_key(rev.stages, e.source_id),
                        "target_key": _find_stage_key(rev.stages, e.target_id),
                    }
                    for e in rev.edges
                ],
            }
        )

    return JSONResponse(
        content=export_data,
        headers={
            "Content-Disposition": f'attachment; filename="{pipeline.name}.json"'
        },
    )


@router.post(
    "/workspaces/{workspace_id}/pipelines/import",
    status_code=status.HTTP_201_CREATED,
)
async def import_pipeline(
    workspace_id: UUID,
    file: UploadFile,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    """Import a pipeline from a JSON export file."""
    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    pipeline_data = data.get("pipeline", {})
    name = pipeline_data.get("name", "Imported Pipeline")

    pipeline = await pipeline_service.create_pipeline(
        workspace_id=workspace_id,
        name=name,
        description=pipeline_data.get("description", ""),
    )

    for rev_data in data.get("revisions", []):
        await pipeline_service.create_revision(
            pipeline_id=pipeline.id,
            number=rev_data.get("number", 1),
            summary=rev_data.get("summary", "Imported"),
            stages=rev_data.get("stages", []),
            edges=rev_data.get("edges", []),
        )

    return {"id": str(pipeline.id), "name": pipeline.name}


def _find_stage_key(stages: list, stage_id: UUID) -> str | None:
    """Helper to find a stage's key by its UUID."""
    for s in stages:
        if s.id == stage_id:
            return s.key
    return None
