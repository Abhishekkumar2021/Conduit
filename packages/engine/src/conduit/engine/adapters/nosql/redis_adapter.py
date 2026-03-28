"""
Conduit Engine — Redis Adapter.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Generator

try:
    import redis as redis_lib  # type: ignore

    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="redis",
    name="Redis",
    category="nosql",
    capabilities=["read", "write", "discover", "test"],
)
class RedisAdapter(BaseAdapter):
    """
    Adapter for Redis key-value store.
    Requires: host, port, password, db.
    """

    vault_fields = [
        "host",
        "port:int=6379",
        "password:secret",
        "db:int=0",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.client: Any = None

    def connect(self) -> None:
        if self._connected:
            return

        if not HAS_REDIS:
            raise ImportError(
                "redis is required to use the Redis adapter. "
                "Install it with `pip install redis`."
            )

        host = self._config.get("host", "localhost")
        port = self._config.get("port", 6379)
        password = self._config.get("password")
        db = self._config.get("db", 0)

        try:
            port_value = int(port)
            db_value = int(db)
        except (TypeError, ValueError) as exc:
            raise ValueError("Redis adapter port and db must be integers.") from exc

        self.client = redis_lib.Redis(
            host=str(host),
            port=port_value,
            password=str(password) if password else None,
            db=db_value,
            decode_responses=True,
        )

        try:
            self.client.ping()
            self._connected = True
            logger.debug("Connected to Redis at %s:%s db=%s", host, port_value, db_value)
        except Exception as e:
            self.client = None
            raise ConnectionError(f"Failed to connect to Redis: {e}") from e

    def disconnect(self) -> None:
        if self.client:
            self.client.close()
            self.client = None
        self._connected = False

    def test(self) -> bool:
        if not self.client:
            self.connect()
        try:
            self.client.ping()
            return True
        except Exception as e:
            logger.error("Redis test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        """Discover all keys using SCAN."""
        self.require_connected()

        assets: list[dict] = []
        cursor = 0
        while True:
            cursor, keys = self.client.scan(cursor=cursor, count=500)
            for key in keys:
                key_type = self.client.type(key)
                assets.append(
                    {
                        "qualified_name": key,
                        "asset_type": key_type,
                    }
                )
            if cursor == 0:
                break
        return assets

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        """Read a key or pattern of keys from Redis."""
        self.require_connected()

        batch_size = options.get("batch_size", 100)
        pattern = asset

        records: list[dict] = []
        cursor = 0
        while True:
            cursor, keys = self.client.scan(cursor=cursor, match=pattern, count=batch_size)
            for key in keys:
                key_type = self.client.type(key)
                if key_type == "hash":
                    value = self.client.hgetall(key)
                elif key_type == "string":
                    raw = self.client.get(key)
                    try:
                        value = json.loads(raw)
                    except (json.JSONDecodeError, TypeError):
                        value = raw
                elif key_type == "list":
                    value = self.client.lrange(key, 0, -1)
                elif key_type == "set":
                    value = list(self.client.smembers(key))
                else:
                    value = None

                records.append({"key": key, "type": key_type, "value": value})

                if len(records) >= batch_size:
                    yield records
                    records = []

            if cursor == 0:
                break

        if records:
            yield records

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        """Write records to Redis. Each record needs 'key' and 'value'."""
        if not records:
            return 0

        self.require_connected()

        written = 0
        pipe = self.client.pipeline()
        for record in records:
            key = record.get("key", f"{asset}:{written}")
            value = record.get("value", record)

            if isinstance(value, dict):
                pipe.hset(key, mapping=value)
            elif isinstance(value, (list, tuple)):
                pipe.delete(key)
                if value:
                    pipe.rpush(key, *value)
            else:
                pipe.set(key, json.dumps(value) if not isinstance(value, str) else value)
            written += 1

        pipe.execute()
        return written
