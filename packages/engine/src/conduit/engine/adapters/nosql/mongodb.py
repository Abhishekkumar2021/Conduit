"""
Conduit Engine — MongoDB Adapter.
"""

from __future__ import annotations

import logging
from typing import Any, Generator

try:
    from pymongo import MongoClient  # type: ignore
    from pymongo.errors import ConnectionFailure  # type: ignore

    HAS_PYMONGO = True
except ImportError:
    HAS_PYMONGO = False

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="mongodb",
    name="MongoDB",
    category="nosql",
    capabilities=["read", "write", "discover", "test"],
)
class MongoDBAdapter(BaseAdapter):
    """
    Adapter for MongoDB via pymongo.
    Requires: connection_uri, database.
    """

    vault_fields = [
        "connection_uri:secret",
        "database",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._client: Any = None
        self._db: Any = None

    def connect(self) -> None:
        if self._connected:
            return

        if not HAS_PYMONGO:
            raise ImportError(
                "pymongo is required to use the MongoDB adapter. "
                "Install it with `pip install pymongo`."
            )

        connection_uri = self._config.get("connection_uri")
        database = self._config.get("database")

        if not connection_uri:
            raise ValueError("MongoDB adapter requires 'connection_uri'.")
        if not database:
            raise ValueError("MongoDB adapter requires 'database'.")

        try:
            self._client = MongoClient(connection_uri)
            # Force a connection check — MongoClient is lazy by default
            self._client.admin.command("ping")
            self._db = self._client[database]
            self._connected = True
            logger.debug("Connected to MongoDB database '%s'", database)
        except ConnectionFailure as e:
            self._client = None
            self._db = None
            raise ConnectionError(f"Failed to connect to MongoDB: {e}") from e

    def disconnect(self) -> None:
        if self._client:
            self._client.close()
            self._client = None
            self._db = None
        self._connected = False

    def test(self) -> bool:
        if not self._client:
            self.connect()
        try:
            self._client.admin.command("ping")
            return True
        except Exception as e:
            logger.error("MongoDB test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        """Discover all collections in the configured database."""
        self.require_connected()

        collections = self._db.list_collection_names()
        return [
            {"qualified_name": name, "asset_type": "collection"}
            for name in sorted(collections)
        ]

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        self.require_connected()

        batch_size = options.get("batch_size", 1000)
        query_filter = options.get("filter", {})

        collection = self._db[asset]
        cursor = collection.find(query_filter)

        batch: list[dict] = []
        for doc in cursor:
            # Convert ObjectId to string for serialisation safety
            doc["_id"] = str(doc["_id"])
            batch.append(doc)

            if len(batch) >= batch_size:
                yield batch
                batch = []

        if batch:
            yield batch

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        if not records:
            return 0

        self.require_connected()

        collection = self._db[asset]
        result = collection.insert_many(records)
        return len(result.inserted_ids)
