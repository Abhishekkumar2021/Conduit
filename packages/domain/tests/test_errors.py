"""Tests for conduit.domain.errors."""

from conduit.domain.errors import (
    AuthError,
    ConduitError,
    ConnectionTestError,
    DagCycleError,
    DagDisconnectedError,
    DuplicateError,
    NotFoundError,
    PermissionDeniedError,
    RunError,
    ValidationError,
)


def test_base_conduit_error_fields():
    err = ConduitError("boom")
    assert err.message == "boom"
    assert err.code == "CONDUIT_ERROR"
    assert str(err) == "boom"


def test_not_found_error_fields():
    err = NotFoundError("Pipeline", "pipe-1")
    assert err.code == "NOT_FOUND"
    assert err.entity == "Pipeline"
    assert err.identifier == "pipe-1"
    assert "Pipeline not found: pipe-1" in str(err)


def test_validation_and_duplicate_errors():
    v_err = ValidationError("bad field", field="name")
    assert v_err.code == "VALIDATION_ERROR"
    assert v_err.field == "name"

    d_err = DuplicateError("Workspace", "slug-1")
    assert d_err.code == "DUPLICATE"
    assert "Workspace already exists: slug-1" in str(d_err)


def test_dag_errors_have_expected_messages():
    cycle = DagCycleError()
    assert cycle.field == "edges"
    assert cycle.code == "VALIDATION_ERROR"

    disconnected = DagDisconnectedError(["extract", "load"])
    assert disconnected.field == "stages"
    assert "extract, load" in str(disconnected)


def test_auth_and_permission_errors():
    auth_default = AuthError()
    assert auth_default.code == "AUTH_ERROR"
    assert str(auth_default) == "Authentication required"

    auth_custom = AuthError("Token expired")
    assert str(auth_custom) == "Token expired"

    denied = PermissionDeniedError("publish_revision")
    assert denied.code == "PERMISSION_DENIED"
    assert "publish_revision" in str(denied)


def test_connection_and_run_errors():
    conn = ConnectionTestError("salesforce", "bad credentials")
    assert conn.code == "CONNECTION_TEST_FAILED"
    assert "salesforce" in str(conn)

    run = RunError("run-1", "step failed")
    assert run.code == "RUN_ERROR"
    assert run.run_id == "run-1"
    assert str(run) == "step failed"
