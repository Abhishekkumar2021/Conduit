"""Audit log endpoints."""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.dependencies.services import get_audit_service
from app.services.audit import AuditService

router = APIRouter()


class AuditLogResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    user_id: UUID | None
    action: str
    entity_type: str
    entity_id: UUID | None
    metadata: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get(
    "/workspaces/{workspace_id}/audit",
    response_model=list[AuditLogResponse],
)
async def list_audit_logs(
    workspace_id: UUID,
    limit: int = Query(default=100, ge=1, le=500),
    entity_type: str | None = None,
    action: str | None = None,
    audit_service: AuditService = Depends(get_audit_service),
):
    """List audit log entries for a workspace."""
    entries = await audit_service.get_workspace_audit_log(
        workspace_id, limit=limit, entity_type=entity_type, action=action
    )
    result = []
    for e in entries:
        result.append(AuditLogResponse(
            id=e.id,
            workspace_id=e.workspace_id,
            user_id=e.user_id,
            action=e.action,
            entity_type=e.entity_type,
            entity_id=e.entity_id,
            metadata=e.metadata_,
            created_at=e.created_at,
        ))
    return result
