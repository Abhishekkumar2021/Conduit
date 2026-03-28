"""
Conduit Server — Integration service.
"""

import asyncio
import logging
from typing import Sequence
from uuid import UUID

from app.infra.database.models import Integration
from app.infra.database.repositories.asset import AssetRepository
from app.infra.database.repositories.integration import IntegrationRepository
from app.services.vault import VaultService
from conduit.domain.errors import NotFoundError, ValidationError

logger = logging.getLogger(__name__)


class IntegrationService:
    def __init__(
        self,
        integration_repo: IntegrationRepository,
        asset_repo: AssetRepository,
        vault_service: "VaultService",
    ):
        self.integration_repo = integration_repo
        self.asset_repo = asset_repo
        self.vault_service = vault_service

    async def register_integration(
        self,
        workspace_id: UUID,
        name: str,
        adapter_type: str,
        config: dict,
    ) -> Integration:
        """Register a new data source integration."""
        from conduit.engine.adapters.registry import AdapterRegistry

        try:
            adapter_cls = AdapterRegistry.get(adapter_type)
        except KeyError as e:
            raise ValidationError(str(e), field="adapter_type") from e

        meta = adapter_cls.meta
        vault_status = "not_configured"
        for field_def in meta.vault_fields:
            if ":secret" in field_def:
                vault_status = "configured"
                break

        integration = await self.integration_repo.create(
            {
                "workspace_id": workspace_id,
                "name": name,
                "adapter_type": meta.type,
                "config": config,
                "vault_status": vault_status,
            },
        )
        logger.info(
            "Registered integration '%s' (%s) in workspace %s [vault=%s]",
            name, adapter_type, workspace_id, vault_status,
        )
        return integration

    async def get_workspace_integrations(
        self, workspace_id: UUID
    ) -> Sequence[Integration]:
        """List all integrations configured for a workspace."""
        return await self.integration_repo.get_by_workspace(workspace_id)

    async def sync_assets(self, integration_id: UUID) -> Integration:
        """Dynamically fetch schemas/tables from the data source and save to the DB."""
        integration = await self.integration_repo.get(integration_id)
        if not integration:
            raise NotFoundError("Integration", str(integration_id))

        # Capture values before thread boundary to avoid lazy-load issues
        int_id = integration.id
        ws_id = integration.workspace_id
        adapter_type = integration.adapter_type
        plain_config = dict(integration.config or {})

        from conduit.engine.adapters.registry import AdapterRegistry

        status = "unreachable"
        status_message = ""

        try:
            meta = AdapterRegistry.get(adapter_type)
            resolved_config = self.vault_service.resolve_integration_config(
                plain_config=plain_config, vault_fields=meta.vault_fields
            )

            adapter = AdapterRegistry.create(adapter_type, resolved_config)

            def _discover():
                with adapter.session():
                    return adapter.discover()

            assets_data = await asyncio.to_thread(_discover)

            if assets_data:
                await self.asset_repo.upsert_assets(
                    integration_id=int_id,
                    workspace_id=ws_id,
                    assets_data=assets_data,
                )

            status = "healthy"
            status_message = f"Successfully synced {len(assets_data)} assets"

        except Exception as e:
            logger.error("Failed to sync assets for %s: %s", integration_id, e)
            status = "unreachable"
            status_message = str(e)[:450]

        updated = await self.integration_repo.update(
            int_id, {"status": status, "status_message": status_message}
        )
        return updated or integration

    async def test_connection(self, integration_id: UUID) -> Integration:
        """Test the connection to the data source using the engine adapter."""
        integration = await self.integration_repo.get(integration_id)
        if not integration:
            raise NotFoundError("Integration", str(integration_id))

        int_id = integration.id
        adapter_type = integration.adapter_type
        plain_config = dict(integration.config or {})

        from conduit.engine.adapters.registry import AdapterRegistry

        status = "unreachable"
        status_message = ""

        try:
            meta = AdapterRegistry.get(adapter_type)
            resolved_config = self.vault_service.resolve_integration_config(
                plain_config=plain_config, vault_fields=meta.vault_fields
            )

            adapter = AdapterRegistry.create(adapter_type, resolved_config)
            is_successful = await asyncio.to_thread(adapter.test)

            if is_successful:
                status = "healthy"
                status_message = "Connection successful"
            else:
                status = "unreachable"
                status_message = "Connection failed. Check credentials and network."

        except Exception as e:
            logger.error("Failed to test connection for %s: %s", integration_id, e)
            status = "unreachable"
            status_message = str(e)[:450]

        updated = await self.integration_repo.update(
            int_id, {"status": status, "status_message": status_message}
        )
        return updated or integration

    async def update_integration(self, id: UUID, **kwargs) -> Integration | None:
        """Update integration details."""
        if "config" in kwargs and kwargs["config"] is not None:
            integration = await self.integration_repo.get(id)
            if not integration:
                return None
            from conduit.engine.adapters.registry import AdapterRegistry

            try:
                adapter_cls = AdapterRegistry.get(integration.adapter_type)
                vault_status = "not_configured"
                for field_def in adapter_cls.meta.vault_fields:
                    if ":secret" in field_def:
                        vault_status = "configured"
                        break
                kwargs["vault_status"] = vault_status
            except KeyError:
                pass

        integration = await self.integration_repo.update(id, kwargs)
        if integration:
            logger.info("Integration %s updated", id)
        return integration

    async def delete_integration(self, id: UUID) -> bool:
        """Delete an integration."""
        success = await self.integration_repo.delete(id)
        if success:
            logger.info("Integration %s deleted", id)
        return success
