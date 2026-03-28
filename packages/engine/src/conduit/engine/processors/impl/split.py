"""Split processor — split a column's value into multiple columns."""

from __future__ import annotations

from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor


@processor(
    type="split",
    name="Split Column",
    category="core",
    description="Split a column's value into multiple columns by delimiter",
    parameters=[
        {"name": "column", "type": "string", "required": True,
         "description": "Source column to split"},
        {"name": "delimiter", "type": "string", "required": False,
         "description": "Delimiter to split on (default ',')"},
        {"name": "targets", "type": "array", "required": True,
         "description": "List of output column names for the split parts"},
    ],
)
class SplitProcessor(BaseProcessor):
    """Split a single column into multiple columns by delimiter."""

    def validate_config(self) -> None:
        if not self._config.get("column"):
            raise ValueError("SplitProcessor requires 'column'")
        targets = self._config.get("targets")
        if not targets or not isinstance(targets, list):
            raise ValueError("SplitProcessor requires 'targets' as a non-empty list")

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        col = self._config["column"]
        delimiter = self._config.get("delimiter", ",")
        targets: list[str] = self._config["targets"]

        result: list[dict[str, Any]] = []
        for record in records:
            new_record = {**record}
            value = record.get(col)
            if value is None:
                parts: list[str | None] = []
            else:
                parts = str(value).split(delimiter)

            for i, target in enumerate(targets):
                new_record[target] = parts[i] if i < len(parts) else None

            result.append(new_record)
        return result
