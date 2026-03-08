from typing import Any, Generator

import pytest

from conduit.engine.adapters.base import AdapterMeta, BaseAdapter
from conduit.engine.adapters.registry import AdapterRegistry


class _DummyAdapter(BaseAdapter):
    meta = AdapterMeta(type="postgresql", name="PostgreSQL", category="sql")

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
            yield []  # pragma: no cover
        return

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        return len(records)


def test_registry_rejects_noncanonical_adapter_name():
    AdapterRegistry.reset()
    AdapterRegistry._adapters["postgresql"] = _DummyAdapter
    AdapterRegistry._discovered = True

    assert AdapterRegistry.get("postgresql") is _DummyAdapter
    with pytest.raises(KeyError):
        AdapterRegistry.get("pg")
