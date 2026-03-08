"""
Conduit Engine — Snowflake Adapter.
"""

from __future__ import annotations

import logging
from typing import Any, Generator

try:
    import snowflake.connector  # type: ignore

    HAS_SNOWFLAKE = True
except ImportError:
    HAS_SNOWFLAKE = False

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="snowflake",
    name="Snowflake",
    category="sql",
    capabilities=["read", "write", "discover", "test"],
)
class SnowflakeAdapter(BaseAdapter):
    """
    Adapter for Snowflake Data Cloud.
    Requires: account, user, password, database, schema, warehouse.
    """

    vault_fields = [
        "account",
        "user",
        "password:secret",
        "database",
        "schema",
        "warehouse",
        "role",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.conn = None

    def connect(self) -> None:
        if self._connected:
            return

        if not HAS_SNOWFLAKE:
            raise ImportError(
                "snowflake-connector-python is required to use the Snowflake adapter. "
                "Install it with `pip install snowflake-connector-python`."
            )

        account = self._config.get("account")
        user = self._config.get("user")
        password = self._config.get("password")
        warehouse = self._config.get("warehouse")
        database = self._config.get("database")
        schema = self._config.get("schema")
        role = self._config.get("role")

        try:
            self.conn = snowflake.connector.connect(
                user=user,
                password=password,
                account=account,
                warehouse=warehouse,
                database=database,
                schema=schema,
                role=role,
            )
            self._connected = True
            logger.debug("Connected to Snowflake account %s", account)
        except Exception as e:
            logger.error("Failed to connect to Snowflake: %s", e)
            raise

    def disconnect(self) -> None:
        if self.conn:
            self.conn.close()
            self.conn = None
        self._connected = False

    def test(self) -> bool:
        if not self.conn:
            self.connect()
        try:
            cursor = self.conn.cursor()  # type: ignore
            cursor.execute("SELECT 1")
            return True
        except Exception as e:
            logger.error("Snowflake test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        if not self._connected or not self.conn:
            raise RuntimeError(
                "Adapter is not connected. Use 'with adapter.session():' context manager."
            )

        query = """
            SELECT TABLE_CATALOG || '.' || TABLE_SCHEMA || '.' || TABLE_NAME AS qualified_name,
                   TABLE_TYPE AS asset_type
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA != 'INFORMATION_SCHEMA'
        """
        assets = []
        try:
            cursor = self.conn.cursor()  # type: ignore
            cursor.execute(query)
            for row in cursor:
                assets.append(
                    {
                        "qualified_name": row[0],
                        "asset_type": "table" if "TABLE" in row[1] else "view",
                    }
                )
        except Exception as e:
            logger.error("Discovery failed: %s", e)
            raise
        return assets

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        if not self._connected or not self.conn:
            raise RuntimeError(
                "Adapter is not connected. Use 'with adapter.session():' context manager."
            )

        batch_size = options.get("batch_size", 10000)

        # Snowflake expects double quotes for case-sensitive identifiers
        if "." in asset:
            parts = asset.split(".")
            quoted_asset = ".".join(f'"{p.upper()}"' for p in parts)
        else:
            quoted_asset = f'"{asset.upper()}"'

        query = f"SELECT * FROM {quoted_asset}"

        cursor = self.conn.cursor(snowflake.connector.DictCursor)  # type: ignore
        cursor.execute(query)

        while True:
            batch = cursor.fetchmany(batch_size)
            if not batch:
                break
            yield batch

        cursor.close()

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        if not records:
            return 0

        if not self._connected or not self.conn:
            raise RuntimeError(
                "Adapter is not connected. Use 'with adapter.session():' context manager."
            )

        if "." in asset:
            parts = asset.split(".")
            quoted_asset = ".".join(f'"{p.upper()}"' for p in parts)
        else:
            quoted_asset = f'"{asset.upper()}"'

        # Efficient write using Snowflake's executemany (which uses binding)
        # For very large writes, `snowflake.connector.pandas_tools.write_pandas` with PUT/COPY
        # is vastly superior, but we're keeping dependencies minimal and stable for Phase 7.

        columns = list(records[0].keys())
        quoted_cols = ", ".join(f'"{c.upper()}"' for c in columns)
        placeholders = ", ".join(["%s"] * len(columns))

        query = f"INSERT INTO {quoted_asset} ({quoted_cols}) VALUES ({placeholders})"

        # Extract values into list of tuples
        values = []
        for r in records:
            values.append(tuple(r.get(c) for c in columns))

        cursor = self.conn.cursor()  # type: ignore
        cursor.executemany(query, values)
        cursor.close()

        return len(records)
