"""
Conduit Engine — Local execution runner for pipeline graphs.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Generator, List, Optional

from conduit.engine.adapters.registry import AdapterRegistry
from conduit.engine.core.graph import Graph, Node
from conduit.engine.processors.registry import ProcessorRegistry
from conduit.engine.quality.scorer import QualityScorer

logger = logging.getLogger(__name__)

DataStream = Generator[List[Dict[str, Any]], None, None]


@dataclass
class StepResult:
    """Execution result for a single pipeline node."""

    id: str
    kind: str
    status: str = "pending"
    records_in: int = 0
    records_out: int = 0
    records_failed: int = 0
    duration_ms: int = 0
    error_message: str | None = None


@dataclass
class RunResult:
    """Full execution result for a pipeline run."""

    status: str = "success"
    steps: list[StepResult] = field(default_factory=list)
    quarantined: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "steps": [
                {
                    "id": s.id,
                    "kind": s.kind,
                    "status": s.status,
                    "records_in": s.records_in,
                    "records_out": s.records_out,
                    "records_failed": s.records_failed,
                    "duration_ms": s.duration_ms,
                    "error_message": s.error_message,
                }
                for s in self.steps
            ],
            "quarantined_count": len(self.quarantined),
        }


class LocalRunner:
    """
    Executes a pipeline graph on the local machine.

    Orchestrates extract → transform/processor → gate → load in topological order.
    All adapter I/O is synchronous (generators). The runner itself is synchronous.
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

        ProcessorRegistry.discover()

    def run(self) -> Dict[str, Any]:
        """Execute the graph in topological order. Returns a result dict."""
        logger.info("Starting pipeline execution", extra={"run_id": self.run_id})

        order = self.graph.topological_sort()
        result = RunResult()

        try:
            for node_id in order:
                node = self.graph.nodes[node_id]
                step = self._execute_node(node)
                result.steps.append(step)

                if step.status == "failed":
                    result.status = "failed"
                    break

                if step.kind == "gate":
                    result.quarantined.extend(
                        self._last_quarantined.get(node_id, [])
                    )

        except Exception as exc:
            logger.exception(
                "Execution failed at node %s", node_id,
                extra={"run_id": self.run_id},
            )
            result.status = "failed"
            result.steps.append(
                StepResult(
                    id=node_id,
                    kind=self.graph.nodes[node_id].kind,
                    status="failed",
                    error_message=str(exc),
                )
            )
            raise
        finally:
            self._cleanup_sessions()

        if result.status != "failed":
            result.status = "succeeded"

        return result.to_dict()

    def _execute_node(self, node: Node) -> StepResult:
        """Execute a single node and return its step result."""
        start = time.monotonic()
        step = StepResult(id=node.id, kind=node.kind)

        base_kind = node.kind.split("_")[-1]

        try:
            if base_kind == "extract":
                self._handle_extract(node)
            elif base_kind in ("transform", "processor"):
                self._handle_transform(node)
            elif base_kind == "gate":
                self._handle_gate(node)
            elif base_kind == "load":
                records_written = self._handle_load(node)
                step.records_out = records_written
            else:
                raise ValueError(
                    f"Unknown node kind '{node.kind}' for node '{node.label}'"
                )

            step.status = "succeeded"

        except Exception as exc:
            step.status = "failed"
            step.error_message = str(exc)
            logger.error(
                "Node %s (%s) failed: %s", node.id, node.label, exc,
                extra={"run_id": self.run_id},
            )
            raise

        finally:
            step.duration_ms = int((time.monotonic() - start) * 1000)

        logger.info(
            "Node %s completed in %dms", node.label, step.duration_ms,
            extra={"run_id": self.run_id},
        )
        return step

    def _cleanup_sessions(self) -> None:
        """Close all adapters that were opened during the run."""
        for sess in reversed(self._active_sessions):
            try:
                sess.__exit__(None, None, None)
            except Exception:
                logger.exception("Error closing adapter session")
        self._active_sessions.clear()

    def _resolve_adapter_type(self, node: Node) -> str:
        """Determine the adapter type for a data node."""
        if node.config.get("adapter_type"):
            return node.config["adapter_type"]
        parts = node.kind.split("_")
        if len(parts) > 1 and parts[-1] in ("extract", "load"):
            return parts[0]
        raise ValueError(
            f"Node '{node.label}' has no adapter_type in config and kind "
            f"'{node.kind}' is not in 'adapter_kind' format"
        )

    def _handle_extract(self, node: Node) -> None:
        """Initialize a source stream from an adapter."""
        if not node.integration_id:
            raise ValueError(f"Extract node '{node.label}' missing integration_id")

        config = self.configs.get(node.integration_id, {})
        adapter_type = self._resolve_adapter_type(node)
        adapter = AdapterRegistry.create(adapter_type, config)

        sess = adapter.session()
        sess.__enter__()
        self._active_sessions.append(sess)

        asset = node.config.get("asset")
        if not asset:
            raise ValueError(f"Extract node '{node.label}' missing asset in config")

        stream = adapter.read(asset, **node.config.get("options", {}))
        self._streams[node.id] = stream

    def _handle_transform(self, node: Node) -> None:
        """Apply a processor to the input stream."""
        if not node.inputs:
            raise ValueError(f"Transform node '{node.label}' has no inputs")

        input_stream = self._get_input_stream(node)
        processor_type = node.config.get("processor_type") or node.kind.split("_")[0]

        proc = ProcessorRegistry.create(processor_type, node.config)
        proc.validate_config()

        def transform_wrapper(upstream: DataStream) -> DataStream:
            for batch in upstream:
                result = proc.process(batch)
                logger.debug(
                    "Processor '%s': %d → %d records",
                    processor_type, len(batch), len(result),
                )
                yield result

        self._streams[node.id] = transform_wrapper(input_stream)

    def _handle_gate(self, node: Node) -> None:
        """Score records against quality rules; pass good records, quarantine bad ones."""
        if not node.inputs:
            raise ValueError(f"Gate node '{node.label}' has no inputs")

        input_stream = self._get_input_stream(node)

        rules = node.config.get("rules", [])
        threshold = node.config.get("pass_threshold", 70)
        scorer = QualityScorer(rules=rules, pass_threshold=threshold)

        if not hasattr(self, "_last_quarantined"):
            self._last_quarantined: Dict[str, list] = {}
        self._last_quarantined[node.id] = []

        def gate_wrapper(upstream: DataStream) -> DataStream:
            for batch in upstream:
                passed, quarantined = scorer.score_batch(batch)
                if quarantined:
                    self._last_quarantined[node.id].extend(
                        [q.record for q in quarantined]
                    )
                    logger.info(
                        "Gate '%s': %d passed, %d quarantined",
                        node.label, len(passed), len(quarantined),
                    )
                yield passed

        self._streams[node.id] = gate_wrapper(input_stream)

    def _handle_load(self, node: Node) -> int:
        """Consume input streams into a target adapter. Returns total records written."""
        if not node.inputs:
            raise ValueError(f"Load node '{node.label}' has no inputs")

        input_stream = self._get_input_stream(node)

        if not node.integration_id:
            raise ValueError(f"Load node '{node.label}' missing integration_id")

        config = self.configs.get(node.integration_id, {})
        adapter_type = self._resolve_adapter_type(node)
        adapter = AdapterRegistry.create(adapter_type, config)

        sess = adapter.session()
        sess.__enter__()
        self._active_sessions.append(sess)

        asset = node.config.get("asset")
        total_records = 0

        for batch in input_stream:
            count = adapter.write(asset, batch, **node.config.get("options", {}))
            total_records += count

        logger.info(
            "Loaded %d records to '%s' via node '%s'",
            total_records, asset, node.label,
        )
        return total_records

    def _get_input_stream(self, node: Node) -> DataStream:
        """Resolve the input stream for a node. Raises if not available."""
        input_node_id = node.inputs[0]
        stream = self._streams.get(input_node_id)
        if stream is None:
            raise ValueError(
                f"Input stream for node '{node.label}' not found "
                f"(expected from node '{input_node_id}')"
            )
        return stream
