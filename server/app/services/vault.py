"""
Conduit Server — Secure Vault Service.

Implements a Zero-Storage Security architecture. The Conduit database only stores
abstract key names (e.g. 'MY_PROD_DB_PASSWORD'). At runtime, this VaultService
resolves those keys securely from the local runner environment, ensuring sensitive
data never hits the persistence layer.
"""

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


from abc import ABC, abstractmethod


class VaultProvider(ABC):
    @abstractmethod
    def get_secret(self, key_name: str) -> str:
        """Resolve a secret from the underlying provider."""
        pass


class EnvVaultProvider(VaultProvider):
    def get_secret(self, key_name: str) -> str:
        val = os.environ.get(key_name)
        if not val:
            raise ValueError(
                f"Vault error: Secret key '{key_name}' not found in environment."
            )
        return val


# TODO: Implement AWSSecretsManagerProvider, HashiCorpVaultProvider, etc. for high-standard production security


class VaultService:
    def __init__(self, provider: VaultProvider | None = None):
        # Default to Environment Provider, but allows injection of ANY secret manager
        self.provider = provider or EnvVaultProvider()

    def get_secret(self, key_name: str) -> str:
        return self.provider.get_secret(key_name)

    def resolve_integration_config(
        self, plain_config: dict[str, Any], vault_fields: list[str]
    ) -> dict[str, Any]:
        """
        Takes a database integration config containing abstract secret keys and
        resolves them dynamically into real secrets.
        """
        resolved_config = plain_config.copy()

        for field_def in vault_fields:
            # Metadata might look like "password:secret" or "port:int=5432"
            parts = field_def.split(":")
            field_name = parts[0]
            if len(parts) > 1 and "secret" in parts[1]:
                # This field is a secret reference.
                if field_name in resolved_config and resolved_config[field_name]:
                    abstract_key = resolved_config[field_name]
                    # Resolve it!
                    try:
                        resolved_config[field_name] = self.get_secret(abstract_key)
                    except ValueError as e:
                        logger.error(
                            f"Failed to resolve secret for integration field '{field_name}'"
                        )
                        raise e

        return resolved_config
