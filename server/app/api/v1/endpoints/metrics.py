"""Dashboard metrics endpoints."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from app.api.dependencies.services import get_metrics_service
from app.services.metrics import MetricsService

router = APIRouter()


@router.get("/workspaces/{workspace_id}/metrics/summary")
async def get_workspace_summary(
    workspace_id: UUID,
    metrics_service: MetricsService = Depends(get_metrics_service),
):
    """High-level dashboard stats: pipeline count, integration count, run stats."""
    return await metrics_service.get_workspace_summary(workspace_id)


@router.get("/workspaces/{workspace_id}/metrics/run-trend")
async def get_run_trend(
    workspace_id: UUID,
    days: int = Query(default=14, ge=1, le=90),
    metrics_service: MetricsService = Depends(get_metrics_service),
):
    """Daily run counts and success/failure breakdown."""
    return await metrics_service.get_run_trend(workspace_id, days)


@router.get("/workspaces/{workspace_id}/metrics/pipeline-stats")
async def get_pipeline_stats(
    workspace_id: UUID,
    metrics_service: MetricsService = Depends(get_metrics_service),
):
    """Per-pipeline success rate and run stats."""
    return await metrics_service.get_pipeline_stats(workspace_id)


@router.get("/workspaces/{workspace_id}/metrics/throughput")
async def get_throughput(
    workspace_id: UUID,
    days: int = Query(default=7, ge=1, le=90),
    metrics_service: MetricsService = Depends(get_metrics_service),
):
    """Total records processed and byte throughput."""
    return await metrics_service.get_throughput(workspace_id, days)
