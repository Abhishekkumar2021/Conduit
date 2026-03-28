from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user, get_optional_user
from app.api.dependencies.services import get_workspace_service
from app.infra.database.models import User
from app.services.workspace import WorkspaceService

router = APIRouter()


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9\-]*$")
    owner_id: UUID | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(
        default=None, min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9\-]*$"
    )


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    slug: str

    model_config = {"from_attributes": True}


@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    req: WorkspaceCreate,
    workspace_service: WorkspaceService = Depends(get_workspace_service),
    user: User | None = Depends(get_optional_user),
):
    owner_id = req.owner_id or (user.id if user else None)
    if not owner_id:
        raise HTTPException(status_code=422, detail="owner_id is required")
    workspace = await workspace_service.create_workspace(
        name=req.name, slug=req.slug, owner_id=owner_id
    )
    return workspace


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
    return await workspace_service.workspace_repo.get_all()
