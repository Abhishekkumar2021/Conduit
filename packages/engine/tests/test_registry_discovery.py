"""Additional tests for conduit.engine.adapters.registry."""

from __future__ import annotations

import importlib
import pkgutil
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Generator

import pytest

from conduit.engine.adapters.base import BaseAdapter, adapter
from conduit.engine.adapters.registry import AdapterRegistry


@adapter(type="demo-registry", name="Demo Registry", category="sql")
class _RegistryAdapter(BaseAdapter):
    def connect(self) -> None:
        return None

    def disconnect(self) -> None:
        return None

    def test(self) -> bool:
        return True

    def discover(self) -> list[dict]:
        return []

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        if False:
            yield []
        return

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        return len(records)


def test_registry_discover_registers_modules_and_skips_broken(monkeypatch):
    AdapterRegistry.reset()

    def fake_is_dir(self: Path) -> bool:
        return True

    def fake_iter_modules(paths):
        path = paths[0]
        if path.endswith("/sql"):
            return [
                (None, "good_adapter", False),
                (None, "broken_adapter", False),
            ]
        return []

    def fake_import(name: str):
        if name.endswith("good_adapter"):
            return SimpleNamespace(MyAdapter=_RegistryAdapter, noise="ignored")
        if name.endswith("broken_adapter"):
            raise RuntimeError("broken import")
        raise AssertionError(f"Unexpected module import: {name}")

    monkeypatch.setattr(Path, "is_dir", fake_is_dir)
    monkeypatch.setattr(pkgutil, "iter_modules", fake_iter_modules)
    monkeypatch.setattr(importlib, "import_module", fake_import)

    AdapterRegistry.discover()
    assert AdapterRegistry._discovered is True
    assert AdapterRegistry.get("demo-registry") is _RegistryAdapter


def test_registry_normalize_create_list_and_reset():
    AdapterRegistry.reset()
    AdapterRegistry._adapters["demo-registry"] = _RegistryAdapter
    AdapterRegistry._discovered = True

    assert AdapterRegistry.normalize_type("  DEMO-REGISTRY  ") == "demo-registry"

    adapter_instance = AdapterRegistry.create("demo-registry", {"k": "v"})
    assert isinstance(adapter_instance, _RegistryAdapter)
    assert adapter_instance._config == {"k": "v"}

    listed = AdapterRegistry.list_all()
    assert len(listed) == 1
    assert listed[0].type == "demo-registry"

    AdapterRegistry.reset()
    assert AdapterRegistry._adapters == {}
    assert AdapterRegistry._discovered is False


def test_registry_get_unknown_type_error_has_available_names():
    AdapterRegistry.reset()
    AdapterRegistry._adapters["demo-registry"] = _RegistryAdapter
    AdapterRegistry._discovered = True

    with pytest.raises(KeyError, match="Unknown adapter type"):
        AdapterRegistry.get("does-not-exist")
