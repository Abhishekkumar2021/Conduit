"""Tests for conduit.runner.cli."""

from typer.testing import CliRunner

from conduit.runner.cli import app

runner = CliRunner()


def test_start_command_bootstraps_daemon(monkeypatch):
    calls: dict[str, object] = {"api_url": None, "started": False}

    class FakeDaemon:
        def __init__(self, api_url: str):
            calls["api_url"] = api_url

        def start(self):
            calls["started"] = True

    monkeypatch.setattr("conduit.runner.main.RunnerDaemon", FakeDaemon)
    result = runner.invoke(app, ["start", "--api-url", "http://api.test/v1"])

    assert result.exit_code == 0
    assert "Starting Conduit Runner..." in result.output
    assert calls["api_url"] == "http://api.test/v1"
    assert calls["started"] is True


def test_stop_and_status_commands():
    stop_result = runner.invoke(app, ["stop"])
    status_result = runner.invoke(app, ["status"])

    assert stop_result.exit_code == 0
    assert "Stopping runner..." in stop_result.output

    assert status_result.exit_code == 0
    assert "Runner status: offline" in status_result.output


def test_vault_commands():
    add_result = runner.invoke(app, ["vault", "add", "postgres-src"])
    list_result = runner.invoke(app, ["vault", "list"])
    test_result = runner.invoke(app, ["vault", "test", "postgres-src"])
    remove_result = runner.invoke(app, ["vault", "remove", "postgres-src"])

    assert add_result.exit_code == 0
    assert "Configuring credentials for: postgres-src" in add_result.output

    assert list_result.exit_code == 0
    assert "Configured integrations:" in list_result.output

    assert test_result.exit_code == 0
    assert "Testing connection: postgres-src" in test_result.output

    assert remove_result.exit_code == 0
    assert "Removing credentials for: postgres-src" in remove_result.output
