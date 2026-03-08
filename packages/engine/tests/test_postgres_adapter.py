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

    monkeypatch.setattr(
        "conduit.engine.adapters.sql.postgres.create_engine", fake_create_engine
    )

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

    monkeypatch.setattr(
        "conduit.engine.adapters.sql.postgres.create_engine", fake_create_engine
    )

    adapter = PostgresAdapter({"database_url": "postgresql://user:pw@db:5432/mydb"})
    adapter.connect()

    assert captured["target"] == "postgresql://user:pw@db:5432/mydb"


def test_postgres_adapter_requires_credentials_when_no_url():
    adapter = PostgresAdapter({"host": "db.internal"})
    with pytest.raises(ValueError, match="requires database and username"):
        adapter.connect()


def test_postgres_adapter_empty_config_string(monkeypatch):
    captured = {}

    def fake_create_engine(target):
        captured["target"] = target
        return _FakeEngine()

    monkeypatch.setattr(
        "conduit.engine.adapters.sql.postgres.create_engine", fake_create_engine
    )

    adapter = PostgresAdapter(
        {
            "host": "db.internal",
            "database": "",
            "db": "analytics",
            "user": "svc_user",
        }
    )
    adapter.connect()
    assert captured["target"].database == "analytics"


def test_postgres_adapter_connect_twice(monkeypatch):
    monkeypatch.setattr(
        "conduit.engine.adapters.sql.postgres.create_engine", lambda t: _FakeEngine()
    )
    adapter = PostgresAdapter({"url": "postgresql://user:pw@db:5432/mydb"})
    adapter.connect()
    adapter.connect()
    assert adapter._connected


def test_postgres_adapter_bad_port():
    adapter = PostgresAdapter({"host": "h", "port": "bad", "db": "d", "user": "u"})
    with pytest.raises(ValueError, match="port must be an integer"):
        adapter.connect()


def test_postgres_adapter_connect_select_1_fails(monkeypatch):
    class ExplodingBegin(_FakeBegin):
        def __enter__(self):
            class ExplodingConnection(_FakeConnection):
                def execute(self, query):
                    raise RuntimeError("Boom")

            return ExplodingConnection()

    class ExplodingEngine(_FakeEngine):
        def begin(self):
            return ExplodingBegin()

        def dispose(self):
            pass

    monkeypatch.setattr(
        "conduit.engine.adapters.sql.postgres.create_engine",
        lambda t: ExplodingEngine(),
    )
    adapter = PostgresAdapter({"url": "postgresql://user:pw@db:5432/mydb"})
    with pytest.raises(ConnectionError, match="Failed to connect to PostgreSQL: Boom"):
        adapter.connect()


def test_postgres_adapter_disconnect(monkeypatch):
    monkeypatch.setattr(
        "conduit.engine.adapters.sql.postgres.create_engine", lambda t: _FakeEngine()
    )
    adapter = PostgresAdapter({"url": "postgresql://user:pw@db:5432/mydb"})
    adapter.connect()
    adapter.disconnect()
    assert not adapter._connected
    assert adapter.engine is None


def test_postgres_adapter_test_method(monkeypatch):
    monkeypatch.setattr(
        "conduit.engine.adapters.sql.postgres.create_engine", lambda t: _FakeEngine()
    )
    adapter = PostgresAdapter({"url": "postgresql://user:pw@db:5432/mydb"})
    assert adapter.test() is True


def test_postgres_adapter_test_method_fails(monkeypatch):
    class ExplodingBegin(_FakeBegin):
        def __enter__(self):
            class ExplodingConnection(_FakeConnection):
                def execute(self, *args, **kwargs):
                    raise RuntimeError("Boom")

            return ExplodingConnection()

    class ExplodingEngine(_FakeEngine):
        def begin(self):
            return ExplodingBegin()

    adapter = PostgresAdapter({"url": "postgresql://user:pw@db:5432/mydb"})
    adapter.engine = ExplodingEngine()
    adapter._connected = True
    assert adapter.test() is False


def test_postgres_adapter_discover(monkeypatch):
    class DiscoverConnection(_FakeConnection):
        def execute(self, query):
            return [("public.users", "BASE TABLE"), ("public.active_users", "VIEW")]

    class DiscoverBegin(_FakeBegin):
        def __enter__(self):
            return DiscoverConnection()

    class DiscoverEngine(_FakeEngine):
        def begin(self):
            return DiscoverBegin()

    monkeypatch.setattr(
        "conduit.engine.adapters.sql.postgres.create_engine", lambda t: DiscoverEngine()
    )
    adapter = PostgresAdapter({"url": "postgresql://user:pw@db:5432/mydb"})
    adapter.connect()
    assets = adapter.discover()
    assert assets == [
        {"qualified_name": "public.users", "asset_type": "table"},
        {"qualified_name": "public.active_users", "asset_type": "view"},
    ]


def test_postgres_adapter_discover_not_connected():
    adapter = PostgresAdapter({"url": "postgresql://user:pw@db:5432/mydb"})
    with pytest.raises(RuntimeError):
        adapter.discover()


def test_postgres_adapter_read(monkeypatch):
    class ReadResult:
        def __init__(self):
            self.called = False

        def fetchmany(self, size):
            if not self.called:
                self.called = True
                return [(1, "alice"), (2, "bob")]
            return []

        def keys(self):
            return ["id", "name"]

    class ReadConnection(_FakeConnection):
        def execution_options(self, yield_per):
            return self

        def execute(self, query):
            return ReadResult()

    class ReadBegin(_FakeBegin):
        def __enter__(self):
            return ReadConnection()

    class ReadEngine(_FakeEngine):
        def begin(self):
            return ReadBegin()

    monkeypatch.setattr(
        "conduit.engine.adapters.sql.postgres.create_engine", lambda t: ReadEngine()
    )
    adapter = PostgresAdapter({"url": "postgresql://user:pw@db:5432/mydb"})
    adapter.connect()
    batches = list(adapter.read("public.users"))
    assert len(batches) == 1
    assert batches[0] == [{"id": 1, "name": "alice"}, {"id": 2, "name": "bob"}]
    batches = list(adapter.read("users"))
    assert len(batches) == 1


def test_postgres_adapter_read_not_connected():
    adapter = PostgresAdapter({"url": "postgresql://user:pw@db:5432/mydb"})
    with pytest.raises(RuntimeError):
        list(adapter.read("users"))


def test_postgres_adapter_write(monkeypatch):
    class WriteConnection(_FakeConnection):
        def execute(self, *args, **kwargs):
            pass

    class WriteBegin(_FakeBegin):
        def __init__(self, conn):
            self.conn = conn

        def __enter__(self):
            return self.conn

        def __exit__(self, a, b, c):
            return False

    conn = WriteConnection()

    class WriteEngine(_FakeEngine):
        def begin(self):
            return WriteBegin(conn)

    monkeypatch.setattr(
        "conduit.engine.adapters.sql.postgres.create_engine", lambda t: WriteEngine()
    )
    adapter = PostgresAdapter({"url": "postgresql://user:pw@db:5432/mydb"})
    adapter.connect()

    records = [{"id": 1, "name": "alice"}]
    assert adapter.write("public.users", records) == 1
    assert adapter.write("users", records) == 1
    assert adapter.write("users", []) == 0


def test_postgres_adapter_write_not_connected():
    adapter = PostgresAdapter({"url": "postgresql://user:pw@db:5432/mydb"})
    with pytest.raises(RuntimeError):
        adapter.write("users", [{"id": 1}])
