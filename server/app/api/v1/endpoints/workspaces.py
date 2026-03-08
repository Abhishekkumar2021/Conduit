from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.dependencies.services import get_workspace_service
from app.services.workspace import WorkspaceService

router = APIRouter()


class WorkspaceCreate(BaseModel):
    name: str
    slug: str
    owner_id: UUID


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    slug: str

    model_config = {"from_attributes": True}


@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    req: WorkspaceCreate,
    workspace_service: WorkspaceService = Depends(get_workspace_service),
):
    try:
        workspace = await workspace_service.create_workspace(
            name=req.name, slug=req.slug, owner_id=req.owner_id
        )
        return workspace
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: UUID,
    workspace_service: WorkspaceService = Depends(get_workspace_service),
):
    workspace = await workspace_service.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: UUID,
    req: WorkspaceUpdate,
    workspace_service: WorkspaceService = Depends(get_workspace_service),
):
    workspace = await workspace_service.update_workspace(
        workspace_id, **req.model_dump(exclude_unset=True)
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: UUID,
    workspace_service: WorkspaceService = Depends(get_workspace_service),
):
    success = await workspace_service.delete_workspace(workspace_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workspace not found")


@router.get("/", response_model=list[WorkspaceResponse])
async def list_workspaces(
    workspace_service: WorkspaceService = Depends(get_workspace_service),
):
    # For now, return all workspaces (until auth is fully enforced)
    return await workspace_service.workspace_repo.get_all()
