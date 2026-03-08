"""Tests for conduit.engine.adapters.base."""

from __future__ import annotations

from typing import Any, Generator

import pytest

from conduit.engine.adapters.base import BaseAdapter, adapter


@adapter(type="demo", name="Demo", category="api")
class _DemoAdapter(BaseAdapter):
    vault_fields = ["token:secret"]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.connected = False
        self.disconnected = False

    def connect(self) -> None:
        self.connected = True

    def disconnect(self) -> None:
        self.disconnected = True

    def test(self) -> bool:
        return True

    def discover(self) -> list[dict]:
        return [{"qualified_name": "x", "asset_type": "collection"}]

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        yield [{"asset": asset, **options}]

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        return len(records)


@adapter(
    type="demo-cap",
    name="DemoCap",
    category="sql",
    capabilities=["read", "discover"],
)
class _CapAdapter(_DemoAdapter):
    pass


def test_adapter_decorator_sets_meta_defaults_and_to_dict():
    meta = _DemoAdapter.meta
    assert meta.type == "demo"
    assert meta.name == "Demo"
    assert meta.category == "api"
    assert meta.vault_fields == ["token:secret"]
    assert meta.capabilities == ["read", "write", "discover"]
    assert meta.to_dict() == {
        "type": "demo",
        "name": "Demo",
        "category": "api",
        "capabilities": ["read", "write", "discover"],
    }


def test_adapter_decorator_respects_custom_capabilities():
    assert _CapAdapter.meta.capabilities == ["read", "discover"]


def test_session_context_manager_connects_and_disconnects():
    adapter_instance = _DemoAdapter(config={})
    assert adapter_instance._connected is False

    with adapter_instance.session() as live:
        assert live.connected is True
        assert live._connected is True

    assert adapter_instance.disconnected is True
    assert adapter_instance._connected is False


def test_session_context_manager_disconnects_on_error():
    adapter_instance = _DemoAdapter(config={})

    with pytest.raises(RuntimeError, match="boom"):
        with adapter_instance.session():
            raise RuntimeError("boom")

    assert adapter_instance.disconnected is True
    assert adapter_instance._connected is False
