from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.dependencies.services import get_pipeline_service
from app.services.pipeline import PipelineService

router = APIRouter()


class PipelineCreate(BaseModel):
    name: str
    description: str = ""


class PipelineUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class PipelineResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    description: str
    status: str
    published_revision_id: UUID | None = None

    model_config = {"from_attributes": True}


class RevisionCreate(BaseModel):
    number: int
    summary: str
    stages: list[dict[str, Any]]
    edges: list[dict[str, Any]]


class StageResponse(BaseModel):
    id: UUID
    key: str
    label: str
    kind: str
    position_x: float
    position_y: float
    config: dict[str, Any]

    model_config = {"from_attributes": True}


class EdgeResponse(BaseModel):
    id: UUID
    source_id: UUID
    target_id: UUID

    model_config = {"from_attributes": True}


class RevisionResponse(BaseModel):
    id: UUID
    number: int
    summary: str
    stages: list[StageResponse] = []
    edges: list[EdgeResponse] = []

    model_config = {"from_attributes": True}


@router.post(
    "/workspaces/{workspace_id}/pipelines",
    response_model=PipelineResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pipeline(
    workspace_id: UUID,
    req: PipelineCreate,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    try:
        pipeline = await pipeline_service.create_pipeline(
            workspace_id=workspace_id,
            name=req.name,
            description=req.description,
        )
        return pipeline
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    "/workspaces/{workspace_id}/pipelines",
    response_model=list[PipelineResponse],
)
async def list_pipelines(
    workspace_id: UUID,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    return await pipeline_service.get_workspace_pipelines(workspace_id)


@router.get(
    "/pipelines/{pipeline_id}",
    response_model=PipelineResponse,
)
async def get_pipeline(
    pipeline_id: UUID,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    pipeline = await pipeline_service.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.patch(
    "/pipelines/{pipeline_id}",
    response_model=PipelineResponse,
)
async def update_pipeline(
    pipeline_id: UUID,
    req: PipelineUpdate,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    pipeline = await pipeline_service.update_pipeline(
        pipeline_id, **req.model_dump(exclude_unset=True)
    )
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.delete(
    "/pipelines/{pipeline_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_pipeline(
    pipeline_id: UUID,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    success = await pipeline_service.delete_pipeline(pipeline_id)
    if not success:
        raise HTTPException(status_code=404, detail="Pipeline not found")


@router.post(
    "/pipelines/{pipeline_id}/revisions",
    response_model=RevisionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_revision(
    pipeline_id: UUID,
    req: RevisionCreate,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    revision = await pipeline_service.create_revision(
        pipeline_id=pipeline_id,
        number=req.number,
        summary=req.summary,
        stages=req.stages,
        edges=req.edges,
    )
    return revision


@router.get(
    "/pipelines/{pipeline_id}/revisions",
    response_model=list[RevisionResponse],
)
async def get_pipeline_revisions(
    pipeline_id: UUID,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    return await pipeline_service.get_pipeline_revisions(pipeline_id)


@router.post(
    "/pipelines/{pipeline_id}/revisions/{revision_id}/publish",
    response_model=PipelineResponse,
)
async def publish_revision(
    pipeline_id: UUID,
    revision_id: UUID,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    try:
        return await pipeline_service.publish_revision(pipeline_id, revision_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
