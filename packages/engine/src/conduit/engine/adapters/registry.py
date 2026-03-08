"""
Conduit Engine — Adapter auto-discovery and registry.

Scans adapter subdirectories on startup and registers all @adapter-decorated classes.
The registry serves metadata to the API, which forwards it to the UI.
"""

from __future__ import annotations

import importlib
import logging
import pkgutil
from pathlib import Path
from typing import Any

from conduit.engine.adapters.base import AdapterMeta, BaseAdapter

logger = logging.getLogger(__name__)


class AdapterRegistry:
    """
    Central registry of all available adapters.

    Usage:
        AdapterRegistry.discover()       # Call once at startup
        AdapterRegistry.get("postgresql") # Get adapter class by type
        AdapterRegistry.list_all()        # Get all adapter metadata for API
    """

    _adapters: dict[str, type[BaseAdapter]] = {}
    _discovered: bool = False

    @classmethod
    def normalize_type(cls, adapter_type: str) -> str:
        """Normalize adapter type input to canonical lowercase form."""
        return adapter_type.strip().lower()

    @classmethod
    def discover(cls) -> None:
        """Auto-discover all adapter classes in sql/, nosql/, storage/, api/ subdirectories."""
        if cls._discovered:
            return

        base_dir = Path(__file__).parent
        categories = ["sql", "nosql", "storage", "api"]

        for category in categories:
            category_dir = base_dir / category
            if not category_dir.is_dir():
                continue

            pkg_name = f"conduit.engine.adapters.{category}"
            for _, module_name, _ in pkgutil.iter_modules([str(category_dir)]):
                try:
                    module = importlib.import_module(f"{pkg_name}.{module_name}")
                    for attr_name in dir(module):
                        attr = getattr(module, attr_name)
                        if (
                            isinstance(attr, type)
                            and issubclass(attr, BaseAdapter)
                            and attr is not BaseAdapter
                            and hasattr(attr, "meta")
                        ):
                            cls._adapters[attr.meta.type] = attr
                            logger.info("Registered adapter: %s", attr.meta.type)
                except Exception:
                    logger.exception(
                        "Failed to load adapter module: %s.%s", pkg_name, module_name
                    )

        cls._discovered = True
        logger.info("Discovered %d adapters", len(cls._adapters))

    @classmethod
    def get(cls, adapter_type: str) -> type[BaseAdapter]:
        """Get an adapter class by its type identifier."""
        cls.discover()
        normalized = cls.normalize_type(adapter_type)
        if normalized not in cls._adapters:
            available = ", ".join(sorted(cls._adapters.keys()))
            msg = (
                f"Unknown adapter type: '{adapter_type}' (normalized: '{normalized}'). "
                f"Available: {available}"
            )
            raise KeyError(msg)
        return cls._adapters[normalized]

    @classmethod
    def create(cls, adapter_type: str, config: dict[str, Any]) -> BaseAdapter:
        """Create an adapter instance with the given config."""
        adapter_cls = cls.get(adapter_type)
        return adapter_cls(config)

    @classmethod
    def list_all(cls) -> list[AdapterMeta]:
        """Return metadata for all registered adapters (served to UI via API)."""
        cls.discover()
        return [a.meta for a in cls._adapters.values()]

    @classmethod
    def reset(cls) -> None:
        """Reset the registry (for testing)."""
        cls._adapters.clear()
        cls._discovered = False
