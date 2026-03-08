"""
Conduit Engine — Base adapter and registration decorator.

Every adapter inherits from BaseAdapter and uses the @adapter decorator.
This module also defines AdapterMeta served to the UI via the API.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Generator


@dataclass(frozen=True)
class AdapterMeta:
    """Metadata describing an adapter — served to the UI, never hardcoded."""

    type: str
    name: str
    category: str  # 'sql', 'nosql', 'storage', 'api'
    vault_fields: list[str] = field(default_factory=list)
    capabilities: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "name": self.name,
            "category": self.category,
            "capabilities": self.capabilities,
        }


class BaseAdapter(ABC):
    """
    Abstract base class for all data adapters.

    Lifecycle: connect() → [read/write/discover/test] → disconnect()
    Use the session() context manager for safe resource handling.
    """

    meta: AdapterMeta

    def __init__(self, config: dict[str, Any]):
        self._config = config
        self._connected = False

    @contextmanager
    def session(self) -> Generator["BaseAdapter", None, None]:
        """Context manager for safe connect/disconnect lifecycle."""
        try:
            self.connect()
            self._connected = True
            yield self
        finally:
            self.disconnect()
            self._connected = False

    @abstractmethod
    def connect(self) -> None:
        """Establish connection to the external system."""

    @abstractmethod
    def disconnect(self) -> None:
        """Release connection resources."""

    @abstractmethod
    def test(self) -> bool:
        """Test connectivity. Returns True if healthy."""

    @abstractmethod
    def discover(self) -> list[dict]:
        """
        Discover available assets (tables, files, collections).
        Returns list of dicts with at least: {qualified_name, asset_type}
        """

    @abstractmethod
    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        """
        Read data from an asset in batches.
        Yields lists of record dicts.
        """

    @abstractmethod
    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        """
        Write records to an asset.
        Returns the number of records written.
        """


def adapter(
    *,
    type: str,
    name: str,
    category: str,
    capabilities: list[str] | None = None,
) -> Any:
    """
    Decorator to register an adapter class.

    Usage:
        @adapter(type="postgresql", name="PostgreSQL", category="sql")
        class PostgreSQLAdapter(BaseAdapter):
            vault_fields = ["host", "port:int=5432", "database", "username", "password:secret"]
            ...
    """

    def decorator(cls: type[BaseAdapter]) -> type[BaseAdapter]:
        vault_fields = getattr(cls, "vault_fields", [])
        cls.meta = AdapterMeta(
            type=type,
            name=name,
            category=category,
            vault_fields=vault_fields,
            capabilities=capabilities or ["read", "write", "discover"],
        )
        return cls

    return decorator
