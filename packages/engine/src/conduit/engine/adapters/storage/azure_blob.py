"""
Conduit Engine — Azure Blob Storage Adapter.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from typing import Any, Generator

try:
    from azure.storage.blob import BlobServiceClient  # type: ignore

    HAS_AZURE = True
except ImportError:
    HAS_AZURE = False

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="azure_blob",
    name="Azure Blob Storage",
    category="storage",
    capabilities=["read", "write", "discover", "test"],
)
class AzureBlobAdapter(BaseAdapter):
    """
    Adapter for Azure Blob Storage.
    """

    vault_fields = [
        "connection_string:secret",
        "container_name",
        "account_name",
        "account_key:secret",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._service_client: Any = None
        self._container_client: Any = None
        self._container_name: str = ""

    def connect(self) -> None:
        if self._connected:
            return

        if not HAS_AZURE:
            raise ImportError(
                "azure-storage-blob is required. "
                "Install with `pip install azure-storage-blob`."
            )

        conn_str = self._config.get("connection_string")
        account_name = self._config.get("account_name")
        account_key = self._config.get("account_key")
        self._container_name = self._config.get("container_name", "")

        if not self._container_name:
            raise ValueError("Azure Blob adapter requires 'container_name'.")

        try:
            if conn_str:
                self._service_client = BlobServiceClient.from_connection_string(conn_str)
            elif account_name and account_key:
                url = f"https://{account_name}.blob.core.windows.net"
                self._service_client = BlobServiceClient(
                    account_url=url,
                    credential=account_key,
                )
            else:
                raise ValueError(
                    "Azure Blob requires 'connection_string' or 'account_name' + 'account_key'."
                )

            self._container_client = self._service_client.get_container_client(
                self._container_name
            )
            self._container_client.get_container_properties()
            self._connected = True
            logger.debug("Connected to Azure container '%s'", self._container_name)

        except Exception as e:
            self._service_client = None
            raise ConnectionError(f"Failed to connect to Azure Blob: {e}") from e

    def disconnect(self) -> None:
        self._service_client = None
        self._container_client = None
        self._connected = False

    def test(self) -> bool:
        if not self._service_client:
            self.connect()
        try:
            self._container_client.get_container_properties()
            return True
        except Exception as e:
            logger.error("Azure Blob test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        self.require_connected()
        assets: list[dict] = []
        for blob in self._container_client.list_blobs():
            if blob.name.endswith("/"):
                continue
            assets.append({
                "qualified_name": blob.name,
                "asset_type": "file",
                "size_bytes": blob.size or 0,
            })
            if len(assets) >= 5000:
                break
        return assets

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        self.require_connected()
        batch_size = options.get("batch_size", 1000)

        blob_client = self._container_client.get_blob_client(asset)
        content = blob_client.download_blob().readall()
        text = content.decode("utf-8")

        if asset.lower().endswith(".csv"):
            reader = csv.DictReader(io.StringIO(text))
            batch: list[dict] = []
            for row in reader:
                batch.append(dict(row))
                if len(batch) >= batch_size:
                    yield batch
                    batch = []
            if batch:
                yield batch

        elif asset.lower().endswith((".json", ".jsonl", ".ndjson")):
            batch = []
            for line in text.splitlines():
                line = line.strip()
                if not line:
                    continue
                batch.append(json.loads(line))
                if len(batch) >= batch_size:
                    yield batch
                    batch = []
            if batch:
                yield batch
        else:
            yield [{"_raw": text}]

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        if not records:
            return 0
        self.require_connected()

        if asset.lower().endswith(".csv"):
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=list(records[0].keys()))
            writer.writeheader()
            writer.writerows(records)
            payload = buf.getvalue().encode("utf-8")
        else:
            lines = [json.dumps(r, default=str) for r in records]
            payload = ("\n".join(lines) + "\n").encode("utf-8")

        blob_client = self._container_client.get_blob_client(asset)
        blob_client.upload_blob(payload, overwrite=True)
        return len(records)
