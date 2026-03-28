"""Regex Replace processor — substitute text matching a regex pattern."""

from __future__ import annotations

import re
from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor


@processor(
    type="regex_replace",
    name="Regex Replace",
    category="advanced",
    description="Replace text matching a regex pattern",
    parameters=[
        {"name": "column", "type": "string", "required": True},
        {"name": "pattern", "type": "string", "required": True},
        {"name": "replacement", "type": "string", "required": True},
    ],
)
class RegexReplaceProcessor(BaseProcessor):
    """Apply a regex substitution on a specified column."""

    def validate_config(self) -> None:
        for param in ("column", "pattern", "replacement"):
            if param not in self._config:
                raise ValueError(f"RegexReplaceProcessor requires '{param}'")
        try:
            re.compile(self._config["pattern"])
        except re.error as exc:
            raise ValueError(
                f"Invalid regex pattern: {self._config['pattern']}"
            ) from exc

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        col = self._config["column"]
        pattern = re.compile(self._config["pattern"])
        replacement = self._config["replacement"]

        result: list[dict[str, Any]] = []
        for record in records:
            record = dict(record)
            if col in record and isinstance(record[col], str):
                record[col] = pattern.sub(replacement, record[col])
            result.append(record)
        return result
