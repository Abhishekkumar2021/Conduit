"""
Conduit Server — Audit logging service.

Tracks all significant user actions for compliance and debugging.
"""

import logging
from typing import Any, Sequence
from uuid import UUID

from app.infra.database.models import AuditLog
from app.infra.database.repositories.audit_log import AuditLogRepository

logger = logging.getLogger(__name__)


class AuditService:
    def __init__(self, audit_repo: AuditLogRepository):
        self.audit_repo = audit_repo

    async def log(
        self,
        workspace_id: UUID,
        action: str,
        entity_type: str,
        entity_id: UUID | None = None,
        user_id: UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AuditLog:
        """Record an audit event."""
        entry = await self.audit_repo.create(
            {
                "workspace_id": workspace_id,
                "user_id": user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "metadata_": metadata or {},
            }
        )
        logger.debug(
            "Audit: %s %s %s in workspace %s",
            action, entity_type, entity_id, workspace_id,
        )
        return entry

    async def get_workspace_audit_log(
        self,
        workspace_id: UUID,
        limit: int = 100,
        entity_type: str | None = None,
        action: str | None = None,
    ) -> Sequence[AuditLog]:
        """Retrieve audit log entries for a workspace."""
        return await self.audit_repo.get_by_workspace(
            workspace_id, limit=limit, entity_type=entity_type, action=action
        )

    async def get_entity_history(
        self, entity_type: str, entity_id: UUID, limit: int = 50
    ) -> Sequence[AuditLog]:
        """Get audit trail for a specific entity."""
        return await self.audit_repo.get_by_entity(entity_type, entity_id, limit=limit)
