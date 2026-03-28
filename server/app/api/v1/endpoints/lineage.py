"""Data lineage endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.dependencies.services import get_lineage_service
from app.services.lineage import LineageService

router = APIRouter()


@router.get("/workspaces/{workspace_id}/lineage")
async def get_workspace_lineage(
    workspace_id: UUID,
    lineage_service: LineageService = Depends(get_lineage_service),
):
    """
    Get integration-level data lineage for a workspace.

    Returns a graph of integrations connected via pipelines,
    showing how data flows from source to target systems.
    """
    return await lineage_service.get_integration_lineage(workspace_id)


@router.get("/pipelines/{pipeline_id}/lineage")
async def get_pipeline_lineage(
    pipeline_id: UUID,
    lineage_service: LineageService = Depends(get_lineage_service),
):
    """
    Get stage-level lineage for a single pipeline.

    Returns the published revision's stage graph.
    """
    return await lineage_service.get_pipeline_lineage(pipeline_id)
