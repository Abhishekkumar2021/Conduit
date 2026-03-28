"""
Conduit Engine — SQL Server (MSSQL) Adapter.
"""

from __future__ import annotations

import logging
from typing import Any, Generator

try:
    import pymssql  # type: ignore  # noqa: F401

    HAS_PYMSSQL = True
except ImportError:
    HAS_PYMSSQL = False

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, URL

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="mssql",
    name="SQL Server",
    category="sql",
    capabilities=["read", "write", "discover", "test"],
)
class MSSQLAdapter(BaseAdapter):
    """
    Adapter for Microsoft SQL Server via pymssql + SQLAlchemy.
    Requires: host, port, database, username, password.
    """

    vault_fields = [
        "host",
        "port:int=1433",
        "database",
        "username",
        "password:secret",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.engine: Engine | None = None

    def connect(self) -> None:
        if self._connected:
            return

        if not HAS_PYMSSQL:
            raise ImportError(
                "pymssql is required to use the SQL Server adapter. "
                "Install it with `pip install pymssql`."
            )

        host = self._config.get("host", "localhost")
        port = self._config.get("port", 1433)
        database = self._config.get("database")
        username = self._config.get("username")
        password = self._config.get("password", "")

        if not database or not username:
            raise ValueError(
                "SQL Server adapter requires 'database' and 'username'."
            )

        try:
            port_value = int(port)
        except (TypeError, ValueError) as exc:
            raise ValueError("SQL Server adapter port must be an integer.") from exc

        connect_url = URL.create(
            "mssql+pymssql",
            username=str(username),
            password=str(password) if password else None,
            host=str(host),
            port=port_value,
            database=str(database),
        )

        self.engine = create_engine(connect_url)

        try:
            with self.engine.begin() as conn:
                conn.execute(text("SELECT 1"))
            self._connected = True
            logger.debug("Connected to SQL Server at %s:%s/%s", host, port_value, database)
        except Exception as e:
            self.engine.dispose()
            self.engine = None
            raise ConnectionError(f"Failed to connect to SQL Server: {e}") from e

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
            logger.error("SQL Server test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        """Discover all user tables and views in the database."""
        self.require_connected()

        query = text(
            """
            SELECT TABLE_SCHEMA + '.' + TABLE_NAME AS qualified_name,
                   TABLE_TYPE AS asset_type
            FROM INFORMATION_SCHEMA.TABLES
            ORDER BY TABLE_SCHEMA, TABLE_NAME
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
            quoted_asset = f"[{schema}].[{table}]"
        else:
            quoted_asset = f"[{asset}]"

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
            quoted_asset = f"[{schema}].[{table}]"
        else:
            quoted_asset = f"[{asset}]"

        columns = list(records[0].keys())
        quoted_cols = ", ".join(f"[{c}]" for c in columns)
        placeholders = ", ".join(f":{c}" for c in columns)

        query = text(
            f"INSERT INTO {quoted_asset} ({quoted_cols}) VALUES ({placeholders})"
        )

        with self.engine.begin() as conn:  # type: ignore[union-attr]
            conn.execute(query, records)

        return len(records)
