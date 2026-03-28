from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.dependencies.services import get_integration_service, get_vault_service
from app.services.integration import IntegrationService
from app.services.vault import VaultService
from conduit.domain.errors import VaultResolutionError
from conduit.engine.adapters.registry import AdapterRegistry

router = APIRouter()


class RunnerStatusResponse(BaseModel):
    missing_variables: list[str]
    is_healthy: bool


@router.get("/runner-status", response_model=RunnerStatusResponse)
async def check_runner_status(
    integration_service: IntegrationService = Depends(get_integration_service),
    vault_service: VaultService = Depends(get_vault_service),
):
    """
    Check if the local runner environment has all the necessary system variables
    (Vault secrets) configured by existing integrations.
    """
    integrations = await integration_service.integration_repo.get_all()

    missing_vars = set()
    for integration in integrations:
        try:
            adapter_cls = AdapterRegistry.get(integration.adapter_type)
        except KeyError:
            continue

        plain_config = integration.config or {}
        for field_def in adapter_cls.meta.vault_fields:
            if ":secret" not in field_def:
                continue

            parts = field_def.split("=")
            name_type = parts[0].split(":")
            field_name = name_type[0]

            if field_name in plain_config and plain_config[field_name]:
                abstract_key = plain_config[field_name]
                try:
                    vault_service.get_secret(abstract_key)
                except VaultResolutionError:
                    missing_vars.add(abstract_key)

    return {
        "missing_variables": list(missing_vars),
        "is_healthy": len(missing_vars) == 0,
    }
