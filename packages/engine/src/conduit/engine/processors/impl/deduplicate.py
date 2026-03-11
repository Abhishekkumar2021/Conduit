"""Deduplicate processor — remove duplicate rows."""

from __future__ import annotations

import json
from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor


@processor(
    type="deduplicate",
    name="Deduplicate",
    category="core",
    description="Remove duplicate rows, optionally by specific columns",
    parameters=[
        {"name": "columns", "type": "array", "required": False,
         "description": "Columns to check for duplicates (default: all columns)"},
        {"name": "keep", "type": "string", "required": False,
         "description": "'first' or 'last' (default: 'first')"},
    ],
)
class DeduplicateProcessor(BaseProcessor):
    """Remove duplicate records."""

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        columns = self._config.get("columns")
        keep = self._config.get("keep", "first")

        if keep == "last":
            records = list(reversed(records))

        seen: set[str] = set()
        result = []

        for record in records:
            if columns:
                key = json.dumps({c: record.get(c) for c in columns}, sort_keys=True, default=str)
            else:
                key = json.dumps(record, sort_keys=True, default=str)

            if key not in seen:
                seen.add(key)
                result.append(record)

        if keep == "last":
            result.reverse()

        return result
