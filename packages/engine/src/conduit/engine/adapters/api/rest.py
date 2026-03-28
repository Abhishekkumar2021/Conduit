"""
Conduit Engine — REST API Adapter.
"""

from __future__ import annotations

import logging
from typing import Any, Generator

try:
    import httpx  # type: ignore

    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="rest_api",
    name="REST API",
    category="api",
    capabilities=["read", "write", "discover", "test"],
)
class RESTAPIAdapter(BaseAdapter):
    """
    Adapter for generic REST APIs via httpx.
    Requires: base_url, and optionally auth_type/auth_token/auth_header.
    """

    vault_fields = [
        "base_url",
        "auth_type",
        "auth_token:secret",
        "auth_header",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.client: Any = None

    def _build_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        auth_type = self._config.get("auth_type", "")
        auth_token = self._config.get("auth_token", "")
        auth_header = self._config.get("auth_header", "Authorization")

        if auth_type and auth_token:
            if auth_type.lower() == "bearer":
                headers[auth_header] = f"Bearer {auth_token}"
            elif auth_type.lower() == "token":
                headers[auth_header] = f"Token {auth_token}"
            elif auth_type.lower() == "basic":
                headers[auth_header] = f"Basic {auth_token}"
            else:
                headers[auth_header] = auth_token

        return headers

    def connect(self) -> None:
        if self._connected:
            return

        if not HAS_HTTPX:
            raise ImportError(
                "httpx is required to use the REST API adapter. "
                "Install it with `pip install httpx`."
            )

        base_url = self._config.get("base_url")
        if not base_url:
            raise ValueError("REST API adapter requires 'base_url'.")

        headers = self._build_headers()
        self.client = httpx.Client(
            base_url=base_url,
            headers=headers,
            timeout=30.0,
        )

        self._connected = True
        logger.debug("REST API adapter ready for %s", base_url)

    def disconnect(self) -> None:
        if self.client:
            self.client.close()
            self.client = None
        self._connected = False

    def test(self) -> bool:
        if not self.client:
            self.connect()
        try:
            resp = self.client.get("/")
            return resp.status_code < 500
        except Exception as e:
            logger.error("REST API test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        """REST APIs have no intrinsic schema — returns empty list."""
        self.require_connected()
        return []

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        """GET data from an endpoint with optional pagination."""
        self.require_connected()

        batch_size = options.get("batch_size", 100)
        params = dict(options.get("params", {}))
        pagination_key = options.get("pagination_key", "next")
        data_key = options.get("data_key")

        endpoint = asset if asset.startswith("/") else f"/{asset}"

        while endpoint:
            resp = self.client.get(endpoint, params=params)
            resp.raise_for_status()
            body = resp.json()

            if isinstance(body, list):
                for i in range(0, len(body), batch_size):
                    yield body[i : i + batch_size]
                break

            if data_key and isinstance(body, dict):
                items = body.get(data_key, [])
            elif isinstance(body, dict) and "results" in body:
                items = body["results"]
            elif isinstance(body, dict) and "data" in body:
                items = body["data"]
            else:
                yield [body]
                break

            if items:
                for i in range(0, len(items), batch_size):
                    yield items[i : i + batch_size]

            if isinstance(body, dict) and pagination_key in body:
                next_url = body[pagination_key]
                if next_url and isinstance(next_url, str):
                    endpoint = next_url
                    params = {}
                else:
                    break
            else:
                break

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        """POST records to an endpoint."""
        if not records:
            return 0

        self.require_connected()

        endpoint = asset if asset.startswith("/") else f"/{asset}"
        bulk = options.get("bulk", True)

        written = 0
        if bulk:
            resp = self.client.post(endpoint, json=records)
            resp.raise_for_status()
            written = len(records)
        else:
            for record in records:
                resp = self.client.post(endpoint, json=record)
                resp.raise_for_status()
                written += 1

        return written
