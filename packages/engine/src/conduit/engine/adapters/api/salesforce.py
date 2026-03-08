"""
Conduit Engine — Salesforce Adapter.
"""

from __future__ import annotations

import logging
from typing import Any, Generator

# We use simple-salesforce per user requirement for robust API connection
from simple_salesforce import Salesforce, SalesforceAuthenticationFailed  # type: ignore

from conduit.engine.adapters.base import BaseAdapter, adapter

logger = logging.getLogger(__name__)


@adapter(
    type="salesforce",
    name="Salesforce",
    category="api",
    capabilities=["read", "discover", "test"],
)
class SalesforceAdapter(BaseAdapter):
    """
    Adapter for Salesforce REST API using simple-salesforce.
    Requires: instance_url, client_id, client_secret, username, password, security_token.
    """

    vault_fields = [
        "instance_url",
        "client_id",
        "client_secret:secret",
        "username",
        "password:secret",
        "security_token:secret",
    ]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.sf: Salesforce | None = None

    def connect(self) -> None:
        if self._connected:
            return

        domain = "login"
        instance_url = self._config.get("instance_url", "")
        if "test.salesforce.com" in instance_url:
            domain = "test"

        try:
            self.sf = Salesforce(
                username=self._config.get("username"),
                password=self._config.get("password"),
                security_token=self._config.get("security_token", ""),
                client_id=self._config.get("client_id"),
                domain=domain,
            )
            self._connected = True
            logger.debug("Connected to Salesforce API")
        except SalesforceAuthenticationFailed as e:
            raise ValueError(f"Salesforce authentication failed: {e}")

    def disconnect(self) -> None:
        self.sf = None
        self._connected = False

    def test(self) -> bool:
        if not self.sf:
            try:
                self.connect()
            except ValueError as e:
                logger.error("Salesforce test connect failed: %s", e)
                return False
        try:
            self.sf.query("SELECT Id FROM User LIMIT 1")
            return True
        except Exception as e:
            logger.error("Salesforce test failed: %s", e)
            return False

    def discover(self) -> list[dict]:
        """Discover Salesforce objects (SObjects)."""
        if not self._connected or not self.sf:
            raise RuntimeError(
                "Adapter is not connected. Use 'with adapter.session():' context manager."
            )

        try:
            desc = self.sf.describe()
            objects = desc.get("sobjects", [])
            return [
                {"qualified_name": obj["name"], "asset_type": "object"}
                for obj in objects
                if obj.get("queryable")
            ]
        except Exception as e:
            logger.error("Failed to discover Salesforce objects: %s", e)
            raise

    def read(self, asset: str, **options: Any) -> Generator[list[dict], None, None]:
        if not self._connected or not self.sf:
            raise RuntimeError(
                "Adapter is not connected. Use 'with adapter.session():' context manager."
            )

        fields = options.get("fields")
        if not fields:
            # Describe the specific object to get all fields
            try:
                asset_desc = getattr(self.sf, asset).describe()
                fields = [f["name"] for f in asset_desc.get("fields", [])]
            except Exception as e:
                logger.error("Failed to describe %s: %s", asset, e)
                raise

        field_str = ", ".join(fields)
        query = f"SELECT {field_str} FROM {asset}"

        try:
            result = self.sf.query_all(query)
            records = result.get("records", [])

            # Clean up attributes added by Salesforce
            for r in records:
                r.pop("attributes", None)

            # Yield chunks of 1000 records
            chunk_size = 1000
            for i in range(0, len(records), chunk_size):
                yield records[i : i + chunk_size]

        except Exception as e:
            logger.error("Failed to read from Salesforce asset %s: %s", asset, e)
            raise

    def write(self, asset: str, records: list[dict], **options: Any) -> int:
        raise NotImplementedError("Salesforce write is not currently implemented.")
