"""Tests for PostgreSQL adapter config normalization."""

from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy.engine import URL

from conduit.engine.adapters.sql.postgres import PostgresAdapter


class _FakeConnection:
    def execute(self, _query: Any) -> list[Any]:
        return []


class _FakeBegin:
    def __enter__(self) -> _FakeConnection:
        return _FakeConnection()

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class _FakeEngine:
    def begin(self) -> _FakeBegin:
        return _FakeBegin()

    def dispose(self) -> None:
        return None


def test_postgres_adapter_accepts_alias_config_keys(monkeypatch):
    captured: dict[str, Any] = {}

    def fake_create_engine(target):
        captured["target"] = target
        return _FakeEngine()

    monkeypatch.setattr("conduit.engine.adapters.sql.postgres.create_engine", fake_create_engine)

    adapter = PostgresAdapter(
        {
            "host": "db.internal",
            "port": "5544",
            "db": "analytics",
            "user": "svc_user",
            "password": "secret",
        }
    )
    adapter.connect()

    target = captured["target"]
    assert isinstance(target, URL)
    assert target.host == "db.internal"
    assert target.port == 5544
    assert target.database == "analytics"
    assert target.username == "svc_user"
    assert target.password == "secret"


def test_postgres_adapter_accepts_connection_url(monkeypatch):
    captured: dict[str, Any] = {}

    def fake_create_engine(target):
        captured["target"] = target
        return _FakeEngine()

    monkeypatch.setattr("conduit.engine.adapters.sql.postgres.create_engine", fake_create_engine)

    adapter = PostgresAdapter({"database_url": "postgresql://user:pw@db:5432/mydb"})
    adapter.connect()

    assert captured["target"] == "postgresql://user:pw@db:5432/mydb"


def test_postgres_adapter_requires_credentials_when_no_url():
    adapter = PostgresAdapter({"host": "db.internal"})
    with pytest.raises(ValueError, match="requires database and username"):
        adapter.connect()
