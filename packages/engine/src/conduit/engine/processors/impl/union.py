"""Union processor — combine records from multiple sources."""

from __future__ import annotations

from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor


@processor(
    type="union",
    name="Union",
    category="core",
    description="Combine records from multiple sources",
    parameters=[],
)
class UnionProcessor(BaseProcessor):
    """Concatenate all record sets into a single list."""

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        additional: list[list[dict[str, Any]]] = self._config.get("sources", [])
        result = list(records)
        for source in additional:
            result.extend(source)
        return result
