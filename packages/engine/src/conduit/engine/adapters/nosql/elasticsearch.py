"""
Conduit Engine — Elasticsearch Adapter.
"""

from __future__ import annotations

import logging
from typing import Any, Generator

try:
    from elasticsearch import Elasticsearch, helpers as es_helpers  # type: ignore

    HAS_ELASTICSEARCH = True
except ImportError:
    HAS_ELASTICSEARCH = False

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="elasticsearch",
    name="Elasticsearch",
    category="nosql",
    capabilities=["read", "write", "discover", "test"],
)
class ElasticsearchAdapter(BaseAdapter):
    """
    Adapter for Elasticsearch via the official Python client.
    Requires: hosts, and optionally api_key or username/password.
    """

    vault_fields = [
        "hosts",
        "api_key:secret",
        "username",
        "password:secret",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.client: Any = None

    def connect(self) -> None:
        if self._connected:
            return

        if not HAS_ELASTICSEARCH:
            raise ImportError(
                "elasticsearch is required to use the Elasticsearch adapter. "
                "Install it with `pip install elasticsearch`."
            )

        hosts = self._config.get("hosts", "http://localhost:9200")
        api_key = self._config.get("api_key")
        username = self._config.get("username")
        password = self._config.get("password")

        if isinstance(hosts, str):
            hosts = [h.strip() for h in hosts.split(",")]

        kwargs: dict[str, Any] = {"hosts": hosts}
        if api_key:
            kwargs["api_key"] = api_key
        elif username and password:
            kwargs["basic_auth"] = (username, password)

        self.client = Elasticsearch(**kwargs)

        try:
            info = self.client.info()
            self._connected = True
            logger.debug(
                "Connected to Elasticsearch cluster: %s",
                info.get("cluster_name", "unknown"),
            )
        except Exception as e:
            self.client = None
            raise ConnectionError(f"Failed to connect to Elasticsearch: {e}") from e

    def disconnect(self) -> None:
        if self.client:
            self.client.close()
            self.client = None
        self._connected = False

    def test(self) -> bool:
        if not self.client:
            self.connect()
        try:
            return self.client.ping()
        except Exception as e:
            logger.error("Elasticsearch test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        """Discover all indices in the cluster."""
        self.require_connected()

        indices = self.client.cat.indices(format="json")
        assets: list[dict] = []
        for idx in indices:
            name = idx.get("index", "")
            if name.startswith("."):
                continue
            assets.append(
                {
                    "qualified_name": name,
                    "asset_type": "index",
                }
            )
        return sorted(assets, key=lambda a: a["qualified_name"])

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        """Read documents from an index using the scroll API."""
        self.require_connected()

        batch_size = options.get("batch_size", 1000)
        query = options.get("query", {"match_all": {}})

        resp = self.client.search(
            index=asset,
            query=query,
            size=batch_size,
            scroll="2m",
        )

        scroll_id = resp.get("_scroll_id")
        hits = resp["hits"]["hits"]

        while hits:
            batch = [
                {"_id": hit["_id"], **hit["_source"]}
                for hit in hits
            ]
            yield batch

            resp = self.client.scroll(scroll_id=scroll_id, scroll="2m")
            scroll_id = resp.get("_scroll_id")
            hits = resp["hits"]["hits"]

        if scroll_id:
            try:
                self.client.clear_scroll(scroll_id=scroll_id)
            except Exception:
                pass

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        """Write documents to an index using the bulk API."""
        if not records:
            return 0

        self.require_connected()

        actions = []
        for record in records:
            doc = dict(record)
            action: dict[str, Any] = {
                "_index": asset,
                "_source": doc,
            }
            doc_id = doc.pop("_id", None)
            if doc_id:
                action["_id"] = doc_id
            actions.append(action)

        success, errors = es_helpers.bulk(self.client, actions, raise_on_error=False)

        if errors:
            logger.warning("Elasticsearch bulk write had %d errors", len(errors))

        return success
