"""
Conduit Server — Secure Vault Service.

Implements a Zero-Storage Security architecture. The database only stores abstract
key names (e.g. 'MY_PROD_DB_PASSWORD'). At runtime, VaultService resolves those
keys from the configured provider, ensuring sensitive data never hits the
persistence layer.
"""

import logging
import os
from abc import ABC, abstractmethod
from typing import Any

from conduit.domain.errors import VaultResolutionError

logger = logging.getLogger(__name__)


class VaultProvider(ABC):
    """Base class for secret providers."""

    @abstractmethod
    def get_secret(self, key_name: str) -> str:
        """Resolve a secret from the underlying provider."""


class EnvVaultProvider(VaultProvider):
    """Resolves secrets from environment variables."""

    def get_secret(self, key_name: str) -> str:
        val = os.environ.get(key_name)
        if not val:
            raise VaultResolutionError(
                key_name, "not found in environment variables"
            )
        return val


class VaultService:
    def __init__(self, provider: VaultProvider | None = None):
        self.provider = provider or EnvVaultProvider()

    def get_secret(self, key_name: str) -> str:
        return self.provider.get_secret(key_name)

    def resolve_integration_config(
        self, plain_config: dict[str, Any], vault_fields: list[str]
    ) -> dict[str, Any]:
        """
        Takes a database integration config containing abstract secret keys and
        resolves them dynamically into real secrets.

        Raises VaultResolutionError if any required secret cannot be resolved.
        """
        resolved_config = plain_config.copy()

        for field_def in vault_fields:
            parts = field_def.split(":")
            field_name = parts[0]
            if len(parts) > 1 and "secret" in parts[1]:
                if field_name in resolved_config and resolved_config[field_name]:
                    abstract_key = resolved_config[field_name]
                    resolved_config[field_name] = self.get_secret(abstract_key)

        return resolved_config
