"""Drop processor — remove columns."""

from __future__ import annotations

from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor


@processor(
    type="drop",
    name="Drop Columns",
    category="core",
    description="Remove specified columns from records",
    parameters=[
        {"name": "columns", "type": "array", "required": True,
         "description": "List of column names to remove"},
    ],
)
class DropProcessor(BaseProcessor):
    """Remove specified columns from each record."""

    def validate_config(self) -> None:
        columns = self._config.get("columns")
        if not columns or not isinstance(columns, list):
            raise ValueError("DropProcessor requires 'columns' as a list")

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        drop_set = set(self._config["columns"])

        return [
            {k: v for k, v in record.items() if k not in drop_set}
            for record in records
        ]
