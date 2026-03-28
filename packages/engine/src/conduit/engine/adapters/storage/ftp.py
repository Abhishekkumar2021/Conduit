"""
Conduit Engine — FTP / FTPS Adapter.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from ftplib import FTP, FTP_TLS
from typing import Any, Generator

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {
    ".csv", ".tsv", ".json", ".jsonl", ".ndjson", ".txt",
}


@adapter(
    type="ftp",
    name="FTP",
    category="storage",
    capabilities=["read", "write", "discover", "test"],
)
class FTPAdapter(BaseAdapter):
    """
    Adapter for FTP and FTPS servers.
    """

    vault_fields = [
        "host",
        "port:int=21",
        "username",
        "password:secret",
        "use_tls",
        "base_path",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._ftp: FTP | None = None
        self._base_path: str = "/"

    def connect(self) -> None:
        if self._connected:
            return

        host = self._config.get("host", "")
        port = int(self._config.get("port", 21))
        username = self._config.get("username", "anonymous")
        password = self._config.get("password", "")
        use_tls = str(self._config.get("use_tls", "false")).lower() == "true"
        self._base_path = self._config.get("base_path", "/")

        if not host:
            raise ValueError("FTP adapter requires 'host'.")

        try:
            if use_tls:
                ftp = FTP_TLS()
                ftp.connect(host, port)
                ftp.login(username, password)
                ftp.prot_p()
            else:
                ftp = FTP()
                ftp.connect(host, port)
                ftp.login(username, password)

            ftp.set_pasv(True)

            if self._base_path and self._base_path != "/":
                ftp.cwd(self._base_path)

            self._ftp = ftp
            self._connected = True
            logger.debug("Connected to FTP %s:%s", host, port)

        except Exception as e:
            self._ftp = None
            raise ConnectionError(f"Failed to connect to FTP: {e}") from e

    def disconnect(self) -> None:
        if self._ftp:
            try:
                self._ftp.quit()
            except Exception:
                try:
                    self._ftp.close()
                except Exception:
                    pass
        self._ftp = None
        self._connected = False

    def test(self) -> bool:
        if not self._ftp:
            self.connect()
        try:
            self._ftp.pwd()  # type: ignore
            return True
        except Exception as e:
            logger.error("FTP test failed: %s", e)
            return False

    def _list_recursive(self, path: str = "", depth: int = 0, max_depth: int = 3) -> list[str]:
        results: list[str] = []
        if depth > max_depth:
            return results

        lines: list[str] = []
        try:
            self._ftp.retrlines(f"LIST {path}", lines.append)  # type: ignore
        except Exception:
            return results

        for line in lines:
            parts = line.split(None, 8)
            if len(parts) < 9:
                continue
            name = parts[8]
            if name in (".", ".."):
                continue

            entry_path = f"{path}/{name}".lstrip("/")

            if line.startswith("d"):
                results.extend(self._list_recursive(entry_path, depth + 1, max_depth))
            else:
                ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
                if ext in SUPPORTED_EXTENSIONS:
                    results.append(entry_path)

            if len(results) >= 5000:
                break

        return results

    def discover(self) -> list[dict]:
        self.require_connected()
        files = self._list_recursive()
        assets: list[dict] = []
        for f in files:
            try:
                size = self._ftp.size(f)  # type: ignore
            except Exception:
                size = 0
            assets.append({
                "qualified_name": f,
                "asset_type": "file",
                "size_bytes": size or 0,
            })
        return assets

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        self.require_connected()
        batch_size = options.get("batch_size", 1000)

        buf = io.BytesIO()
        self._ftp.retrbinary(f"RETR {asset}", buf.write)  # type: ignore
        buf.seek(0)
        text = buf.read().decode("utf-8")

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

        if asset.lower().endswith(".csv"):
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=list(records[0].keys()))
            writer.writeheader()
            writer.writerows(records)
            payload = buf.getvalue().encode("utf-8")
        else:
            lines = [json.dumps(r, default=str) for r in records]
            payload = ("\n".join(lines) + "\n").encode("utf-8")

        self._ftp.storbinary(f"STOR {asset}", io.BytesIO(payload))  # type: ignore
        return len(records)
