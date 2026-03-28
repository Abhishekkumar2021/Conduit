"""
Conduit Engine — Google Cloud Storage Adapter.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from typing import Any, Generator

try:
    from google.cloud import storage as gcs_storage  # type: ignore

    HAS_GCS = True
except ImportError:
    HAS_GCS = False

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="gcs",
    name="Google Cloud Storage",
    category="storage",
    capabilities=["read", "write", "discover", "test"],
)
class GCSAdapter(BaseAdapter):
    """
    Adapter for Google Cloud Storage via google-cloud-storage.
    """

    vault_fields = [
        "bucket",
        "prefix",
        "project_id",
        "credentials_json:secret",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._client: Any = None
        self._bucket_obj: Any = None
        self._bucket_name: str = ""
        self._prefix: str = ""

    def connect(self) -> None:
        if self._connected:
            return

        if not HAS_GCS:
            raise ImportError(
                "google-cloud-storage is required. "
                "Install with `pip install google-cloud-storage`."
            )

        self._bucket_name = self._config.get("bucket", "")
        self._prefix = self._config.get("prefix", "")
        project_id = self._config.get("project_id")
        credentials_json = self._config.get("credentials_json")

        if not self._bucket_name:
            raise ValueError("GCS adapter requires 'bucket'.")

        try:
            if credentials_json:
                import json as _json
                from google.oauth2 import service_account  # type: ignore

                info = _json.loads(credentials_json)
                credentials = service_account.Credentials.from_service_account_info(info)
                self._client = gcs_storage.Client(
                    project=project_id, credentials=credentials
                )
            else:
                self._client = gcs_storage.Client(project=project_id)

            self._bucket_obj = self._client.bucket(self._bucket_name)
            if not self._bucket_obj.exists():
                raise ConnectionError(f"Bucket '{self._bucket_name}' does not exist")

            self._connected = True
            logger.debug("Connected to GCS bucket '%s'", self._bucket_name)
        except Exception as e:
            self._client = None
            raise ConnectionError(f"Failed to connect to GCS: {e}") from e

    def disconnect(self) -> None:
        self._client = None
        self._bucket_obj = None
        self._connected = False

    def test(self) -> bool:
        if not self._client:
            self.connect()
        try:
            return self._bucket_obj.exists()
        except Exception as e:
            logger.error("GCS test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        self.require_connected()
        assets: list[dict] = []
        blobs = self._client.list_blobs(
            self._bucket_name, prefix=self._prefix or None, max_results=5000
        )
        for blob in blobs:
            if blob.name.endswith("/"):
                continue
            assets.append({
                "qualified_name": blob.name,
                "asset_type": "file",
                "size_bytes": blob.size or 0,
            })
        return assets

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        self.require_connected()
        batch_size = options.get("batch_size", 1000)

        blob = self._bucket_obj.blob(asset)
        content = blob.download_as_bytes()
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

        blob = self._bucket_obj.blob(asset)
        blob.upload_from_string(payload)
        return len(records)
