"""Tests for conduit.domain.events and conduit.domain.protocols."""

from datetime import datetime, timezone
from uuid import uuid4

from conduit.domain import protocols
from conduit.domain.events import (
    DomainEvent,
    IntegrationCreated,
    IntegrationTested,
    PipelineCreated,
    RecordsQuarantined,
    RevisionPublished,
    RunCompleted,
    RunStarted,
    StepCompleted,
)


def test_domain_event_default_timestamp_is_timezone_aware():
    ev = DomainEvent()
    assert isinstance(ev.occurred_at, datetime)
    assert ev.occurred_at.tzinfo is not None


def test_integration_events_fields():
    workspace_id = uuid4()
    integration_id = uuid4()

    created = IntegrationCreated(
        workspace_id=workspace_id,
        integration_id=integration_id,
        adapter_type="postgresql",
    )
    assert created.workspace_id == workspace_id
    assert created.integration_id == integration_id
    assert created.adapter_type == "postgresql"

    tested = IntegrationTested(
        integration_id=integration_id, status="healthy", latency_ms=125
    )
    assert tested.status == "healthy"
    assert tested.latency_ms == 125


def test_pipeline_and_revision_events_fields():
    workspace_id = uuid4()
    pipeline_id = uuid4()
    revision_id = uuid4()

    created = PipelineCreated(workspace_id=workspace_id, pipeline_id=pipeline_id)
    assert created.workspace_id == workspace_id
    assert created.pipeline_id == pipeline_id

    published = RevisionPublished(
        pipeline_id=pipeline_id, revision_id=revision_id, revision_number=3
    )
    assert published.revision_id == revision_id
    assert published.revision_number == 3


def test_run_and_quality_events_fields():
    run_id = uuid4()
    pipeline_id = uuid4()
    runner_id = uuid4()

    started = RunStarted(run_id=run_id, pipeline_id=pipeline_id, runner_id=runner_id)
    assert started.runner_id == runner_id

    completed = RunCompleted(run_id=run_id, status="succeeded", duration_ms=987)
    assert completed.status == "succeeded"
    assert completed.duration_ms == 987

    step = StepCompleted(
        run_id=run_id,
        stage_key="extract_users",
        status="succeeded",
        records_in=100,
        records_out=98,
        records_failed=2,
    )
    assert step.stage_key == "extract_users"
    assert step.records_failed == 2

    quarantined = RecordsQuarantined(
        run_id=run_id,
        pipeline_id=pipeline_id,
        count=2,
        occurred_at=datetime.now(timezone.utc),
    )
    assert quarantined.count == 2


def test_protocols_module_exports_expected_protocols():
    assert hasattr(protocols, "UserRepository")
    assert hasattr(protocols, "WorkspaceRepository")
    assert hasattr(protocols, "IntegrationRepository")
    assert hasattr(protocols, "PipelineRepository")
    assert hasattr(protocols, "RevisionRepository")
    assert hasattr(protocols, "RunRepository")
    assert hasattr(protocols, "StepRepository")
    assert hasattr(protocols, "EventBus")
