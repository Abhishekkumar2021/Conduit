"""
Conduit Server — Notification service.

Sends notifications on run events via configurable channels (webhook, etc.).
"""

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import httpx

logger = logging.getLogger(__name__)


class WebhookConfig:
    """Configuration for a webhook notification channel."""

    def __init__(self, url: str, events: list[str] | None = None, headers: dict | None = None):
        self.url = url
        self.events = events or ["run.succeeded", "run.failed"]
        self.headers = headers or {}


class NotificationService:
    """
    Dispatches notifications when run events occur.

    Channels are registered per-workspace. Currently supports webhooks.
    """

    def __init__(self):
        self._channels: dict[str, list[WebhookConfig]] = {}

    def register_webhook(self, workspace_id: str, config: WebhookConfig) -> None:
        """Register a webhook channel for a workspace."""
        key = str(workspace_id)
        if key not in self._channels:
            self._channels[key] = []
        self._channels[key].append(config)

    async def notify_run_event(
        self,
        workspace_id: UUID,
        event_type: str,
        payload: dict[str, Any],
    ) -> None:
        """
        Send notifications for a run event.

        event_type: "run.started", "run.succeeded", "run.failed", "run.cancelled"
        """
        key = str(workspace_id)
        channels = self._channels.get(key, [])

        for channel in channels:
            if event_type not in channel.events:
                continue

            try:
                await self._send_webhook(channel, event_type, payload)
            except Exception:
                logger.exception(
                    "Failed to send webhook notification for %s to %s",
                    event_type, channel.url,
                )

    async def _send_webhook(
        self, config: WebhookConfig, event_type: str, payload: dict[str, Any]
    ) -> None:
        """Send a single webhook notification."""
        body = {
            "event": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": payload,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                config.url,
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Conduit-Webhook/1.0",
                    **config.headers,
                },
            )
            if resp.status_code >= 400:
                logger.warning(
                    "Webhook %s returned %d for event %s",
                    config.url, resp.status_code, event_type,
                )
