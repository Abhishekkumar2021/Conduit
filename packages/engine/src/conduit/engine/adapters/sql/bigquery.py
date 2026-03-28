"""
Conduit Engine — BigQuery Adapter.
"""

from __future__ import annotations

import logging
from typing import Any, Generator

try:
    import sqlalchemy_bigquery  # type: ignore  # noqa: F401

    HAS_BIGQUERY = True
except ImportError:
    HAS_BIGQUERY = False

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="bigquery",
    name="BigQuery",
    category="sql",
    capabilities=["read", "write", "discover", "test"],
)
class BigQueryAdapter(BaseAdapter):
    """
    Adapter for Google BigQuery via sqlalchemy-bigquery.
    Requires: project_id, dataset_id, credentials_json.
    """

    vault_fields = [
        "project_id",
        "dataset_id",
        "credentials_json:secret",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.engine: Engine | None = None

    def connect(self) -> None:
        if self._connected:
            return

        if not HAS_BIGQUERY:
            raise ImportError(
                "sqlalchemy-bigquery is required to use the BigQuery adapter. "
                "Install it with `pip install sqlalchemy-bigquery`."
            )

        project_id = self._config.get("project_id")
        dataset_id = self._config.get("dataset_id")
        credentials_json = self._config.get("credentials_json")

        if not project_id or not dataset_id:
            raise ValueError(
                "BigQuery adapter requires 'project_id' and 'dataset_id'."
            )

        url = f"bigquery://{project_id}/{dataset_id}"

        create_kwargs: dict[str, Any] = {}
        if credentials_json:
            from google.oauth2 import service_account  # type: ignore

            import json

            if isinstance(credentials_json, str):
                credentials_json = json.loads(credentials_json)
            credentials = service_account.Credentials.from_service_account_info(
                credentials_json
            )
            create_kwargs["credentials_base64"] = None
            create_kwargs["create_disposition"] = "CREATE_IF_NEEDED"
            self.engine = create_engine(url, credentials_path=None, credentials_info=credentials_json)
        else:
            self.engine = create_engine(url)

        try:
            with self.engine.begin() as conn:
                conn.execute(text("SELECT 1"))
            self._connected = True
            logger.debug("Connected to BigQuery project=%s dataset=%s", project_id, dataset_id)
        except Exception as e:
            self.engine.dispose()
            self.engine = None
            raise ConnectionError(f"Failed to connect to BigQuery: {e}") from e

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
            logger.error("BigQuery test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        """Discover all tables in the dataset."""
        self.require_connected()

        dataset_id = self._config.get("dataset_id", "")

        query = text(
            """
            SELECT table_name, table_type
            FROM INFORMATION_SCHEMA.TABLES
            ORDER BY table_name
            """
        )

        assets: list[dict] = []
        with self.engine.begin() as conn:  # type: ignore[union-attr]
            result = conn.execute(query)
            for row in result:
                assets.append(
                    {
                        "qualified_name": f"{dataset_id}.{row[0]}",
                        "asset_type": "table" if row[1] == "BASE TABLE" else "view",
                    }
                )
        return assets

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        self.require_connected()

        batch_size = options.get("batch_size", 1000)

        if "." in asset:
            dataset, table = asset.split(".", 1)
            quoted_asset = f"`{dataset}`.`{table}`"
        else:
            quoted_asset = f"`{asset}`"

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
            dataset, table = asset.split(".", 1)
            quoted_asset = f"`{dataset}`.`{table}`"
        else:
            quoted_asset = f"`{asset}`"

        columns = list(records[0].keys())
        quoted_cols = ", ".join(f"`{c}`" for c in columns)
        placeholders = ", ".join(f":{c}" for c in columns)

        query = text(
            f"INSERT INTO {quoted_asset} ({quoted_cols}) VALUES ({placeholders})"
        )

        with self.engine.begin() as conn:  # type: ignore[union-attr]
            conn.execute(query, records)

        return len(records)
