"""
Conduit Engine — Amazon S3 Adapter.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from typing import Any, Generator

try:
    import boto3  # type: ignore
    from botocore.exceptions import ClientError  # type: ignore

    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="s3",
    name="Amazon S3",
    category="storage",
    capabilities=["read", "write", "discover", "test"],
)
class S3Adapter(BaseAdapter):
    """
    Adapter for Amazon S3 via boto3.
    Requires: bucket, prefix, aws_access_key_id, aws_secret_access_key, region.
    """

    vault_fields = [
        "bucket",
        "prefix",
        "aws_access_key_id:secret",
        "aws_secret_access_key:secret",
        "region",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._client: Any = None
        self._bucket: str = ""
        self._prefix: str = ""

    def connect(self) -> None:
        if self._connected:
            return

        if not HAS_BOTO3:
            raise ImportError(
                "boto3 is required to use the S3 adapter. "
                "Install it with `pip install boto3`."
            )

        self._bucket = self._config.get("bucket", "")
        self._prefix = self._config.get("prefix", "")
        region = self._config.get("region", "us-east-1")
        access_key = self._config.get("aws_access_key_id")
        secret_key = self._config.get("aws_secret_access_key")

        if not self._bucket:
            raise ValueError("S3 adapter requires 'bucket'.")

        try:
            self._client = boto3.client(
                "s3",
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
            )
            self._client.head_bucket(Bucket=self._bucket)
            self._connected = True
            logger.debug("Connected to S3 bucket '%s'", self._bucket)
        except ClientError as e:
            self._client = None
            raise ConnectionError(
                f"Failed to connect to S3 bucket '{self._bucket}': {e}"
            ) from e

    def disconnect(self) -> None:
        self._client = None
        self._connected = False

    def test(self) -> bool:
        if not self._client:
            self.connect()
        try:
            self._client.head_bucket(Bucket=self._bucket)
            return True
        except Exception as e:
            logger.error("S3 test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        """List objects under the configured prefix."""
        self.require_connected()

        assets: list[dict] = []
        paginator = self._client.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=self._bucket, Prefix=self._prefix)

        for page in pages:
            for obj in page.get("Contents", []):
                key: str = obj["Key"]
                if key.endswith("/"):
                    continue
                assets.append(
                    {
                        "qualified_name": key,
                        "asset_type": "object",
                        "size_bytes": obj.get("Size", 0),
                    }
                )
        return assets

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        """
        Read an S3 object and yield records in batches.
        Supports CSV and JSON (newline-delimited) objects, detected by extension.
        """
        self.require_connected()

        batch_size = options.get("batch_size", 1000)

        response = self._client.get_object(Bucket=self._bucket, Key=asset)
        body = response["Body"].read().decode("utf-8")

        if asset.lower().endswith(".csv"):
            reader = csv.DictReader(io.StringIO(body))
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
            for line in body.splitlines():
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
            yield [{"_raw": body}]

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        """
        Write records to an S3 object.
        Format is inferred from the asset key extension (CSV or JSON lines).
        """
        if not records:
            return 0

        self.require_connected()

        if asset.lower().endswith(".csv"):
            fieldnames = list(records[0].keys())
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(records)
            payload = buf.getvalue().encode("utf-8")
        else:
            lines = [json.dumps(r, default=str) for r in records]
            payload = ("\n".join(lines) + "\n").encode("utf-8")

        self._client.put_object(
            Bucket=self._bucket,
            Key=asset,
            Body=payload,
        )

        return len(records)
