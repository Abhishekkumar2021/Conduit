"""
Conduit Engine — DuckDB Adapter.
"""

from __future__ import annotations

import logging
from typing import Any, Generator

try:
    import duckdb_engine  # type: ignore  # noqa: F401

    HAS_DUCKDB = True
except ImportError:
    HAS_DUCKDB = False

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="duckdb",
    name="DuckDB",
    category="sql",
    capabilities=["read", "write", "discover", "test"],
)
class DuckDBAdapter(BaseAdapter):
    """
    Adapter for DuckDB via duckdb_engine + SQLAlchemy.
    Requires: path (file path, or empty for in-memory).
    """

    vault_fields = [
        "path",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.engine: Engine | None = None

    def connect(self) -> None:
        if self._connected:
            return

        if not HAS_DUCKDB:
            raise ImportError(
                "duckdb-engine is required to use the DuckDB adapter. "
                "Install it with `pip install duckdb-engine`."
            )

        path = self._config.get("path", ":memory:")

        if path and path != ":memory:":
            url = f"duckdb:///{path}"
        else:
            url = "duckdb:///:memory:"

        self.engine = create_engine(url)

        try:
            with self.engine.begin() as conn:
                conn.execute(text("SELECT 1"))
            self._connected = True
            logger.debug("Connected to DuckDB at %s", path)
        except Exception as e:
            self.engine.dispose()
            self.engine = None
            raise ConnectionError(f"Failed to connect to DuckDB: {e}") from e

    def disconnect(self) -> None:
        if self.engine:
            self.engine.dispose()
            self.engine = None
        self._connected = False

    def test(self) -> bool:
        if not self.engine:
            self.connect()
        try:
            with self.engine.begin() as conn:  # type: ignore[union-attr]
                conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error("DuckDB test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        """Discover all tables and views in the database."""
        self.require_connected()

        query = text(
            """
            SELECT table_schema || '.' || table_name AS qualified_name,
                   table_type
            FROM information_schema.tables
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY table_schema, table_name
            """
        )

        assets: list[dict] = []
        with self.engine.begin() as conn:  # type: ignore[union-attr]
            result = conn.execute(query)
            for row in result:
                assets.append(
                    {
                        "qualified_name": row[0],
                        "asset_type": "table" if row[1] == "BASE TABLE" else "view",
                    }
                )
        return assets

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        self.require_connected()

        batch_size = options.get("batch_size", 1000)

        if "." in asset:
            schema, table = asset.split(".", 1)
            quoted_asset = f'"{schema}"."{table}"'
        else:
            quoted_asset = f'"{asset}"'

        query = text(f"SELECT * FROM {quoted_asset}")

        with self.engine.begin() as conn:  # type: ignore[union-attr]
            result = conn.execution_options(yield_per=batch_size).execute(query)

            while True:
                partitions = result.fetchmany(batch_size)
                if not partitions:
                    break

                keys = result.keys()
                batch = [dict(zip(keys, row)) for row in partitions]
                yield batch

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        if not records:
            return 0

        self.require_connected()

        if "." in asset:
            schema, table = asset.split(".", 1)
            quoted_asset = f'"{schema}"."{table}"'
        else:
            quoted_asset = f'"{asset}"'

        columns = list(records[0].keys())
        quoted_cols = ", ".join(f'"{c}"' for c in columns)
        placeholders = ", ".join(f":{c}" for c in columns)

        query = text(
            f"INSERT INTO {quoted_asset} ({quoted_cols}) VALUES ({placeholders})"
        )

        with self.engine.begin() as conn:  # type: ignore[union-attr]
            conn.execute(query, records)

        return len(records)
