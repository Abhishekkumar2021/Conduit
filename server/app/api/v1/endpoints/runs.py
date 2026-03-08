from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.dependencies.services import get_pipeline_service, get_run_service
from app.services.pipeline import PipelineService
from app.services.run import RunService

router = APIRouter()


class RunResponse(BaseModel):
    id: UUID
    status: str
    trigger_type: str
    pipeline_id: UUID
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None

    model_config = {"from_attributes": True}


class StepResponse(BaseModel):
    id: UUID
    stage_key: str
    stage_kind: str
    status: str
    records_in: int
    records_out: int
    records_failed: int
    bytes_processed: int
    checkpoint: dict[str, Any] | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    error_message: str | None = None

    model_config = {"from_attributes": True}


class RunDetailResponse(RunResponse):
    error_message: str | None = None
    steps: list[StepResponse]

    model_config = {"from_attributes": True}


@router.get(
    "/workspaces/{workspace_id}/runs",
    response_model=list[RunResponse],
)
async def list_workspace_runs(
    workspace_id: UUID,
    limit: int = 50,
    status: Literal[
        "pending", "queued", "running", "succeeded", "failed", "cancelled"
    ]
    | None = None,
    trigger_type: Literal["manual", "schedule", "api"] | None = None,
    search: str | None = None,
    run_service: RunService = Depends(get_run_service),
):
    return await run_service.get_workspace_runs(
        workspace_id=workspace_id,
        limit=limit,
        status=status,
        trigger_type=trigger_type,
        search=search,
    )


@router.get(
    "/pipelines/{pipeline_id}/runs",
    response_model=list[RunResponse],
)
async def list_pipeline_runs(
    pipeline_id: UUID,
    limit: int = 20,
    run_service: RunService = Depends(get_run_service),
):
    return await run_service.get_pipeline_runs(pipeline_id, limit)


@router.post(
    "/pipelines/{pipeline_id}/runs",
    response_model=RunResponse,
    status_code=status.HTTP_201_CREATED,
)
async def trigger_pipeline_run(
    pipeline_id: UUID,
    run_service: RunService = Depends(get_run_service),
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    # 1. Fetch the pipeline to get its published_revision_id
    pipeline = await pipeline_service.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found"
        )

    if not pipeline.published_revision_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pipeline has no published revision. Publish a revision first.",
        )

    # 2. Initialize the run record (now polled by Standalone Runner)
    run = await run_service.initialize_run(
        workspace_id=pipeline.workspace_id,
        pipeline_id=pipeline.id,
        revision_id=pipeline.published_revision_id,
        trigger_type="manual",
    )

    return run


class RunStatusUpdate(BaseModel):
    status: Literal["running", "succeeded", "failed", "cancelled"]
    error_message: str | None = None
    duration_ms: int | None = None


class ClaimNodeResponse(BaseModel):
    kind: str
    name: str
    config: dict[str, Any]


class ClaimEdgeResponse(BaseModel):
    id: str
    source: str
    target: str


class ClaimGraphResponse(BaseModel):
    nodes: dict[str, ClaimNodeResponse]
    edges: list[ClaimEdgeResponse]


class ClaimRunResponse(BaseModel):
    run_id: str
    pipeline_id: str
    workspace_id: str
    integration_configs: dict[str, dict[str, Any]]
    graph: ClaimGraphResponse


@router.post("/runs/claim", response_model=ClaimRunResponse)
async def claim_run(
    run_service: RunService = Depends(get_run_service),
):
    """Claim the oldest pending run for execution."""
    data = await run_service.claim_pending_run()
    if not data:
        raise HTTPException(status_code=404, detail="No pending runs found")
    return data


@router.get("/runs/{run_id}", response_model=RunDetailResponse)
async def get_run_details(
    run_id: UUID,
    run_service: RunService = Depends(get_run_service),
):
    data = await run_service.get_run_with_steps(run_id)
    if not data:
        raise HTTPException(status_code=404, detail="Run not found")

    run, steps = data
    return RunDetailResponse(
        id=run.id,
        status=run.status,
        trigger_type=run.trigger_type,
        pipeline_id=run.pipeline_id,
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_ms=run.duration_ms,
        error_message=run.error_message,
        steps=[StepResponse.model_validate(step) for step in steps],
    )


@router.patch("/runs/{run_id}/status", response_model=RunResponse)
async def update_run_status(
    run_id: UUID,
    payload: RunStatusUpdate,
    run_service: RunService = Depends(get_run_service),
):
    """Update the status of an ongoing run."""
    run = await run_service.update_run_status(
        run_id=run_id,
        status=payload.status,
        error_message=payload.error_message,
        duration_ms=payload.duration_ms,
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run
