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

        meta = AdapterRegistry.get(adapter_type)
        vault_status = "not_configured"
        for field_def in meta.vault_fields:
            if ":secret" in field_def:
                vault_status = "configured"
                break

        integration = await self.integration_repo.create(
            {
                "workspace_id": workspace_id,
                "name": name,
                "adapter_type": adapter_type,
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
