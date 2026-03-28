"""
Conduit Engine — SFTP Adapter.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import stat
from typing import Any, Generator

try:
    import paramiko  # type: ignore

    HAS_PARAMIKO = True
except ImportError:
    HAS_PARAMIKO = False

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {
    ".csv", ".tsv", ".json", ".jsonl", ".ndjson", ".txt", ".parquet", ".pq",
}


@adapter(
    type="sftp",
    name="SFTP",
    category="storage",
    capabilities=["read", "write", "discover", "test"],
)
class SFTPAdapter(BaseAdapter):
    """
    Adapter for SFTP servers via Paramiko.
    """

    vault_fields = [
        "host",
        "port:int=22",
        "username",
        "password:secret",
        "private_key:secret",
        "base_path",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._transport: Any = None
        self._sftp: Any = None
        self._base_path: str = "/"

    def connect(self) -> None:
        if self._connected:
            return

        if not HAS_PARAMIKO:
            raise ImportError(
                "paramiko is required for SFTP. Install with `pip install paramiko`."
            )

        host = self._config.get("host", "")
        port = int(self._config.get("port", 22))
        username = self._config.get("username", "")
        password = self._config.get("password")
        private_key_str = self._config.get("private_key")
        self._base_path = self._config.get("base_path", "/")

        if not host or not username:
            raise ValueError("SFTP adapter requires 'host' and 'username'.")

        try:
            self._transport = paramiko.Transport((host, port))

            if private_key_str:
                key = paramiko.RSAKey.from_private_key(io.StringIO(private_key_str))
                self._transport.connect(username=username, pkey=key)
            elif password:
                self._transport.connect(username=username, password=password)
            else:
                raise ValueError("SFTP requires 'password' or 'private_key'.")

            self._sftp = paramiko.SFTPClient.from_transport(self._transport)
            self._sftp.listdir(self._base_path)
            self._connected = True
            logger.debug("Connected to SFTP %s:%s", host, port)

        except Exception as e:
            self.disconnect()
            raise ConnectionError(f"Failed to connect to SFTP: {e}") from e

    def disconnect(self) -> None:
        if self._sftp:
            try:
                self._sftp.close()
            except Exception:
                pass
        if self._transport:
            try:
                self._transport.close()
            except Exception:
                pass
        self._sftp = None
        self._transport = None
        self._connected = False

    def test(self) -> bool:
        if not self._sftp:
            self.connect()
        try:
            self._sftp.listdir(self._base_path)
            return True
        except Exception as e:
            logger.error("SFTP test failed: %s", e)
            return False

    def _walk(self, path: str, depth: int = 0, max_depth: int = 5) -> list[str]:
        results: list[str] = []
        if depth > max_depth:
            return results
        try:
            entries = self._sftp.listdir_attr(path)
        except Exception:
            return results

        for entry in entries:
            full = f"{path.rstrip('/')}/{entry.filename}"
            if stat.S_ISDIR(entry.st_mode or 0):
                results.extend(self._walk(full, depth + 1, max_depth))
            else:
                ext = "." + entry.filename.rsplit(".", 1)[-1].lower() if "." in entry.filename else ""
                if ext in SUPPORTED_EXTENSIONS:
                    results.append(full)
            if len(results) >= 5000:
                break
        return results

    def discover(self) -> list[dict]:
        self.require_connected()
        files = self._walk(self._base_path)
        assets: list[dict] = []
        for f in files:
            rel = f[len(self._base_path):].lstrip("/")
            try:
                st = self._sftp.stat(f)
                size = st.st_size or 0
            except Exception:
                size = 0
            assets.append({
                "qualified_name": rel,
                "asset_type": "file",
                "size_bytes": size,
            })
        return assets

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        self.require_connected()
        batch_size = options.get("batch_size", 1000)
        remote_path = f"{self._base_path.rstrip('/')}/{asset}"

        with self._sftp.open(remote_path, "r") as f:
            content = f.read()
        text = content.decode("utf-8") if isinstance(content, bytes) else content

        if asset.lower().endswith((".csv", ".tsv", ".txt")):
            delimiter = "\t" if asset.lower().endswith(".tsv") else ","
            reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
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

        remote_path = f"{self._base_path.rstrip('/')}/{asset}"

        if asset.lower().endswith(".csv"):
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=list(records[0].keys()))
            writer.writeheader()
            writer.writerows(records)
            payload = buf.getvalue().encode("utf-8")
        else:
            lines = [json.dumps(r, default=str) for r in records]
            payload = ("\n".join(lines) + "\n").encode("utf-8")

        with self._sftp.open(remote_path, "w") as f:
            f.write(payload)

        return len(records)
