"""Data preview endpoints — preview data from integrations."""

import asyncio
import datetime
import decimal
import uuid as _uuid
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies.services import get_integration_service, get_vault_service
from app.services.integration import IntegrationService
from app.services.vault import VaultService
from conduit.engine.adapters.registry import AdapterRegistry

router = APIRouter()


def _json_safe_value(v: Any) -> Any:
    """Convert a single value to a JSON-safe representation."""
    if v is None or isinstance(v, (str, int, float, bool)):
        return v
    if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
        return v.isoformat()
    if isinstance(v, datetime.timedelta):
        return str(v)
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, _uuid.UUID):
        return str(v)
    if isinstance(v, (bytes, bytearray, memoryview)):
        return bytes(v).hex()
    if isinstance(v, dict):
        return {k: _json_safe_value(val) for k, val in v.items()}
    if isinstance(v, (list, tuple, set, frozenset)):
        return [_json_safe_value(item) for item in v]
    return str(v)


def _sanitise_records(records: list[dict]) -> list[dict]:
    """Ensure every value in every record is JSON-serializable."""
    return [{k: _json_safe_value(v) for k, v in rec.items()} for rec in records]


@router.get("/integrations/{integration_id}/preview")
async def preview_integration_data(
    integration_id: UUID,
    asset: str = Query(description="Qualified name of the asset to preview"),
    limit: int = Query(default=50, ge=1, le=500),
    integration_service: IntegrationService = Depends(get_integration_service),
    vault_service: VaultService = Depends(get_vault_service),
):
    """
    Preview data from an integration's asset.

    Returns up to `limit` records from the specified asset.
    """
    integration = await integration_service.integration_repo.get(integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    try:
        meta = AdapterRegistry.get(integration.adapter_type)
        resolved_config = vault_service.resolve_integration_config(
            plain_config=integration.config or {},
            vault_fields=meta.vault_fields,
        )

        adapter = AdapterRegistry.create(integration.adapter_type, resolved_config)

        def _read_preview():
            records: list[dict[str, Any]] = []
            with adapter.session():
                for batch in adapter.read(asset, batch_size=limit):
                    records.extend(batch)
                    if len(records) >= limit:
                        return records[:limit]
            return records

        records = await asyncio.to_thread(_read_preview)
        safe_records = _sanitise_records(records)
        columns = list(safe_records[0].keys()) if safe_records else []

        return {
            "asset": asset,
            "columns": columns,
            "records": safe_records,
            "total": len(safe_records),
            "truncated": len(safe_records) >= limit,
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to preview data: {str(e)[:500]}",
        )
