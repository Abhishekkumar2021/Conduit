"""Merge processor — merge multiple columns into a single column."""

from __future__ import annotations

from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor


@processor(
    type="merge",
    name="Merge Columns",
    category="core",
    description="Merge multiple columns into a single column with a separator",
    parameters=[
        {"name": "columns", "type": "array", "required": True,
         "description": "List of source column names to merge"},
        {"name": "target", "type": "string", "required": True,
         "description": "Output column name"},
        {"name": "separator", "type": "string", "required": False,
         "description": "Separator between values (default ' ')"},
        {"name": "drop_sources", "type": "boolean", "required": False,
         "description": "Remove source columns after merge (default false)"},
    ],
)
class MergeProcessor(BaseProcessor):
    """Merge multiple columns into one, joined by a separator."""

    def validate_config(self) -> None:
        columns = self._config.get("columns")
        if not columns or not isinstance(columns, list):
            raise ValueError("MergeProcessor requires 'columns' as a non-empty list")
        if not self._config.get("target"):
            raise ValueError("MergeProcessor requires 'target'")

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        columns: list[str] = self._config["columns"]
        target: str = self._config["target"]
        separator: str = self._config.get("separator", " ")
        drop_sources: bool = self._config.get("drop_sources", False)

        result: list[dict[str, Any]] = []
        for record in records:
            new_record = {**record}
            parts = [str(record[col]) for col in columns if col in record and record[col] is not None]
            new_record[target] = separator.join(parts)

            if drop_sources:
                for col in columns:
                    new_record.pop(col, None)

            result.append(new_record)
        return result
