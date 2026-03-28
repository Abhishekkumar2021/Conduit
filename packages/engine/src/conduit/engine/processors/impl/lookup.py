"""Lookup processor — enrich records from a lookup table."""

from __future__ import annotations

from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor


@processor(
    type="lookup",
    name="Lookup",
    category="advanced",
    description="Enrich records with values from a lookup table",
    parameters=[
        {"name": "lookup_key", "type": "string", "required": True},
        {"name": "lookup_table", "type": "object", "required": True},
        {"name": "default_value", "type": "string", "required": False},
    ],
)
class LookupProcessor(BaseProcessor):
    """Add a looked-up value to each record based on a key column."""

    def validate_config(self) -> None:
        if "lookup_key" not in self._config:
            raise ValueError("LookupProcessor requires 'lookup_key'")
        if "lookup_table" not in self._config:
            raise ValueError("LookupProcessor requires 'lookup_table'")
        if not isinstance(self._config["lookup_table"], dict):
            raise ValueError("'lookup_table' must be a dict")

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        key = self._config["lookup_key"]
        table: dict[str, Any] = self._config["lookup_table"]
        default = self._config.get("default_value", "")

        result: list[dict[str, Any]] = []
        for record in records:
            record = dict(record)
            key_value = str(record.get(key, ""))
            record["lookup_value"] = table.get(key_value, default)
            result.append(record)
        return result
