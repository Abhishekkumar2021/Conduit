"""WebSocket endpoint for real-time run status updates."""

import asyncio
import json
import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.infra.database.models import Run
from app.infra.database.session import sessionmanager

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections per workspace."""

    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, workspace_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if workspace_id not in self._connections:
            self._connections[workspace_id] = []
        self._connections[workspace_id].append(websocket)

    def disconnect(self, workspace_id: str, websocket: WebSocket) -> None:
        if workspace_id in self._connections:
            self._connections[workspace_id] = [
                ws for ws in self._connections[workspace_id] if ws != websocket
            ]

    async def broadcast(self, workspace_id: str, message: dict) -> None:
        """Send a message to all connections in a workspace."""
        connections = self._connections.get(workspace_id, [])
        dead: list[WebSocket] = []
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(workspace_id, ws)


manager = ConnectionManager()


@router.websocket("/ws/{workspace_id}/runs")
async def run_updates(websocket: WebSocket, workspace_id: str):
    """
    WebSocket endpoint for live run status updates.

    Polls the database every 2 seconds and pushes changes for active runs.
    Client receives messages like:
        {"type": "run.update", "data": {"id": "...", "status": "running", ...}}
    """
    await manager.connect(workspace_id, websocket)

    last_states: dict[str, str] = {}

    try:
        while True:
            try:
                async with sessionmanager.session() as session:
                    stmt = (
                        select(Run)
                        .where(
                            Run.workspace_id == UUID(workspace_id),
                            Run.status.in_(["pending", "queued", "running"]),
                        )
                        .order_by(Run.created_at.desc())
                        .limit(20)
                    )
                    result = await session.execute(stmt)
                    runs = result.scalars().all()

                    for run in runs:
                        run_id = str(run.id)
                        current_status = run.status
                        if last_states.get(run_id) != current_status:
                            last_states[run_id] = current_status
                            await websocket.send_json(
                                {
                                    "type": "run.update",
                                    "data": {
                                        "id": run_id,
                                        "pipeline_id": str(run.pipeline_id),
                                        "status": run.status,
                                        "started_at": run.started_at.isoformat() if run.started_at else None,
                                        "duration_ms": run.duration_ms,
                                    },
                                }
                            )

            except Exception:
                logger.exception("Error polling run updates")

            await asyncio.sleep(2)

    except WebSocketDisconnect:
        manager.disconnect(workspace_id, websocket)
    except Exception:
        manager.disconnect(workspace_id, websocket)
