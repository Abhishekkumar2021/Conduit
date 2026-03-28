"""Expression processor — compute a new column using a safe expression language."""

from __future__ import annotations

import re
from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor

_TOKEN_RE = re.compile(
    r"""
      \s*(?:
        (\d+(?:\.\d+)?)           # numeric literal
      | (//|[+\-*/%])             # operator
      | "([^"]*)"                 # double-quoted string literal
      | '([^']*)'                 # single-quoted string literal
      | ([A-Za-z_][A-Za-z0-9_]*) # column reference / identifier
      )\s*
    """,
    re.VERBOSE,
)


def _tokenize(expression: str) -> list[tuple[str, Any]]:
    tokens: list[tuple[str, Any]] = []
    pos = 0
    while pos < len(expression):
        m = _TOKEN_RE.match(expression, pos)
        if not m:
            raise ValueError(
                f"Unexpected character at position {pos}: '{expression[pos]}'"
            )
        if m.group(1) is not None:
            num = float(m.group(1)) if "." in m.group(1) else int(m.group(1))
            tokens.append(("NUM", num))
        elif m.group(2) is not None:
            tokens.append(("OP", m.group(2)))
        elif m.group(3) is not None:
            tokens.append(("STR", m.group(3)))
        elif m.group(4) is not None:
            tokens.append(("STR", m.group(4)))
        elif m.group(5) is not None:
            tokens.append(("COL", m.group(5)))
        pos = m.end()
    return tokens


def _evaluate(tokens: list[tuple[str, Any]], record: dict[str, Any]) -> Any:
    """Evaluate a flat sequence of value-op-value tokens (left-to-right, no precedence)."""
    if not tokens:
        raise ValueError("Empty expression")

    def _resolve(token: tuple[str, Any]) -> Any:
        kind, val = token
        if kind == "COL":
            if val not in record:
                raise ValueError(f"Column '{val}' not found in record")
            return record[val]
        return val  # NUM or STR

    values: list[Any] = [_resolve(tokens[0])]
    ops: list[str] = []

    i = 1
    while i < len(tokens):
        if tokens[i][0] != "OP":
            raise ValueError(f"Expected operator, got {tokens[i]}")
        ops.append(tokens[i][1])
        i += 1
        if i >= len(tokens):
            raise ValueError("Expression ends with an operator")
        values.append(_resolve(tokens[i]))
        i += 1

    # Evaluate * / // % first, then + -
    for precedence_ops in [{"*", "/", "//", "%"}, {"+", "-"}]:
        j = 0
        while j < len(ops):
            if ops[j] in precedence_ops:
                values[j] = _apply_op(ops[j], values[j], values[j + 1])
                values.pop(j + 1)
                ops.pop(j)
            else:
                j += 1

    return values[0]


def _apply_op(op: str, left: Any, right: Any) -> Any:
    if op == "+":
        if isinstance(left, str) or isinstance(right, str):
            return str(left) + str(right)
        return left + right
    if op == "-":
        return left - right
    if op == "*":
        return left * right
    if op == "/":
        if right == 0:
            raise ValueError("Division by zero")
        return left / right
    if op == "//":
        if right == 0:
            raise ValueError("Division by zero")
        return left // right
    if op == "%":
        if right == 0:
            raise ValueError("Modulo by zero")
        return left % right
    raise ValueError(f"Unknown operator: '{op}'")


@processor(
    type="expression",
    name="Expression",
    category="advanced",
    description="Compute a new column using a safe expression language",
    parameters=[
        {"name": "target", "type": "string", "required": True,
         "description": "Output column name"},
        {"name": "expression", "type": "string", "required": True,
         "description": "Expression like 'col1 + col2' or 'price * 100'"},
    ],
)
class ExpressionProcessor(BaseProcessor):
    """Compute a new column from a safe arithmetic/string expression."""

    def validate_config(self) -> None:
        if not self._config.get("target"):
            raise ValueError("ExpressionProcessor requires 'target'")
        expr = self._config.get("expression")
        if not expr or not isinstance(expr, str):
            raise ValueError("ExpressionProcessor requires 'expression' as a non-empty string")
        _tokenize(expr)

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        target = self._config["target"]
        tokens = _tokenize(self._config["expression"])

        result: list[dict[str, Any]] = []
        for record in records:
            new_record = {**record, target: _evaluate(tokens, record)}
            result.append(new_record)
        return result
