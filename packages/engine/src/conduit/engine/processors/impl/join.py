"""Join processor — merge two datasets on a common key."""

from __future__ import annotations

from typing import Any

from conduit.engine.processors.base import BaseProcessor, processor


@processor(
    type="join",
    name="Join",
    category="advanced",
    description="Join two datasets on a common key",
    parameters=[
        {"name": "join_key", "type": "string", "required": True},
        {"name": "join_type", "type": "string", "required": False,
         "options": ["inner", "left", "right", "outer"]},
    ],
)
class JoinProcessor(BaseProcessor):
    """Merge records from two datasets based on a shared key."""

    def validate_config(self) -> None:
        if "join_key" not in self._config:
            raise ValueError("JoinProcessor requires 'join_key'")
        join_type = self._config.get("join_type", "inner")
        if join_type not in ("inner", "left", "right", "outer"):
            raise ValueError(
                f"Unknown join_type: '{join_type}'. "
                "Use: inner, left, right, outer"
            )

    def process(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.validate_config()
        key = self._config["join_key"]
        join_type = self._config.get("join_type", "inner")
        right_records: list[dict[str, Any]] = self._config.get("right", [])

        right_index: dict[Any, list[dict[str, Any]]] = {}
        for r in right_records:
            right_index.setdefault(r.get(key), []).append(r)

        result: list[dict[str, Any]] = []
        matched_right_keys: set[Any] = set()

        for left in records:
            left_key = left.get(key)
            matches = right_index.get(left_key, [])

            if matches:
                matched_right_keys.add(left_key)
                for right in matches:
                    result.append({**left, **right})
            elif join_type in ("left", "outer"):
                result.append(left)

        if join_type in ("right", "outer"):
            for right in right_records:
                if right.get(key) not in matched_right_keys:
                    result.append(right)

        return result
