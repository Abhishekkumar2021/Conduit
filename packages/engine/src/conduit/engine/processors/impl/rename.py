"""Rename processor — rename columns."""

from __future__ import annotations

from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor


@processor(
    type="rename",
    name="Rename Columns",
    category="core",
    description="Rename one or more columns",
    parameters=[
        {"name": "mapping", "type": "object", "required": True,
         "description": "Key-value pairs: {old_name: new_name}"},
    ],
)
class RenameProcessor(BaseProcessor):
    """Rename columns using a mapping dict."""

    def validate_config(self) -> None:
        mapping = self._config.get("mapping")
        if not mapping or not isinstance(mapping, dict):
            raise ValueError("RenameProcessor requires 'mapping' as a dict")

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        mapping = self._config["mapping"]

        result = []
        for record in records:
            new_record = {}
            for key, value in record.items():
                new_key = mapping.get(key, key)
                new_record[new_key] = value
            result.append(new_record)
        return result
