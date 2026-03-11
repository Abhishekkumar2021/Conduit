"""
Conduit Server — Processor metadata API.

Exposes available processor types to the frontend so the pipeline builder
can offer them in the UI.
"""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from conduit.engine.processors.registry import ProcessorRegistry

router = APIRouter()


class ProcessorResponse(BaseModel):
    type: str
    name: str
    category: str
    description: str
    parameters: list[dict[str, Any]]


@router.get("/processors", response_model=list[ProcessorResponse])
async def list_processors():
    """Return metadata for all registered processors."""
    ProcessorRegistry.discover()
    return [meta.to_dict() for meta in ProcessorRegistry.list_all()]
