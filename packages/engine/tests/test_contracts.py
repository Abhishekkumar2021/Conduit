import pytest

from conduit.engine.contracts import (
    RunClaimPayloadValidationError,
    validate_run_claim_payload,
)


def _valid_payload() -> dict:
    return {
        "run_id": "run-1",
        "pipeline_id": "pipe-1",
        "workspace_id": "ws-1",
        "integration_configs": {
            "int-1": {"host": "localhost", "database": "db1"},
        },
        "graph": {
            "nodes": {
                "n1": {"kind": "extract", "name": "Extract", "config": {}},
                "n2": {
                    "kind": "load",
                    "name": "Load",
                    "config": {"integration_id": "int-1"},
                },
            },
            "edges": [
                {"id": "e1", "source": "n1", "target": "n2"},
            ],
        },
    }


def test_validate_run_claim_payload_valid():
    payload = _valid_payload()
    out = validate_run_claim_payload(payload)
    assert out["run_id"] == "run-1"


def test_validate_run_claim_payload_missing_field():
    payload = _valid_payload()
    del payload["workspace_id"]
    with pytest.raises(
        RunClaimPayloadValidationError, match="'workspace_id' must be a non-empty string"
    ):
        validate_run_claim_payload(payload)


def test_validate_run_claim_payload_rejects_unknown_edge_node():
    payload = _valid_payload()
    payload["graph"]["edges"][0]["target"] = "missing-node"
    with pytest.raises(
        RunClaimPayloadValidationError, match="not found in graph.nodes"
    ):
        validate_run_claim_payload(payload)


def test_validate_run_claim_payload_rejects_bad_integration_configs():
    payload = _valid_payload()
    payload["integration_configs"] = {"int-1": "not-an-object"}
    with pytest.raises(
        RunClaimPayloadValidationError, match="integration_configs.int-1"
    ):
        validate_run_claim_payload(payload)
