"""Custom Code processor — execute user-provided transformation code."""

from __future__ import annotations

from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor


@processor(
    type="code",
    name="Custom Code",
    category="advanced",
    description="Execute custom transformation code",
    parameters=[
        {"name": "code", "type": "string", "required": True},
        {"name": "language", "type": "string", "required": False,
         "options": ["python"]},
    ],
)
class CodeProcessor(BaseProcessor):
    """Execute user-supplied Python code with records available as ``records``."""

    def validate_config(self) -> None:
        if "code" not in self._config:
            raise ValueError("CodeProcessor requires 'code'")
        lang = self._config.get("language", "python")
        if lang != "python":
            raise ValueError(
                f"Unsupported language: '{lang}'. Only 'python' is supported."
            )

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        code = self._config["code"]

        namespace: dict[str, Any] = {"records": list(records)}
        exec(code, {"__builtins__": __builtins__}, namespace)  # noqa: S102

        result = namespace.get("records", records)
        if not isinstance(result, list):
            raise TypeError(
                "Custom code must leave 'records' as a list of dicts, "
                f"got {type(result).__name__}"
            )
        return result
