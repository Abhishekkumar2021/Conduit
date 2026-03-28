"""Aggregate processor — group records by key columns and apply aggregate functions."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor

AGGREGATE_FUNCTIONS = {"count", "sum", "avg", "min", "max", "first", "last"}


def _apply_aggregation(
    values: list[Any], function: str,
) -> Any:
    non_null = [v for v in values if v is not None]

    if function == "count":
        return len(non_null)
    if not non_null:
        return None
    if function == "sum":
        return sum(non_null)
    if function == "avg":
        return sum(non_null) / len(non_null)
    if function == "min":
        return min(non_null)
    if function == "max":
        return max(non_null)
    if function == "first":
        return values[0]
    if function == "last":
        return values[-1]
    raise ValueError(f"Unknown aggregate function: '{function}'")


@processor(
    type="aggregate",
    name="Aggregate",
    category="advanced",
    description="Group records by key columns and apply aggregate functions",
    parameters=[
        {"name": "group_by", "type": "array", "required": True,
         "description": "List of column names to group by"},
        {"name": "aggregations", "type": "array", "required": True,
         "description": "List of {column, function, target} aggregation specs"},
    ],
)
class AggregateProcessor(BaseProcessor):
    """Group records and compute aggregate values."""

    def validate_config(self) -> None:
        if not self._config.get("group_by"):
            raise ValueError("AggregateProcessor requires 'group_by' as a non-empty list")
        aggregations = self._config.get("aggregations")
        if not aggregations or not isinstance(aggregations, list):
            raise ValueError("AggregateProcessor requires 'aggregations' as a non-empty list")
        for agg in aggregations:
            if not isinstance(agg, dict):
                raise ValueError("Each aggregation must be a dict")
            for key in ("column", "function", "target"):
                if key not in agg:
                    raise ValueError(f"Each aggregation must include '{key}'")
            if agg["function"] not in AGGREGATE_FUNCTIONS:
                raise ValueError(
                    f"Unknown function: '{agg['function']}'. "
                    f"Use: {sorted(AGGREGATE_FUNCTIONS)}"
                )

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        group_by: list[str] = self._config["group_by"]
        aggregations: list[dict[str, str]] = self._config["aggregations"]

        groups: dict[tuple, list[dict[str, Any]]] = defaultdict(list)
        for record in records:
            key = tuple(record.get(col) for col in group_by)
            groups[key].append(record)

        result: list[dict[str, Any]] = []
        for key, group_records in groups.items():
            row: dict[str, Any] = dict(zip(group_by, key))
            for agg in aggregations:
                values = [r.get(agg["column"]) for r in group_records]
                row[agg["target"]] = _apply_aggregation(values, agg["function"])
            result.append(row)

        return result
