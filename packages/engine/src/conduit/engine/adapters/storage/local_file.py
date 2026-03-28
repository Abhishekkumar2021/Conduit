"""
Conduit Engine — Local File Adapter.

Reads and writes CSV, JSON/JSONL, TSV, and Parquet files from the local filesystem.
"""

from __future__ import annotations

import ast
import csv
import json
import logging
import os
import re
from typing import Any, Generator

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {
    ".csv", ".tsv", ".json", ".jsonl", ".ndjson",
    ".parquet", ".pq", ".txt", ".xml",
}

IGNORED_DIRS = {
    "__pycache__", ".git", ".svn", ".hg", "node_modules",
    ".venv", "venv", ".tox", ".mypy_cache", ".pytest_cache",
}


def _strip_jsonc(text: str) -> str:
    """Strip // and /* */ comments from JSONC text while respecting strings."""
    result: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        if text[i] == '"':
            j = i + 1
            while j < n:
                if text[j] == '\\':
                    j += 2
                    continue
                if text[j] == '"':
                    j += 1
                    break
                j += 1
            result.append(text[i:j])
            i = j
        elif text[i:i+2] == '//':
            i = text.find('\n', i)
            if i == -1:
                break
        elif text[i:i+2] == '/*':
            end = text.find('*/', i + 2)
            i = end + 2 if end != -1 else n
        else:
            result.append(text[i])
            i += 1
    return ''.join(result)


def _strip_trailing_commas(text: str) -> str:
    """Remove trailing commas before } or ]."""
    return re.sub(r',\s*([}\]])', r'\1', text)


def _parse_lenient(text: str) -> Any:
    """Parse JSON/JSONC with fallback to Python literal syntax."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    cleaned = _strip_trailing_commas(_strip_jsonc(text))
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    try:
        return ast.literal_eval(text)
    except (ValueError, SyntaxError):
        raise ValueError(
            f"Cannot parse as JSON or Python literal: {text[:120]}..."
        )


@adapter(
    type="local_file",
    name="Local File",
    category="storage",
    capabilities=["read", "write", "discover", "test"],
)
class LocalFileAdapter(BaseAdapter):
    """
    Adapter for reading/writing files on the local filesystem.
    """

    vault_fields = [
        "base_path",
        "recursive",
        "file_pattern",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._base_path: str = ""

    def connect(self) -> None:
        if self._connected:
            return
        self._base_path = self._config.get("base_path", ".")
        if not os.path.isdir(self._base_path):
            raise ConnectionError(
                f"Base path '{self._base_path}' does not exist or is not a directory."
            )
        self._connected = True
        logger.debug("Connected to local filesystem at '%s'", self._base_path)

    def disconnect(self) -> None:
        self._connected = False

    def test(self) -> bool:
        path = self._config.get("base_path", ".")
        return os.path.isdir(path)

    def _resolve_path(self, asset: str) -> str:
        base = os.path.abspath(self._base_path)
        full = os.path.abspath(os.path.join(base, asset.lstrip(os.sep).lstrip("/")))
        if not full.startswith(base):
            raise ValueError(f"Access denied: '{asset}' is outside base directory")
        return full

    def discover(self) -> list[dict]:
        self.require_connected()

        recursive = str(self._config.get("recursive", "true")).lower() == "true"
        pattern = self._config.get("file_pattern", "")
        assets: list[dict] = []
        base = os.path.abspath(self._base_path)

        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]

            for fname in filenames:
                ext = os.path.splitext(fname)[1].lower()
                if ext not in SUPPORTED_EXTENSIONS:
                    continue
                if pattern and pattern.lower() not in fname.lower():
                    continue

                full = os.path.join(dirpath, fname)
                rel = os.path.relpath(full, base)
                stat = os.stat(full)

                assets.append({
                    "qualified_name": rel,
                    "asset_type": "file",
                    "size_bytes": stat.st_size,
                })

            if not recursive:
                break

            if len(assets) >= 10_000:
                break

        return assets

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        self.require_connected()
        path = self._resolve_path(asset)
        batch_size = options.get("batch_size", 1000)
        ext = os.path.splitext(path)[1].lower()

        if ext in (".csv", ".tsv", ".txt"):
            delimiter = "\t" if ext == ".tsv" else ","
            with open(path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f, delimiter=delimiter)
                batch: list[dict] = []
                for row in reader:
                    batch.append(dict(row))
                    if len(batch) >= batch_size:
                        yield batch
                        batch = []
                if batch:
                    yield batch

        elif ext in (".json", ".jsonl", ".ndjson"):
            with open(path, encoding="utf-8") as f:
                first = f.read(1)
                f.seek(0)
                if first in ("[", "{"):
                    raw = f.read()
                    data = _parse_lenient(raw)
                    if isinstance(data, dict):
                        data = [data]
                    for i in range(0, len(data), batch_size):
                        yield data[i : i + batch_size]
                else:
                    batch = []
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        batch.append(_parse_lenient(line))
                        if len(batch) >= batch_size:
                            yield batch
                            batch = []
                    if batch:
                        yield batch

        elif ext in (".parquet", ".pq"):
            try:
                import pyarrow.parquet as pq  # type: ignore
            except ImportError:
                raise ImportError("pyarrow is required to read Parquet files")
            table = pq.read_table(path)
            records = table.to_pylist()
            for i in range(0, len(records), batch_size):
                yield records[i : i + batch_size]

        else:
            with open(path, encoding="utf-8") as f:
                yield [{"_raw": f.read()}]

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        if not records:
            return 0
        self.require_connected()

        path = self._resolve_path(asset)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        ext = os.path.splitext(path)[1].lower()

        if ext in (".csv", ".tsv", ".txt"):
            delimiter = "\t" if ext == ".tsv" else ","
            fieldnames = list(records[0].keys())
            with open(path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=delimiter)
                writer.writeheader()
                writer.writerows(records)

        elif ext in (".json",):
            with open(path, "w", encoding="utf-8") as f:
                json.dump(records, f, default=str, indent=2)

        elif ext in (".jsonl", ".ndjson"):
            with open(path, "w", encoding="utf-8") as f:
                for r in records:
                    f.write(json.dumps(r, default=str) + "\n")

        elif ext in (".parquet", ".pq"):
            try:
                import pyarrow as pa  # type: ignore
                import pyarrow.parquet as pq  # type: ignore
            except ImportError:
                raise ImportError("pyarrow is required to write Parquet files")
            table = pa.Table.from_pylist(records)
            pq.write_table(table, path)

        else:
            with open(path, "w", encoding="utf-8") as f:
                for r in records:
                    f.write(json.dumps(r, default=str) + "\n")

        return len(records)
