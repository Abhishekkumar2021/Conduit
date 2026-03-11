"""Sort processor — order rows by one or more columns."""

from __future__ import annotations

from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor


@processor(
    type="sort",
    name="Sort",
    category="core",
    description="Order rows by one or more columns",
    parameters=[
        {"name": "by", "type": "array", "required": True,
         "description": "Column names to sort by"},
        {"name": "descending", "type": "boolean", "required": False,
         "description": "Sort in descending order (default: False)"},
    ],
)
class SortProcessor(BaseProcessor):
    """Sort records by one or more columns."""

    def validate_config(self) -> None:
        by = self._config.get("by")
        if not by or not isinstance(by, list):
            raise ValueError("SortProcessor requires 'by' as a list of column names")

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        by = self._config["by"]
        descending = self._config.get("descending", False)

        def sort_key(record: dict[str, Any]) -> tuple:
            return tuple(record.get(col) for col in by)

        try:
            return sorted(records, key=sort_key, reverse=descending)
        except TypeError:
            # Fallback for mixed/None types — stringify for comparison
            def safe_key(record: dict[str, Any]) -> tuple:
                return tuple(str(record.get(col, "")) for col in by)
            return sorted(records, key=safe_key, reverse=descending)
