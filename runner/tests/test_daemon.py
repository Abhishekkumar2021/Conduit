from unittest.mock import MagicMock

from conduit.runner.main import RunnerDaemon


class _Response:
    def __init__(self, data: dict, status_code: int = 200):
        self._data = data
        self.status_code = status_code

    def raise_for_status(self):
        return None

    def json(self):
        return self._data


def test_poll_once_marks_run_failed_on_invalid_claim_payload():
    daemon = RunnerDaemon(api_url="http://test")
    daemon.client = MagicMock()
    daemon.client.post.return_value = _Response(
        {
            # invalid: missing required top-level fields and graph shape
            "run_id": "run-123",
            "graph": {"nodes": {}, "edges": []},
        }
    )
    daemon._update_status = MagicMock()
    daemon._execute_run = MagicMock()

    daemon._poll_once()

    daemon._execute_run.assert_not_called()
    daemon._update_status.assert_called_once()
    args, kwargs = daemon._update_status.call_args
    assert args[0] == "run-123"
    assert args[1] == "failed"
    assert "Invalid claim payload" in args[2]
