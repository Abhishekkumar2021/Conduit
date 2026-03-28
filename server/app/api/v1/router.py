from fastapi import APIRouter

from app.api.v1.endpoints import (
    audit,
    auth,
    integrations,
    lineage,
    metrics,
    pipeline_ops,
    pipelines,
    preview,
    processors,
    quarantine,
    runs,
    schedules,
    system,
    workspaces,
    ws,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["workspaces"])
api_router.include_router(pipelines.router, tags=["pipelines"])
api_router.include_router(pipeline_ops.router, tags=["pipeline-ops"])
api_router.include_router(schedules.router, tags=["schedules"])
api_router.include_router(integrations.router, tags=["integrations"])
api_router.include_router(preview.router, tags=["preview"])
api_router.include_router(runs.router, tags=["runs"])
api_router.include_router(metrics.router, tags=["metrics"])
api_router.include_router(audit.router, tags=["audit"])
api_router.include_router(quarantine.router, tags=["quarantine"])
api_router.include_router(lineage.router, tags=["lineage"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(processors.router, tags=["processors"])
api_router.include_router(ws.router, tags=["websocket"])
