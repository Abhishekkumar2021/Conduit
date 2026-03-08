"""Additional branch tests for conduit.runner.main.RunnerDaemon."""

from __future__ import annotations

from unittest.mock import MagicMock

import httpx
import pytest

from conduit.runner.main import RunnerDaemon


class _Response:
    def __init__(self, data: dict | None = None, status_code: int = 200):
        self._data = data or {}
        self.status_code = status_code

    def raise_for_status(self):
        return None

    def json(self):
        return self._data


def test_poll_once_returns_when_no_pending_runs():
    daemon = RunnerDaemon(api_url="http://test")
    daemon.client = MagicMock()
    daemon.client.post.return_value = _Response(status_code=404)
    daemon._execute_run = MagicMock()
    daemon._update_status = MagicMock()

    daemon._poll_once()

    daemon._execute_run.assert_not_called()
    daemon._update_status.assert_not_called()


def test_poll_once_marks_run_failed_when_execution_raises():
    daemon = RunnerDaemon(api_url="http://test")
    daemon.client = MagicMock()
    daemon.client.post.return_value = _Response(
        {
            "run_id": "run-1",
            "pipeline_id": "pipe-1",
            "workspace_id": "ws-1",
            "integration_configs": {},
            "graph": {
                "nodes": {"n1": {"kind": "extract", "name": "E", "config": {}}},
                "edges": [],
            },
        }
    )
    daemon._execute_run = MagicMock(side_effect=RuntimeError("executor failed"))
    daemon._update_status = MagicMock()

    daemon._poll_once()

    daemon._update_status.assert_called_once()
    args, _ = daemon._update_status.call_args
    assert args[0] == "run-1"
    assert args[1] == "failed"
    assert "executor failed" in args[2]


def test_poll_once_handles_http_errors():
    daemon = RunnerDaemon(api_url="http://test")
    daemon.client = MagicMock()
    request = httpx.Request("POST", "http://test/runs/claim")
    daemon.client.post.side_effect = httpx.ConnectError("down", request=request)
    daemon._update_status = MagicMock()

    daemon._poll_once()
    daemon._update_status.assert_not_called()


def test_execute_run_success_updates_status():
    daemon = RunnerDaemon(api_url="http://test")
    daemon._update_status = MagicMock()

    payload = {
        "workspace_id": "ws-1",
        "integration_configs": {"int-1": {"host": "localhost"}},
        "graph": {
            "nodes": {
                "n1": {
                    "kind": "extract",
                    "name": "Extract",
                    "config": {"integration_id": "int-1"},
                }
            },
            "edges": [],
        },
    }

    mock_runner = MagicMock()
    mock_runner.run.return_value = {"status": "succeeded"}

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("conduit.runner.main.LocalRunner", MagicMock(return_value=mock_runner))
        daemon._execute_run("run-42", payload)

    daemon._update_status.assert_called_once()
    args, kwargs = daemon._update_status.call_args
    assert args[0] == "run-42"
    assert args[1] == "succeeded"
    assert "duration_ms" in kwargs
    assert isinstance(kwargs["duration_ms"], int)


def test_execute_run_rejects_invalid_dag():
    daemon = RunnerDaemon(api_url="http://test")
    payload = {
        "graph": {
            "nodes": {
                "n1": {"kind": "extract", "name": "A", "config": {}},
                "n2": {"kind": "load", "name": "B", "config": {}},
            },
            "edges": [
                {"source": "n1", "target": "n2"},
                {"source": "n2", "target": "n1"},
            ],
        }
    }

    with pytest.raises(ValueError, match="Invalid DAG: Cycle detected"):
        daemon._execute_run("run-cyclic", payload)


def test_update_status_includes_optional_fields():
    daemon = RunnerDaemon(api_url="http://test")
    daemon.client = MagicMock()
    daemon.client.patch.return_value = _Response()

    daemon._update_status(
        "run-1", "failed", error_message="bad data", duration_ms=345
    )

    daemon.client.patch.assert_called_once()
    _, kwargs = daemon.client.patch.call_args
    assert kwargs["json"] == {
        "status": "failed",
        "error_message": "bad data",
        "duration_ms": 345,
    }


def test_update_status_handles_http_error():
    daemon = RunnerDaemon(api_url="http://test")
    daemon.client = MagicMock()
    request = httpx.Request("PATCH", "http://test/runs/r/status")
    daemon.client.patch.side_effect = httpx.ConnectError("down", request=request)

    # Should swallow HTTPError and only log.
    daemon._update_status("run-1", "succeeded")


def test_start_closes_client_on_keyboard_interrupt():
    daemon = RunnerDaemon(api_url="http://test", poll_interval=0)
    daemon.client = MagicMock()
    daemon._poll_once = MagicMock(side_effect=KeyboardInterrupt())

    daemon.start()
    daemon.client.close.assert_called_once()
