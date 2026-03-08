"""
Conduit Server — Integration service.
"""

import logging
from typing import Sequence
from uuid import UUID

from app.infra.database.models import Integration
from app.infra.database.repositories.asset import AssetRepository
from app.infra.database.repositories.integration import IntegrationRepository
from app.services.vault import VaultService

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
            raise ValueError(str(e)) from e

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
            f"Registered integration '{name}' ({adapter_type}) in workspace {workspace_id} with vault: {vault_status}"
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
            raise ValueError(f"Integration {integration_id} not found")

        from conduit.engine.adapters.registry import AdapterRegistry

        try:
            # 1. Fetch metadata to identify which fields are secrets
            meta = AdapterRegistry.get(integration.adapter_type)

            # 2. Resolve secrets from Vault
            resolved_config = self.vault_service.resolve_integration_config(
                plain_config=integration.config or {}, vault_fields=meta.vault_fields
            )

            # 3. Instantiate the proper engine adapter with the hydrated in-memory config
            adapter = AdapterRegistry.create(integration.adapter_type, resolved_config)

            # 4. Execute discovery natively via the adapter connection lifecycle
            with adapter.session():
                assets_data = adapter.discover()

            if assets_data:
                await self.asset_repo.upsert_assets(
                    integration_id=integration.id,
                    workspace_id=integration.workspace_id,
                    assets_data=assets_data,
                )

            integration.status = "healthy"
            integration.status_message = (
                f"Successfully synced {len(assets_data)} assets"
            )

        except Exception as e:
            logger.error(f"Failed to sync assets for {integration_id}: {e}")
            integration.status = "unreachable"
            integration.status_message = str(e)[:450]  # truncate long error messages

        await self.integration_repo.update(
            integration.id,
            {
                "status": integration.status,
                "status_message": integration.status_message,
            },
        )

        return integration

    async def test_connection(self, integration_id: UUID) -> Integration:
        """Test the connection to the data source using the engine adapter."""
        integration = await self.integration_repo.get(integration_id)
        if not integration:
            raise ValueError(f"Integration {integration_id} not found")

        from conduit.engine.adapters.registry import AdapterRegistry

        try:
            # 1. Fetch metadata to identify which fields are secrets
            meta = AdapterRegistry.get(integration.adapter_type)

            # 2. Resolve secrets from Vault
            resolved_config = self.vault_service.resolve_integration_config(
                plain_config=integration.config or {}, vault_fields=meta.vault_fields
            )

            # 3. Instantiate the proper engine adapter with the hydrated in-memory config
            adapter = AdapterRegistry.create(integration.adapter_type, resolved_config)

            # 4. Test connection via the adapter
            is_successful = adapter.test()

            if is_successful:
                integration.status = "healthy"
                integration.status_message = "Connection successful"
            else:
                integration.status = "unreachable"
                integration.status_message = "Connection failed during test phase. Check credentials and network."

        except Exception as e:
            logger.error(f"Failed to test connection for {integration_id}: {e}")
            integration.status = "unreachable"
            integration.status_message = str(e)[:450]  # truncate long error messages

        await self.integration_repo.update(
            integration.id,
            {
                "status": integration.status,
                "status_message": integration.status_message,
            },
        )

        return integration

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
            logger.info(f"Integration {id} updated successfully")
        return integration

    async def delete_integration(self, id: UUID) -> bool:
        """Delete an integration."""
        success = await self.integration_repo.delete(id)
        if success:
            logger.info(f"Integration {id} deleted successfully")
        return success
