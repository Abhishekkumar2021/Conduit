"""Pipeline scheduling endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies.services import get_pipeline_service, get_scheduler_service
from app.services.pipeline import PipelineService
from app.services.scheduler import SchedulerService, is_valid_cron, next_fire_time

router = APIRouter()


class ScheduleUpdate(BaseModel):
    schedule_cron: str | None = Field(default=None, max_length=100)
    schedule_timezone: str = Field(default="UTC", max_length=50)


class ScheduleResponse(BaseModel):
    pipeline_id: str
    schedule_cron: str | None
    schedule_timezone: str | None
    next_fire_at: str | None

    model_config = {"from_attributes": True}


@router.get("/pipelines/{pipeline_id}/schedule", response_model=ScheduleResponse)
async def get_schedule(
    pipeline_id: UUID,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
):
    """Get the current schedule for a pipeline."""
    pipeline = await pipeline_service.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    nft = None
    if pipeline.schedule_cron and is_valid_cron(pipeline.schedule_cron):
        nft = next_fire_time(pipeline.schedule_cron).isoformat()

    return ScheduleResponse(
        pipeline_id=str(pipeline.id),
        schedule_cron=pipeline.schedule_cron,
        schedule_timezone=pipeline.schedule_timezone,
        next_fire_at=nft,
    )


@router.put("/pipelines/{pipeline_id}/schedule", response_model=ScheduleResponse)
async def update_schedule(
    pipeline_id: UUID,
    req: ScheduleUpdate,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    scheduler_service: SchedulerService = Depends(get_scheduler_service),
):
    """Set or clear a pipeline's cron schedule."""
    pipeline = await pipeline_service.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    await scheduler_service.update_schedule(
        pipeline_id, req.schedule_cron, req.schedule_timezone
    )

    nft = None
    if req.schedule_cron and is_valid_cron(req.schedule_cron):
        nft = next_fire_time(req.schedule_cron).isoformat()

    return ScheduleResponse(
        pipeline_id=str(pipeline.id),
        schedule_cron=req.schedule_cron,
        schedule_timezone=req.schedule_timezone,
        next_fire_at=nft,
    )


@router.delete("/pipelines/{pipeline_id}/schedule", status_code=204)
async def clear_schedule(
    pipeline_id: UUID,
    scheduler_service: SchedulerService = Depends(get_scheduler_service),
):
    """Remove a pipeline's schedule."""
    await scheduler_service.update_schedule(pipeline_id, None)
