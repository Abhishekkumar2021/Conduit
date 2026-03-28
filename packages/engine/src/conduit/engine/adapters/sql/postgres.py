"""
Conduit Engine — PostgreSQL Adapter.
"""

from __future__ import annotations

import logging
from typing import Any, Generator

# We use psycopg2 directly or sqlalchemy engine. Assuming sqlalchemy is available for sync.
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, URL

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="postgresql",
    name="PostgreSQL",
    category="sql",
    capabilities=["read", "write", "discover", "test"],
)
class PostgresAdapter(BaseAdapter):
    """
    Adapter for PostgreSQL databases.
    Requires: host, port, database, username, password.
    """

    vault_fields = [
        "host",
        "port:int=5432",
        "database",
        "username",
        "password:secret",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.engine: Engine | None = None

    @staticmethod
    def _first_config_value(
        config: dict[str, Any], keys: list[str], default: Any = None
    ) -> Any:
        for key in keys:
            value = config.get(key)
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
            return value
        return default

    def connect(self) -> None:
        if self._connected:
            return

        connection_url = self._first_config_value(
            self._config,
            ["url", "database_url", "dsn", "connection_uri", "connection_url"],
        )

        if connection_url:
            connect_target: str | URL = str(connection_url)
        else:
            host = self._first_config_value(self._config, ["host", "hostname"], "localhost")
            port = self._first_config_value(self._config, ["port"], 5432)
            database = self._first_config_value(
                self._config, ["database", "dbname", "db"]
            )
            username = self._first_config_value(
                self._config, ["username", "user", "user_name"]
            )
            password = self._first_config_value(
                self._config, ["password", "pass", "pwd"], ""
            )

            # Postgresql adapter requires database and username unless URL is provided
            if not database or not username:
                raise ValueError(
                    "PostgreSQL adapter requires database and username "
                    "(accepted keys: database/dbname/db + username/user), "
                    "or a full connection URL via url/database_url/dsn."
                )

            try:
                port_value = int(port)
            except (TypeError, ValueError) as exc:
                raise ValueError("PostgreSQL adapter port must be an integer.") from exc

            connect_target = URL.create(
                "postgresql+psycopg2",
                username=str(username),
                password=str(password) if password else None,
                host=str(host),
                port=port_value,
                database=str(database),
            )

        self.engine = create_engine(connect_target)

        # Test connection eagerly so discovery doesn't fail lazily
        try:
            with self.engine.begin() as conn:
                conn.execute(text("SELECT 1"))
            self._connected = True
            logger.debug("Connected to PostgreSQL successfully")
        except Exception as e:
            self.engine.dispose()
            self.engine = None
            raise ConnectionError(f"Failed to connect to PostgreSQL: {e}")

    def disconnect(self) -> None:
        if self.engine:
            self.engine.dispose()
            self.engine = None
        self._connected = False

    def test(self) -> bool:
        if not self.engine:
            self.connect()
        try:
            with self.engine.begin() as conn:  # type: ignore
                conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error("PostgreSQL test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        """Discover all user tables and views in the database."""
        if not self._connected or not self.engine:
            raise RuntimeError(
                "Adapter is not connected. Use 'with adapter.session():' context manager."
            )

        query = text(
            """
            SELECT table_schema || '.' || table_name AS qualified_name,
                   table_type AS asset_type
            FROM information_schema.tables
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY table_schema, table_name;
            """
        )
        assets = []
        with self.engine.begin() as conn:  # type: ignore
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
        if not self._connected or not self.engine:
            raise RuntimeError(
                "Adapter is not connected. Use 'with adapter.session():' context manager."
            )

        batch_size = options.get("batch_size", 1000)

        # NOTE: For safety against SQL injection, asset name ought to be sanitized.
        # However, as an internal orchestrator tool, we rely on the DB's permissions.
        # We perform a basic quote.
        if "." in asset:
            schema, table = asset.split(".", 1)
            quoted_asset = f'"{schema}"."{table}"'
        else:
            quoted_asset = f'"{asset}"'

        query = text(f"SELECT * FROM {quoted_asset}")

        with self.engine.begin() as conn:  # type: ignore
            # We use a server-side cursor via execution options if needed, but for simplicity
            # fetchmany works fine for standard batching.
            result = conn.execution_options(yield_per=batch_size).execute(query)

            while True:
                partitions = result.fetchmany(batch_size)
                if not partitions:
                    break

                # Convert rows to dicts
                keys = result.keys()
                batch = [dict(zip(keys, row)) for row in partitions]
                yield batch

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        if not records:
            return 0

        if not self._connected or not self.engine:
            raise RuntimeError(
                "Adapter is not connected. Use 'with adapter.session():' context manager."
            )

        # Basic exact column match insertion.
        # For a true production adapter, we would handle upserts via ON CONFLICT.

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

        with self.engine.begin() as conn:  # type: ignore
            conn.execute(query, records)

        return len(records)
