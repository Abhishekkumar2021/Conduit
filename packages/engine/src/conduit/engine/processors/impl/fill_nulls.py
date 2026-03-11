"""Fill nulls processor — handle null/missing values."""

from __future__ import annotations

from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor

STRATEGIES = {"value", "forward", "backward", "mean", "median", "mode"}


@processor(
    type="fill_nulls",
    name="Fill Nulls",
    category="core",
    description="Replace null/missing values with a fill strategy",
    parameters=[
        {"name": "columns", "type": "array", "required": True,
         "description": "Column names to fill"},
        {"name": "strategy", "type": "string", "required": False,
         "description": "Fill strategy: value, forward, backward, mean, median, mode"},
        {"name": "value", "type": "any", "required": False,
         "description": "Fill value when strategy is 'value'"},
    ],
)
class FillNullsProcessor(BaseProcessor):
    """Fill null/missing values using various strategies."""

    def validate_config(self) -> None:
        if not self._config.get("columns"):
            raise ValueError("FillNullsProcessor requires 'columns'")
        strategy = self._config.get("strategy", "value")
        if strategy not in STRATEGIES:
            raise ValueError(f"Unknown strategy: '{strategy}'. Use: {STRATEGIES}")

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        columns = self._config["columns"]
        strategy = self._config.get("strategy", "value")
        fill_value = self._config.get("value")

        if strategy == "value":
            return self._fill_with_value(records, columns, fill_value)
        elif strategy == "forward":
            return self._fill_forward(records, columns)
        elif strategy == "backward":
            return self._fill_backward(records, columns)
        elif strategy in ("mean", "median", "mode"):
            return self._fill_with_stat(records, columns, strategy)
        return records

    def _fill_with_value(
        self, records: list[dict], columns: list[str], value: Any
    ) -> list[dict]:
        result = []
        for record in records:
            new_record = dict(record)
            for col in columns:
                if new_record.get(col) is None:
                    new_record[col] = value
            result.append(new_record)
        return result

    def _fill_forward(self, records: list[dict], columns: list[str]) -> list[dict]:
        last_values: dict[str, Any] = {}
        result = []
        for record in records:
            new_record = dict(record)
            for col in columns:
                if new_record.get(col) is not None:
                    last_values[col] = new_record[col]
                elif col in last_values:
                    new_record[col] = last_values[col]
            result.append(new_record)
        return result

    def _fill_backward(self, records: list[dict], columns: list[str]) -> list[dict]:
        # Reverse, forward fill, reverse back
        reversed_records = list(reversed(records))
        filled = self._fill_forward(reversed_records, columns)
        filled.reverse()
        return filled

    def _fill_with_stat(
        self, records: list[dict], columns: list[str], stat: str
    ) -> list[dict]:
        computed: dict[str, Any] = {}
        for col in columns:
            values = [r[col] for r in records if r.get(col) is not None]
            numeric = [v for v in values if isinstance(v, (int, float))]

            if stat == "mean" and numeric:
                computed[col] = sum(numeric) / len(numeric)
            elif stat == "median" and numeric:
                s = sorted(numeric)
                n = len(s)
                computed[col] = s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
            elif stat == "mode" and values:
                counts: dict[Any, int] = {}
                for v in values:
                    counts[v] = counts.get(v, 0) + 1
                computed[col] = max(counts, key=lambda k: counts[k])

        return self._fill_with_value(records, columns, None) if not computed else [
            {**record, **{col: computed.get(col, record.get(col)) if record.get(col) is None else record[col] for col in columns}}
            for record in records
        ]
