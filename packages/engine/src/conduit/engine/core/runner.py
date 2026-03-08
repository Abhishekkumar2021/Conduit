"""
Conduit Engine — Local execution runner for pipeline graphs.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Generator, List, Optional

from conduit.engine.adapters.registry import AdapterRegistry
from conduit.engine.core.graph import Graph, Node

logger = logging.getLogger(__name__)

# Type alias for the data stream
DataStream = Generator[List[Dict[str, Any]], None, None]


class LocalRunner:
    """
    Executes a pipeline graph on the local machine.
    Orchestrates the flow of data batches from sources through transforms to targets.

    All adapter I/O is synchronous (generators). The runner itself is synchronous
    to match — no false async wrappers.
    """

    def __init__(
        self,
        graph: Graph,
        integration_configs: Dict[str, Dict[str, Any]],
        run_id: Optional[str] = None,
    ):
        self.graph = graph
        self.configs = integration_configs
        self.run_id = run_id
        self._streams: Dict[str, DataStream] = {}
        self._active_sessions: List[Any] = []

    def run(self) -> Dict[str, Any]:
        """
        Execute the graph in topological order.
        Returns a result dict with status and per-step results.
        """
        logger.info("Starting pipeline execution [Run: %s]", self.run_id)

        order = self.graph.topological_sort()
        results: Dict[str, Any] = {"status": "success", "steps": []}
        node_id = ""

        try:
            for node_id in order:
                node = self.graph.nodes[node_id]
                logger.info(
                    "Executing node %s: %s (%s)", node_id, node.label, node.kind
                )

                # Normalize node kind for routing
                base_kind = node.kind.split("_")[-1]  # e.g. postgres_extract -> extract

                if base_kind == "extract":
                    self._handle_extract(node)
                elif base_kind == "transform":
                    self._handle_transform(node)
                elif base_kind == "load":
                    self._handle_load(node)

                results["steps"].append({"id": node_id, "status": "completed"})

        except Exception:
            logger.exception("Execution failed at node %s", node_id)
            results["status"] = "failed"
            raise
        finally:
            self._cleanup_sessions()

        return results

    def _cleanup_sessions(self):
        """Close all adapters that were opened during the run."""
        logger.debug("Cleaning up %d adapter sessions", len(self._active_sessions))
        for sess in reversed(self._active_sessions):
            try:
                sess.__exit__(None, None, None)
            except Exception:
                logger.exception("Error closing adapter session")
        self._active_sessions.clear()

    def _handle_extract(self, node: Node) -> None:
        """Initialize a source stream from an adapter."""
        if not node.integration_id:
            raise ValueError(f"Extract node {node.label} missing integration_id")

        config = self.configs.get(node.integration_id, {})
        adapter_type = node.kind.split("_")[0]
        adapter = AdapterRegistry.create(adapter_type, config)

        # Start session and track it for cleanup
        sess = adapter.session()
        sess.__enter__()
        self._active_sessions.append(sess)

        asset = node.config.get("asset")
        if not asset:
            raise ValueError(f"Extract node {node.label} missing asset in config")

        stream = adapter.read(asset, **node.config.get("options", {}))
        self._streams[node.id] = stream

    def _handle_transform(self, node: Node) -> None:
        """Wrap input streams with transformation logic."""
        if not node.inputs:
            raise ValueError(f"Transform node {node.label} has no inputs")

        input_node_id = node.inputs[0]
        input_stream = self._streams.get(input_node_id)

        if not input_stream:
            raise ValueError(f"Input stream for {node.label} not found")

        def transform_wrapper(upstream: DataStream) -> DataStream:
            for batch in upstream:
                processed_batch = self._apply_logic(node, batch)
                yield processed_batch

        self._streams[node.id] = transform_wrapper(input_stream)

    def _handle_load(self, node: Node) -> None:
        """Consume input streams into a target adapter."""
        if not node.inputs:
            raise ValueError(f"Load node {node.label} has no inputs")

        input_node_id = node.inputs[0]
        input_stream = self._streams.get(input_node_id)

        if input_stream is None:
            raise ValueError(f"Input stream for {node.label} is None")

        if not node.integration_id:
            raise ValueError(f"Load node {node.label} missing integration_id")

        config = self.configs.get(node.integration_id, {})
        adapter_type = node.kind.split("_")[0]
        adapter = AdapterRegistry.create(adapter_type, config)

        # Start session and track it for cleanup
        sess = adapter.session()
        sess.__enter__()
        self._active_sessions.append(sess)

        asset = node.config.get("asset")

        total_records = 0
        for batch in input_stream:
            count = adapter.write(asset, batch, **node.config.get("options", {}))
            total_records += count
            logger.debug("Loaded %d records. Total: %d", count, total_records)

    def _apply_logic(
        self, node: Node, batch: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Static logic application (placeholder for TransformRegistry)."""
        return batch
