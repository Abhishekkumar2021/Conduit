"""
Tests for conduit.domain.entities — verify entity construction and defaults.
"""

from datetime import datetime, timezone
from uuid import UUID

from conduit.domain.entities.integration import Asset, Integration
from conduit.domain.entities.pipeline import Edge, Pipeline, Revision, Stage
from conduit.domain.entities.run import QuarantinedRecord, Run, Step
from conduit.domain.entities.workspace import Member, User, Workspace
from conduit.domain.enums import (
    AssetType,
    IntegrationStatus,
    MemberRole,
    PipelineStatus,
    RunStatus,
    StageKind,
    StepStatus,
    VaultStatus,
)


class TestUser:
    def test_defaults(self):
        user = User(email="test@conduit.io", display_name="Test User")
        assert isinstance(user.id, UUID)
        assert user.email == "test@conduit.io"
        assert user.is_active is True
        assert user.password_hash is None
        assert isinstance(user.created_at, datetime)


class TestWorkspace:
    def test_defaults(self):
        ws = Workspace(name="Test Workspace", slug="test-workspace")
        assert isinstance(ws.id, UUID)
        assert ws.name == "Test Workspace"
        assert ws.slug == "test-workspace"


class TestMember:
    def test_default_role(self):
        member = Member()
        assert member.role == MemberRole.VIEWER


class TestIntegration:
    def test_defaults(self):
        integration = Integration(name="warehouse", adapter_type="postgresql")
        assert integration.vault_status == VaultStatus.NOT_CONFIGURED
        assert integration.status == IntegrationStatus.UNTESTED
        assert integration.deleted_at is None
        assert integration.runner_labels == []


class TestAsset:
    def test_defaults(self):
        asset = Asset(qualified_name="public.orders", asset_type=AssetType.TABLE)
        assert asset.schema_info == {}
        assert asset.contract == {}


class TestPipeline:
    def test_defaults(self):
        pipeline = Pipeline(name="orders-sync")
        assert pipeline.status == PipelineStatus.DRAFT
        assert pipeline.schedule_cron is None
        assert pipeline.schedule_timezone == "UTC"


class TestRevision:
    def test_defaults(self):
        rev = Revision(number=1)
        assert rev.is_published is False
        assert rev.stages == []
        assert rev.edges == []


class TestStage:
    def test_defaults(self):
        stage = Stage(
            key="extract-orders", label="Extract Orders", kind=StageKind.EXTRACT
        )
        assert stage.config == {}
        assert stage.position_x == 0.0


class TestEdge:
    def test_creation(self):
        edge = Edge()
        assert isinstance(edge.id, UUID)
        assert isinstance(edge.source_id, UUID)
        assert isinstance(edge.target_id, UUID)


class TestRun:
    def test_defaults(self):
        run = Run()
        assert run.status == RunStatus.PENDING
        assert run.is_dry_run is False
        assert run.started_at is None
        assert run.duration_ms is None


class TestStep:
    def test_defaults(self):
        step = Step(stage_key="extract-orders", stage_kind="extract")
        assert step.status == StepStatus.PENDING
        assert step.records_in == 0
        assert step.records_out == 0
        assert step.checkpoint is None


class TestQuarantinedRecord:
    def test_defaults(self):
        qr = QuarantinedRecord(
            record_data={"email": None},
            quality_score=30,
            failed_rules=[{"rule": "not_null", "column": "email"}],
        )
        assert qr.resolution == "pending"
        assert qr.quality_score == 30
        assert len(qr.failed_rules) == 1
