"""
Conduit Engine — Amazon Redshift Adapter.
"""

from __future__ import annotations

import logging
from typing import Any, Generator

try:
    import redshift_connector  # type: ignore  # noqa: F401

    HAS_REDSHIFT = True
except ImportError:
    HAS_REDSHIFT = False

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, URL

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="redshift",
    name="Redshift",
    category="sql",
    capabilities=["read", "write", "discover", "test"],
)
class RedshiftAdapter(BaseAdapter):
    """
    Adapter for Amazon Redshift via PostgreSQL driver + SQLAlchemy.
    Requires: host, port, database, username, password.
    """

    vault_fields = [
        "host",
        "port:int=5439",
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

        host = self._config.get("host")
        port = self._config.get("port", 5439)
        database = self._config.get("database")
        username = self._config.get("username")
        password = self._config.get("password", "")

        if not host or not database or not username:
            raise ValueError(
                "Redshift adapter requires 'host', 'database', and 'username'."
            )

        try:
            port_value = int(port)
        except (TypeError, ValueError) as exc:
            raise ValueError("Redshift adapter port must be an integer.") from exc

        connect_url = URL.create(
            "postgresql+psycopg2",
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
            logger.debug("Connected to Redshift at %s:%s/%s", host, port_value, database)
        except Exception as e:
            self.engine.dispose()
            self.engine = None
            raise ConnectionError(f"Failed to connect to Redshift: {e}") from e

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
            logger.error("Redshift test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        """Discover all user tables and views in Redshift."""
        self.require_connected()

        query = text(
            """
            SELECT schemaname || '.' || tablename AS qualified_name,
                   'table' AS asset_type
            FROM pg_tables
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_internal')
            UNION ALL
            SELECT schemaname || '.' || viewname AS qualified_name,
                   'view' AS asset_type
            FROM pg_views
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_internal')
            ORDER BY qualified_name
            """
        )

        assets: list[dict] = []
        with self.engine.begin() as conn:  # type: ignore[union-attr]
            result = conn.execute(query)
            for row in result:
                assets.append(
                    {
                        "qualified_name": row[0],
                        "asset_type": row[1],
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
