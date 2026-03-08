"""
Conduit Runner — Standalone Execution Daemon.
"""

import time
import logging
import httpx
from typing import Any, Dict

from conduit.engine.contracts import (
    RunClaimPayloadValidationError,
    validate_run_claim_payload,
)
from conduit.engine.core.graph import Graph, Node
from conduit.engine.core.runner import LocalRunner

logger = logging.getLogger(__name__)


class RunnerDaemon:
    def __init__(
        self, api_url: str = "http://localhost:8000/api/v1", poll_interval: int = 5
    ):
        self.api_url = api_url.rstrip("/")
        self.poll_interval = poll_interval
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)
        self.client = httpx.Client(timeout=30.0)

    def start(self):
        """Continuously poll for pending runs."""
        logger.info(
            f"Runner Daemon started. Polling {self.api_url} every {self.poll_interval}s."
        )
        try:
            while True:
                self._poll_once()
                time.sleep(self.poll_interval)
        except KeyboardInterrupt:
            logger.info("Runner stopping gracefully.")
        finally:
            self.client.close()

    def _poll_once(self):
        """Execute a single polling iteration."""
        data: dict[str, Any] | None = None
        try:
            # 1. Claim pending run
            resp = self.client.post(f"{self.api_url}/runs/claim")

            if resp.status_code == 404:
                return  # No pending runs

            resp.raise_for_status()
            data = resp.json()
            validate_run_claim_payload(data)
            run_id = data["run_id"]

            logger.info(f"Claimed Run {run_id}. Preparing execution.")

            try:
                self._execute_run(run_id, data)
            except Exception as e:
                logger.exception(f"Execution failed for {run_id}: {e}")
                self._update_status(run_id, "failed", str(e))

        except RunClaimPayloadValidationError as e:
            run_id = ""
            if isinstance(data, dict):
                run_id = str(data.get("run_id", "")).strip()
            logger.error("Invalid run claim payload: %s", e)
            if run_id:
                self._update_status(run_id, "failed", f"Invalid claim payload: {e}")
        except httpx.HTTPError as e:
            logger.error(f"Failed to communicate with API: {e}")

    def _execute_run(self, run_id: str, payload: Dict[str, Any]):
        start_time = time.time()

        # 1. Parse Graph
        graph_data = payload.get("graph", {})
        raw_nodes = graph_data.get("nodes", {})
        raw_edges = graph_data.get("edges", [])

        nodes = []
        integration_ids = set()

        for stage_id, sd in raw_nodes.items():
            config = sd.get("config", {})
            integration_id = config.get("integration_id")
            if integration_id:
                integration_ids.add(integration_id)

            nodes.append(
                Node(
                    id=stage_id,
                    key=stage_id,
                    label=sd.get("name", "Unnamed Stage"),
                    kind=sd.get("kind"),
                    config=config,
                    integration_id=integration_id,
                )
            )

        edges = []
        for e in raw_edges:
            edges.append({"source_id": e["source"], "target_id": e["target"]})

        graph = Graph(nodes=nodes, edges=edges)

        if not graph.validate():
            raise ValueError("Invalid DAG: Cycle detected")

        workspace_id = payload.get("workspace_id")

        # 2. Extract Integration Configs directly from the claim payload
        integration_configs = payload.get("integration_configs", {})

        # 3. Instantiate and run the Engine
        runner = LocalRunner(
            graph=graph, integration_configs=integration_configs, run_id=run_id
        )
        results = runner.run()

        # 4. Report success
        duration_ms = int((time.time() - start_time) * 1000)
        final_status = results.get("status", "failed")

        logger.info(
            f"Run {run_id} completed with status: {final_status} in {duration_ms}ms"
        )
        self._update_status(run_id, final_status, duration_ms=duration_ms)

    def _update_status(
        self,
        run_id: str,
        status: str,
        error_message: str | None = None,
        duration_ms: int | None = None,
    ):
        """Send the final execution status back to the server."""
        payload = {
            "status": status,
        }
        if error_message:
            payload["error_message"] = error_message
        if duration_ms is not None:
            payload["duration_ms"] = duration_ms

        try:
            resp = self.client.patch(
                f"{self.api_url}/runs/{run_id}/status", json=payload
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"Failed to report status for {run_id}: {e}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    daemon = RunnerDaemon()
    daemon.start()
