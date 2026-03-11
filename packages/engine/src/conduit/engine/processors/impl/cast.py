"""Cast processor — convert column data types."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor

CAST_FUNCTIONS: dict[str, Any] = {
    "string": str,
    "str": str,
    "integer": int,
    "int": int,
    "float": float,
    "boolean": lambda v: str(v).lower() in ("true", "1", "yes", "on"),
    "bool": lambda v: str(v).lower() in ("true", "1", "yes", "on"),
    "datetime": lambda v: datetime.fromisoformat(str(v)),
}


@processor(
    type="cast",
    name="Cast Types",
    category="core",
    description="Convert column data types",
    parameters=[
        {"name": "columns", "type": "object", "required": True,
         "description": "Mapping of column_name → target_type (string, int, float, bool, datetime)"},
    ],
)
class CastProcessor(BaseProcessor):
    """Convert column values to specified data types."""

    def validate_config(self) -> None:
        columns = self._config.get("columns")
        if not columns or not isinstance(columns, dict):
            raise ValueError("CastProcessor requires 'columns' as a dict")
        for col, target in columns.items():
            if target not in CAST_FUNCTIONS:
                raise ValueError(
                    f"Unknown type '{target}' for column '{col}'. "
                    f"Supported: {list(CAST_FUNCTIONS.keys())}"
                )

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        columns = self._config["columns"]

        result = []
        for record in records:
            new_record = dict(record)
            for col, target in columns.items():
                if col in new_record and new_record[col] is not None:
                    cast_fn = CAST_FUNCTIONS[target]
                    try:
                        new_record[col] = cast_fn(new_record[col])
                    except (ValueError, TypeError):
                        pass  # Keep original value on cast failure
            result.append(new_record)
        return result
