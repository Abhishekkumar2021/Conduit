"""
Conduit Engine — Processor auto-discovery and registry.

Scans the processors/impl/ directory on startup and registers all
@processor-decorated classes.  Mirrors the AdapterRegistry pattern.
"""

from __future__ import annotations

import importlib
import logging
import pkgutil
from pathlib import Path
from typing import Any

from conduit.engine.processors.base import BaseProcessor, ProcessorMeta

logger = logging.getLogger(__name__)


class ProcessorRegistry:
    """
    Central registry of all available processors.

    Usage:
        ProcessorRegistry.discover()       # Call once at startup
        ProcessorRegistry.get("filter")    # Get processor class by type
        ProcessorRegistry.list_all()       # Get all processor metadata for API
    """

    _processors: dict[str, type[BaseProcessor]] = {}
    _discovered: bool = False

    @classmethod
    def discover(cls) -> None:
        """Auto-discover all processor classes in impl/ subdirectory."""
        if cls._discovered:
            return

        impl_dir = Path(__file__).parent / "impl"
        if not impl_dir.is_dir():
            logger.warning("Processors impl/ directory not found")
            cls._discovered = True
            return

        pkg_name = "conduit.engine.processors.impl"
        for _, module_name, _ in pkgutil.iter_modules([str(impl_dir)]):
            try:
                module = importlib.import_module(f"{pkg_name}.{module_name}")
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if (
                        isinstance(attr, type)
                        and issubclass(attr, BaseProcessor)
                        and attr is not BaseProcessor
                        and hasattr(attr, "meta")
                    ):
                        cls._processors[attr.meta.type] = attr
                        logger.info("Registered processor: %s", attr.meta.type)
            except Exception:
                logger.exception(
                    "Failed to load processor module: %s.%s", pkg_name, module_name
                )

        cls._discovered = True
        logger.info("Discovered %d processors", len(cls._processors))

    @classmethod
    def get(cls, processor_type: str) -> type[BaseProcessor]:
        """Get a processor class by its type identifier."""
        cls.discover()
        normalized = processor_type.strip().lower()
        if normalized not in cls._processors:
            available = ", ".join(sorted(cls._processors.keys()))
            msg = (
                f"Unknown processor type: '{processor_type}'. "
                f"Available: {available}"
            )
            raise KeyError(msg)
        return cls._processors[normalized]

    @classmethod
    def create(
        cls, processor_type: str, config: dict[str, Any] | None = None
    ) -> BaseProcessor:
        """Create a processor instance with the given config."""
        processor_cls = cls.get(processor_type)
        return processor_cls(config)

    @classmethod
    def list_all(cls) -> list[ProcessorMeta]:
        """Return metadata for all registered processors (served to UI via API)."""
        cls.discover()
        return [p.meta for p in cls._processors.values()]

    @classmethod
    def reset(cls) -> None:
        """Reset the registry (for testing)."""
        cls._processors.clear()
        cls._discovered = False
