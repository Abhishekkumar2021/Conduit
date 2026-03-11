"""Filter processor — keep rows matching a condition."""

from __future__ import annotations

import operator
from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor

OPERATORS = {
    "eq": operator.eq,
    "ne": operator.ne,
    "gt": operator.gt,
    "ge": operator.ge,
    "lt": operator.lt,
    "le": operator.le,
    "in": lambda a, b: a in b,
    "not_in": lambda a, b: a not in b,
    "contains": lambda a, b: b in str(a),
    "is_null": lambda a, _: a is None,
    "is_not_null": lambda a, _: a is not None,
}


@processor(
    type="filter",
    name="Filter",
    category="core",
    description="Keep rows matching a condition",
    parameters=[
        {"name": "column", "type": "string", "required": True},
        {"name": "operator", "type": "string", "required": True,
         "options": list(OPERATORS.keys())},
        {"name": "value", "type": "any", "required": False},
    ],
)
class FilterProcessor(BaseProcessor):
    """Filter rows based on a column condition."""

    def validate_config(self) -> None:
        if "column" not in self._config:
            raise ValueError("FilterProcessor requires 'column'")
        op = self._config.get("operator", "eq")
        if op not in OPERATORS:
            raise ValueError(f"Unknown operator: '{op}'. Use: {list(OPERATORS.keys())}")

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        col = self._config["column"]
        op_name = self._config.get("operator", "eq")
        value = self._config.get("value")
        op_fn = OPERATORS[op_name]

        return [r for r in records if col in r and op_fn(r[col], value)]
