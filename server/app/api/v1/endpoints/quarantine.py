"""Quarantine management endpoints."""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.api.dependencies.services import get_quarantine_service
from app.services.quarantine import QuarantineService

router = APIRouter()


class QuarantineResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    pipeline_id: UUID
    run_id: UUID
    record_data: dict[str, Any]
    quality_score: int
    failed_rules: dict[str, Any] | list
    resolution: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ResolveRequest(BaseModel):
    resolution: str = Field(pattern=r"^(approved|rejected)$")


class BulkResolveRequest(BaseModel):
    ids: list[UUID] = Field(min_length=1, max_length=500)
    resolution: str = Field(pattern=r"^(approved|rejected)$")


class QuarantineSummaryResponse(BaseModel):
    pending: int
    approved: int
    rejected: int
    total: int


@router.get(
    "/workspaces/{workspace_id}/quarantine",
    response_model=list[QuarantineResponse],
)
async def list_quarantined_records(
    workspace_id: UUID,
    limit: int = Query(default=100, ge=1, le=500),
    pipeline_id: UUID | None = None,
    quarantine_service: QuarantineService = Depends(get_quarantine_service),
):
    """List unresolved quarantined records for a workspace."""
    return await quarantine_service.get_unresolved(
        workspace_id, limit=limit, pipeline_id=pipeline_id
    )


@router.get(
    "/workspaces/{workspace_id}/quarantine/summary",
    response_model=QuarantineSummaryResponse,
)
async def get_quarantine_summary(
    workspace_id: UUID,
    quarantine_service: QuarantineService = Depends(get_quarantine_service),
):
    """Get quarantine summary counts."""
    return await quarantine_service.get_summary(workspace_id)


@router.patch(
    "/quarantine/{quarantine_id}",
    response_model=QuarantineResponse,
)
async def resolve_quarantine(
    quarantine_id: UUID,
    req: ResolveRequest,
    quarantine_service: QuarantineService = Depends(get_quarantine_service),
):
    """Approve or reject a quarantined record."""
    result = await quarantine_service.resolve(quarantine_id, req.resolution)
    if not result:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Quarantine record not found")
    return result


@router.post("/quarantine/bulk-resolve", status_code=status.HTTP_200_OK)
async def bulk_resolve(
    req: BulkResolveRequest,
    quarantine_service: QuarantineService = Depends(get_quarantine_service),
):
    """Bulk approve/reject quarantined records."""
    count = await quarantine_service.bulk_resolve(req.ids, req.resolution)
    return {"resolved": count, "total": len(req.ids)}
