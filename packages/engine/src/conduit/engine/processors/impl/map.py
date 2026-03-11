"""Map processor — apply a function to a column."""

from __future__ import annotations

from typing import Any, Callable

from conduit.engine.processors.base import BaseProcessor, processor

BUILT_IN_FUNCTIONS: dict[str, Callable[[Any], Any]] = {
    "upper": lambda v: str(v).upper() if v is not None else v,
    "lower": lambda v: str(v).lower() if v is not None else v,
    "strip": lambda v: str(v).strip() if v is not None else v,
    "title": lambda v: str(v).title() if v is not None else v,
    "length": lambda v: len(str(v)) if v is not None else 0,
    "abs": lambda v: abs(v) if isinstance(v, (int, float)) else v,
    "round": lambda v: round(v) if isinstance(v, (int, float)) else v,
    "negate": lambda v: -v if isinstance(v, (int, float)) else v,
    "is_empty": lambda v: v is None or str(v).strip() == "",
    "to_string": lambda v: str(v) if v is not None else "",
}


@processor(
    type="map",
    name="Map",
    category="core",
    description="Apply a built-in function to a column",
    parameters=[
        {"name": "column", "type": "string", "required": True},
        {"name": "function", "type": "string", "required": True,
         "options": list(BUILT_IN_FUNCTIONS.keys())},
        {"name": "target", "type": "string", "required": False,
         "description": "Output column name (default: overwrite source column)"},
    ],
)
class MapProcessor(BaseProcessor):
    """Apply a built-in function to each value in a column."""

    def validate_config(self) -> None:
        if "column" not in self._config:
            raise ValueError("MapProcessor requires 'column'")
        fn_name = self._config.get("function")
        if fn_name not in BUILT_IN_FUNCTIONS:
            raise ValueError(
                f"Unknown function: '{fn_name}'. "
                f"Available: {list(BUILT_IN_FUNCTIONS.keys())}"
            )

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        col = self._config["column"]
        fn_name = self._config["function"]
        target = self._config.get("target", col)
        fn = BUILT_IN_FUNCTIONS[fn_name]

        result = []
        for record in records:
            new_record = dict(record)
            if col in new_record:
                new_record[target] = fn(new_record[col])
            result.append(new_record)
        return result
