"""Runtime validator for server->runner run-claim payloads."""

from __future__ import annotations

from typing import Any


class RunClaimPayloadValidationError(ValueError):
    """Raised when the run-claim payload shape is invalid."""


def _as_dict(value: Any, *, field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise RunClaimPayloadValidationError(f"'{field}' must be an object")
    return value


def _as_str(value: Any, *, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise RunClaimPayloadValidationError(f"'{field}' must be a non-empty string")
    return value


def validate_run_claim_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Validate the run claim payload contract used between server and runner.

    Expected shape:
        {
          "run_id": str,
          "pipeline_id": str,
          "workspace_id": str,
          "integration_configs": {integration_id: {...}},
          "graph": {
            "nodes": {node_id: {"kind": str, "name": str, "config": {...}}},
            "edges": [{"id": str, "source": str, "target": str}]
          }
        }
    """
    root = _as_dict(payload, field="payload")

    _as_str(root.get("run_id"), field="run_id")
    _as_str(root.get("pipeline_id"), field="pipeline_id")
    _as_str(root.get("workspace_id"), field="workspace_id")

    integration_configs = _as_dict(
        root.get("integration_configs", {}), field="integration_configs"
    )
    for integration_id, cfg in integration_configs.items():
        _as_str(integration_id, field="integration_configs.<key>")
        _as_dict(cfg, field=f"integration_configs.{integration_id}")

    graph = _as_dict(root.get("graph"), field="graph")
    nodes = _as_dict(graph.get("nodes"), field="graph.nodes")
    edges = graph.get("edges")
    if not isinstance(edges, list):
        raise RunClaimPayloadValidationError("'graph.edges' must be an array")

    node_ids: set[str] = set()
    for node_id, node in nodes.items():
        _as_str(node_id, field="graph.nodes.<key>")
        node_ids.add(node_id)

        node_obj = _as_dict(node, field=f"graph.nodes.{node_id}")
        _as_str(node_obj.get("kind"), field=f"graph.nodes.{node_id}.kind")
        _as_str(node_obj.get("name"), field=f"graph.nodes.{node_id}.name")
        config = _as_dict(node_obj.get("config", {}), field=f"graph.nodes.{node_id}.config")
        integration_id = config.get("integration_id")
        if integration_id is not None:
            _as_str(
                integration_id, field=f"graph.nodes.{node_id}.config.integration_id"
            )

    for idx, edge in enumerate(edges):
        edge_obj = _as_dict(edge, field=f"graph.edges[{idx}]")
        _as_str(edge_obj.get("id"), field=f"graph.edges[{idx}].id")
        source = _as_str(edge_obj.get("source"), field=f"graph.edges[{idx}].source")
        target = _as_str(edge_obj.get("target"), field=f"graph.edges[{idx}].target")

        if source not in node_ids:
            raise RunClaimPayloadValidationError(
                f"graph.edges[{idx}].source '{source}' not found in graph.nodes"
            )
        if target not in node_ids:
            raise RunClaimPayloadValidationError(
                f"graph.edges[{idx}].target '{target}' not found in graph.nodes"
            )

    return root
