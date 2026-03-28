"""
Conduit Engine — Base processor and registration decorator.

Every processor inherits from BaseProcessor and uses the @processor decorator.
Processors are simple: input records → process → output records.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ProcessorMeta:
    """Metadata describing a processor — served to the UI via the API."""

    type: str
    name: str
    category: str  # 'core', 'advanced'
    description: str = ""
    parameters: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "parameters": self.parameters,
        }


class BaseProcessor(ABC):
    """
    Abstract base class for all data processors.

    A processor takes a list of record dicts and returns a transformed
    list of record dicts. Configuration is passed at init time.
    """

    meta: ProcessorMeta

    def __init__(self, config: dict[str, Any] | None = None):
        self._config = config or {}

    @abstractmethod
    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Process a batch of records.

        Args:
            records: List of record dicts (each dict is one row).

        Returns:
            Transformed list of record dicts.
        """

    def validate_config(self) -> None:
        """
        Validate processor configuration. Override for custom validation.
        Raises ValueError if config is invalid.
        """


def processor(
    *,
    type: str,
    name: str,
    category: str = "core",
    description: str = "",
    parameters: list[dict[str, Any]] | None = None,
) -> Any:
    """
    Decorator to register a processor class.

    Usage:
        @processor(
            type="filter",
            name="Filter",
            description="Keep rows matching a condition",
            parameters=[{"name": "column", "type": "string", "required": True}],
        )
        class FilterProcessor(BaseProcessor):
            ...
    """

    def decorator(cls: type[BaseProcessor]) -> type[BaseProcessor]:
        cls.meta = ProcessorMeta(
            type=type,
            name=name,
            category=category,
            description=description,
            parameters=parameters or [],
        )
        return cls

    return decorator
