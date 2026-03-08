from fastapi import APIRouter

from app.api.v1.endpoints import auth, pipelines, workspaces, runs, integrations

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["workspaces"])
api_router.include_router(pipelines.router, tags=["pipelines"])
api_router.include_router(integrations.router, tags=["integrations"])
api_router.include_router(runs.router, tags=["runs"])
