"""
Conduit Runner — Standalone Execution Daemon.
"""

import logging
import signal
import time
from typing import Any, Dict

import httpx

from conduit.engine.contracts import (
    RunClaimPayloadValidationError,
    validate_run_claim_payload,
)
from conduit.engine.core.graph import Graph, Node
from conduit.engine.core.runner import LocalRunner

logger = logging.getLogger(__name__)

_RETRYABLE_STATUS_CODES = frozenset({502, 503, 504})


class RunnerDaemon:
    def __init__(
        self,
        api_url: str = "http://localhost:8000/api/v1",
        poll_interval: int = 5,
        max_consecutive_errors: int = 10,
    ):
        self.api_url = api_url.rstrip("/")
        self.poll_interval = poll_interval
        self.max_consecutive_errors = max_consecutive_errors
        self._shutdown = False
        self.client = httpx.Client(timeout=30.0)

    def start(self) -> None:
        """Continuously poll for pending runs. Handles graceful shutdown via SIGTERM/SIGINT."""
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)

        logger.info(
            "Runner daemon started — polling %s every %ds",
            self.api_url, self.poll_interval,
        )

        consecutive_errors = 0

        try:
            while not self._shutdown:
                try:
                    self._poll_once()
                    consecutive_errors = 0
                except httpx.HTTPError as exc:
                    consecutive_errors += 1
                    logger.error(
                        "API communication error (%d/%d): %s",
                        consecutive_errors, self.max_consecutive_errors, exc,
                    )
                    if consecutive_errors >= self.max_consecutive_errors:
                        logger.critical(
                            "Too many consecutive API errors — shutting down"
                        )
                        break
                except Exception:
                    consecutive_errors += 1
                    logger.exception("Unexpected error in poll cycle")
                    if consecutive_errors >= self.max_consecutive_errors:
                        logger.critical(
                            "Too many consecutive errors — shutting down"
                        )
                        break

                self._sleep(self.poll_interval)
        finally:
            self.client.close()
            logger.info("Runner daemon stopped")

    def _signal_handler(self, signum: int, _frame: Any) -> None:
        sig_name = signal.Signals(signum).name
        logger.info("Received %s — initiating graceful shutdown", sig_name)
        self._shutdown = True

    def _sleep(self, seconds: int) -> None:
        """Interruptible sleep that checks shutdown flag."""
        for _ in range(seconds * 10):
            if self._shutdown:
                break
            time.sleep(0.1)

    def _poll_once(self) -> None:
        """Execute a single polling iteration."""
        resp = self.client.post(f"{self.api_url}/runs/claim")

        if resp.status_code == 404:
            return

        if resp.status_code in _RETRYABLE_STATUS_CODES:
            logger.warning("API returned %d — will retry", resp.status_code)
            return

        resp.raise_for_status()
        data = resp.json()

        try:
            validate_run_claim_payload(data)
        except RunClaimPayloadValidationError as exc:
            run_id = str(data.get("run_id", "")).strip() if isinstance(data, dict) else ""
            logger.error("Invalid run claim payload: %s", exc)
            if run_id:
                self._update_status(run_id, "failed", f"Invalid claim payload: {exc}")
            return

        run_id = data["run_id"]
        logger.info("Claimed run %s — preparing execution", run_id)

        try:
            self._execute_run(run_id, data)
        except Exception as exc:
            logger.exception("Execution failed for run %s", run_id)
            self._update_status(run_id, "failed", str(exc))

    def _execute_run(self, run_id: str, payload: Dict[str, Any]) -> None:
        start_time = time.monotonic()

        graph_data = payload.get("graph", {})
        raw_nodes = graph_data.get("nodes", {})
        raw_edges = graph_data.get("edges", [])

        nodes = []
        for stage_id, sd in raw_nodes.items():
            config = sd.get("config", {})
            nodes.append(
                Node(
                    id=stage_id,
                    key=stage_id,
                    label=sd.get("name", "Unnamed Stage"),
                    kind=sd.get("kind"),
                    config=config,
                    integration_id=config.get("integration_id"),
                )
            )

        edges = [
            {"source_id": e["source"], "target_id": e["target"]}
            for e in raw_edges
        ]

        graph = Graph(nodes=nodes, edges=edges)

        if not graph.validate():
            raise ValueError("Invalid DAG: cycle detected")

        integration_configs = payload.get("integration_configs", {})

        runner = LocalRunner(
            graph=graph, integration_configs=integration_configs, run_id=run_id
        )
        results = runner.run()

        duration_ms = int((time.monotonic() - start_time) * 1000)
        final_status = results.get("status", "failed")

        logger.info(
            "Run %s completed: status=%s duration=%dms",
            run_id, final_status, duration_ms,
        )
        self._update_status(run_id, final_status, duration_ms=duration_ms)

    def _update_status(
        self,
        run_id: str,
        status: str,
        error_message: str | None = None,
        duration_ms: int | None = None,
    ) -> None:
        """Send the final execution status back to the server."""
        payload: Dict[str, Any] = {"status": status}
        if error_message:
            payload["error_message"] = error_message[:4096]
        if duration_ms is not None:
            payload["duration_ms"] = duration_ms

        try:
            resp = self.client.patch(
                f"{self.api_url}/runs/{run_id}/status", json=payload
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error("Failed to report status for run %s: %s", run_id, exc)
