"""
Tests for conduit.domain.enums — verify all enum values are correct.
"""

from conduit.domain.enums import (
    AdapterCategory,
    AssetType,
    AuthProvider,
    IntegrationStatus,
    MemberRole,
    PipelineStatus,
    QuarantineResolution,
    RunnerStatus,
    RunStatus,
    StageKind,
    StepStatus,
    TriggerType,
    VaultStatus,
)


class TestMemberRole:
    def test_values(self):
        assert set(MemberRole) == {"owner", "admin", "editor", "viewer"}

    def test_owner_is_string(self):
        assert MemberRole.OWNER == "owner"
        assert isinstance(MemberRole.OWNER, str)


class TestStageKind:
    def test_values(self):
        assert set(StageKind) == {"extract", "transform", "load", "gate"}


class TestRunStatus:
    def test_terminal_states(self):
        terminal = {RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.CANCELLED}
        assert all(s in RunStatus for s in terminal)

    def test_values(self):
        assert set(RunStatus) == {
            "pending",
            "queued",
            "running",
            "succeeded",
            "failed",
            "cancelled",
        }


class TestStepStatus:
    def test_values(self):
        assert set(StepStatus) == {
            "pending",
            "running",
            "succeeded",
            "failed",
            "skipped",
        }


class TestIntegrationStatus:
    def test_values(self):
        assert set(IntegrationStatus) == {
            "untested",
            "healthy",
            "degraded",
            "unreachable",
        }


class TestVaultStatus:
    def test_values(self):
        assert set(VaultStatus) == {"not_configured", "configured", "error"}


class TestPipelineStatus:
    def test_values(self):
        assert set(PipelineStatus) == {"draft", "active", "paused", "archived"}


class TestAdapterCategory:
    def test_values(self):
        assert set(AdapterCategory) == {"sql", "nosql", "storage", "api"}


class TestAssetType:
    def test_values(self):
        assert set(AssetType) == {"table", "view", "file", "collection", "endpoint"}


class TestAuthProvider:
    def test_values(self):
        assert set(AuthProvider) == {"local", "google", "oidc"}


class TestTriggerType:
    def test_values(self):
        assert set(TriggerType) == {"manual", "schedule", "api"}


class TestQuarantineResolution:
    def test_values(self):
        assert set(QuarantineResolution) == {"pending", "approved", "rejected"}


class TestRunnerStatus:
    def test_values(self):
        assert set(RunnerStatus) == {"online", "busy", "offline"}
