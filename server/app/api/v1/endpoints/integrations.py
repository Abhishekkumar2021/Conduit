from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.dependencies.services import get_integration_service
from app.services.integration import IntegrationService
from conduit.engine.adapters.registry import AdapterRegistry

router = APIRouter()


class AdapterMetaResponse(BaseModel):
    type: str
    name: str
    category: str
    vault_fields: list[str]
    capabilities: list[str]


@router.get(
    "/integrations/adapters",
    response_model=list[AdapterMetaResponse],
)
async def list_available_adapters():
    """List all available data adapters discovered by the Engine."""
    return [
        {**meta.to_dict(), "vault_fields": meta.vault_fields}
        for meta in AdapterRegistry.list_all()
    ]


class IntegrationCreate(BaseModel):
    name: str
    adapter_type: str
    config: dict[str, Any]


class IntegrationUpdate(BaseModel):
    name: str | None = None
    config: dict[str, Any] | None = None


class IntegrationResponse(BaseModel):
    id: UUID
    name: str
    adapter_type: str
    status: str
    status_message: str | None = None

    model_config = {"from_attributes": True}


@router.post(
    "/workspaces/{workspace_id}/integrations",
    response_model=IntegrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_integration(
    workspace_id: UUID,
    req: IntegrationCreate,
    integration_service: IntegrationService = Depends(get_integration_service),
):
    try:
        return await integration_service.register_integration(
            workspace_id=workspace_id,
            name=req.name,
            adapter_type=req.adapter_type,
            config=req.config,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    "/workspaces/{workspace_id}/integrations",
    response_model=list[IntegrationResponse],
)
async def list_integrations(
    workspace_id: UUID,
    integration_service: IntegrationService = Depends(get_integration_service),
):
    return await integration_service.get_workspace_integrations(workspace_id)


@router.patch(
    "/integrations/{integration_id}",
    response_model=IntegrationResponse,
)
async def update_integration(
    integration_id: UUID,
    req: IntegrationUpdate,
    integration_service: IntegrationService = Depends(get_integration_service),
):
    integration = await integration_service.update_integration(
        integration_id, **req.model_dump(exclude_unset=True)
    )
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration


@router.delete(
    "/integrations/{integration_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_integration(
    integration_id: UUID,
    integration_service: IntegrationService = Depends(get_integration_service),
):
    success = await integration_service.delete_integration(integration_id)
    if not success:
        raise HTTPException(status_code=404, detail="Integration not found")


class AssetResponse(BaseModel):
    id: UUID
    integration_id: UUID
    qualified_name: str
    asset_type: str
    discovered_at: datetime

    model_config = {"from_attributes": True}


@router.post(
    "/integrations/{integration_id}/discover",
    response_model=IntegrationResponse,
)
async def discover_integration_assets(
    integration_id: UUID,
    integration_service: IntegrationService = Depends(get_integration_service),
):
    """Trigger the engine adapter to natively fetch and sync table schemas."""
    return await integration_service.sync_assets(integration_id)


@router.post(
    "/integrations/{integration_id}/test",
    response_model=IntegrationResponse,
)
async def test_integration_connection(
    integration_id: UUID,
    integration_service: IntegrationService = Depends(get_integration_service),
):
    """Test the connection of an integration via the engine adapter."""
    return await integration_service.test_connection(integration_id)


@router.get(
    "/integrations/{integration_id}/assets",
    response_model=list[AssetResponse],
)
async def list_integration_assets(
    integration_id: UUID,
    integration_service: IntegrationService = Depends(get_integration_service),
):
    """List all previously discovered assets for an integration."""
    return await integration_service.asset_repo.get_by_integration(integration_id)
