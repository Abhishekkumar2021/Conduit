"""Validate processor — validate records against schema rules."""

from __future__ import annotations

import re
from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor

CHECKS = {"required", "type", "min_length", "max_length", "min_value", "max_value", "pattern"}
TYPE_MAP = {
    "string": str,
    "int": int,
    "float": (int, float),
    "bool": bool,
}


def _run_check(record: dict[str, Any], rule: dict[str, Any]) -> str | None:
    """Run a single validation rule. Returns an error message or None."""
    col = rule["column"]
    check = rule["check"]
    value = record.get(col)

    if check == "required":
        if value is None:
            return f"'{col}' is required"
        return None

    if value is None:
        return None

    if check == "type":
        expected = rule.get("value", "string")
        py_type = TYPE_MAP.get(expected)
        if py_type is None:
            return f"Unknown type check value: '{expected}'"
        if not isinstance(value, py_type):
            return f"'{col}' expected type {expected}, got {type(value).__name__}"

    elif check == "min_length":
        if len(str(value)) < rule["value"]:
            return f"'{col}' length below minimum {rule['value']}"

    elif check == "max_length":
        if len(str(value)) > rule["value"]:
            return f"'{col}' length exceeds maximum {rule['value']}"

    elif check == "min_value":
        if value < rule["value"]:
            return f"'{col}' value below minimum {rule['value']}"

    elif check == "max_value":
        if value > rule["value"]:
            return f"'{col}' value exceeds maximum {rule['value']}"

    elif check == "pattern":
        if not re.search(rule["value"], str(value)):
            return f"'{col}' does not match pattern '{rule['value']}'"

    return None


@processor(
    type="validate",
    name="Validate",
    category="advanced",
    description="Validate records against schema rules, marking or dropping invalid ones",
    parameters=[
        {"name": "rules", "type": "array", "required": True,
         "description": "List of {column, check, value?} validation rules"},
        {"name": "on_fail", "type": "string", "required": False,
         "options": ["drop", "tag"],
         "description": "Action on failure: 'drop' removes invalid records, 'tag' adds errors field"},
    ],
)
class ValidateProcessor(BaseProcessor):
    """Validate records and either tag or drop invalid ones."""

    def validate_config(self) -> None:
        rules = self._config.get("rules")
        if not rules or not isinstance(rules, list):
            raise ValueError("ValidateProcessor requires 'rules' as a non-empty list")
        for rule in rules:
            if not isinstance(rule, dict):
                raise ValueError("Each rule must be a dict")
            if "column" not in rule:
                raise ValueError("Each rule must include 'column'")
            check = rule.get("check")
            if check not in CHECKS:
                raise ValueError(
                    f"Unknown check: '{check}'. Use: {sorted(CHECKS)}"
                )
        on_fail = self._config.get("on_fail", "tag")
        if on_fail not in ("drop", "tag"):
            raise ValueError("'on_fail' must be 'drop' or 'tag'")

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        rules: list[dict[str, Any]] = self._config["rules"]
        on_fail: str = self._config.get("on_fail", "tag")

        result: list[dict[str, Any]] = []
        for record in records:
            errors: list[str] = []
            for rule in rules:
                msg = _run_check(record, rule)
                if msg:
                    errors.append(msg)

            if not errors:
                result.append(record)
            elif on_fail == "drop":
                continue
            else:
                tagged = {**record, "_validation_errors": errors}
                result.append(tagged)

        return result
