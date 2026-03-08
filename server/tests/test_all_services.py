"""
Comprehensive service-layer tests for Conduit Server.

Covers: PipelineService, IntegrationService, RunService, WorkspaceService, UserService
"""

from contextlib import contextmanager

import pytest

from app.infra.database.repositories.asset import AssetRepository
from app.infra.database.repositories.integration import IntegrationRepository
from app.infra.database.repositories.pipeline import (
    EdgeRepository,
    PipelineRepository,
    RevisionRepository,
    StageRepository,
)
from app.infra.database.repositories.run import RunRepository, StepRepository
from app.infra.database.repositories.user import UserRepository
from app.infra.database.repositories.workspace import WorkspaceRepository
from app.infra.database.repositories.member import MemberRepository
from app.services.integration import IntegrationService
from app.services.pipeline import PipelineService
from app.services.run import RunService
from app.services.user import UserService
from app.services.vault import VaultService
from app.services.workspace import WorkspaceService
from conduit.engine.contracts import validate_run_claim_payload


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _create_user(session, email="svc@test.com"):
    repo = UserRepository(session)
    return await repo.create({"email": email, "display_name": "Test User"})


async def _create_workspace(session, user_id, name="Test WS", slug="test-ws"):
    repo = WorkspaceRepository(session)
    return await repo.create({"name": name, "slug": slug, "created_by": user_id})


def _make_pipeline_service(session):
    return PipelineService(
        PipelineRepository(session),
        RevisionRepository(session),
        StageRepository(session),
        EdgeRepository(session),
    )


def _make_integration_service(session):
    return IntegrationService(
        IntegrationRepository(session),
        AssetRepository(session),
        VaultService(),
    )


def _make_run_service(session):
    return RunService(
        RunRepository(session),
        StepRepository(session),
        VaultService(),
    )


def _make_workspace_service(session):
    return WorkspaceService(
        WorkspaceRepository(session),
        MemberRepository(session),
    )


def _make_user_service(session):
    return UserService(
        UserRepository(session),
    )


# ── UserService ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_user_service_create(db_session):
    svc = _make_user_service(db_session)
    user = await svc.get_or_create_github_user(
        github_id="gh_svc_001", email="usvc@test.com", name="Test"
    )
    assert user.id is not None
    assert user.email == "usvc@test.com"


@pytest.mark.asyncio
async def test_user_service_idempotent(db_session):
    svc = _make_user_service(db_session)
    u1 = await svc.get_or_create_github_user(
        github_id="gh_idem", email="idem@test.com", name="Idem"
    )
    u2 = await svc.get_or_create_github_user(
        github_id="gh_idem", email="idem@test.com", name="Idem"
    )
    assert u1.id == u2.id


# ── WorkspaceService ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_workspace_service_create(db_session):
    user = await _create_user(db_session, "ws_svc@test.com")
    svc = _make_workspace_service(db_session)
    ws = await svc.create_workspace(name="WS1", slug="ws1", owner_id=user.id)
    assert ws.id is not None
    assert ws.name == "WS1"


@pytest.mark.asyncio
async def test_workspace_service_list(db_session):
    user = await _create_user(db_session, "ws_list@test.com")
    svc = _make_workspace_service(db_session)
    await svc.create_workspace(name="WS-A", slug="ws-a", owner_id=user.id)
    await svc.create_workspace(name="WS-B", slug="ws-b", owner_id=user.id)
    workspaces = await svc.get_user_workspaces(user.id)
    assert len(workspaces) >= 2


@pytest.mark.asyncio
async def test_workspace_service_get(db_session):
    user = await _create_user(db_session, "ws_get@test.com")
    svc = _make_workspace_service(db_session)
    ws = await svc.create_workspace(name="WS-Get", slug="ws-get", owner_id=user.id)
    fetched = await svc.get_workspace(ws.id)
    assert fetched is not None
    assert fetched.slug == "ws-get"


@pytest.mark.asyncio
async def test_workspace_service_get_not_found(db_session):
    import uuid

    svc = _make_workspace_service(db_session)
    fetched = await svc.get_workspace(uuid.uuid4())
    assert fetched is None


# ── PipelineService ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pipeline_service_create(db_session):
    user = await _create_user(db_session, "pipe_create@test.com")
    ws = await _create_workspace(db_session, user.id, "Pipe WS", "pipe-ws")
    svc = _make_pipeline_service(db_session)

    pipe = await svc.create_pipeline(workspace_id=ws.id, name="My Pipeline")
    assert pipe.id is not None
    assert pipe.name == "My Pipeline"


@pytest.mark.asyncio
async def test_pipeline_service_get(db_session):
    user = await _create_user(db_session, "pipe_get@test.com")
    ws = await _create_workspace(db_session, user.id, "PG WS", "pg-ws")
    svc = _make_pipeline_service(db_session)

    pipe = await svc.create_pipeline(workspace_id=ws.id, name="Get Pipe")
    fetched = await svc.get_pipeline(pipe.id)
    assert fetched is not None
    assert fetched.name == "Get Pipe"


@pytest.mark.asyncio
async def test_pipeline_service_get_not_found(db_session):
    import uuid

    svc = _make_pipeline_service(db_session)
    fetched = await svc.get_pipeline(uuid.uuid4())
    assert fetched is None


@pytest.mark.asyncio
async def test_pipeline_service_list_workspace(db_session):
    user = await _create_user(db_session, "pipe_list@test.com")
    ws = await _create_workspace(db_session, user.id, "PL WS", "pl-ws")
    svc = _make_pipeline_service(db_session)

    await svc.create_pipeline(workspace_id=ws.id, name="P1")
    await svc.create_pipeline(workspace_id=ws.id, name="P2")
    pipelines = await svc.get_workspace_pipelines(ws.id)
    assert len(pipelines) == 2


@pytest.mark.asyncio
async def test_pipeline_service_revision_with_stages_and_edges(db_session):
    user = await _create_user(db_session, "pipe_rev@test.com")
    ws = await _create_workspace(db_session, user.id, "PR WS", "pr-ws")
    svc = _make_pipeline_service(db_session)

    pipe = await svc.create_pipeline(workspace_id=ws.id, name="Rev Pipe")

    stages = [
        {
            "key": "s1",
            "label": "Extract",
            "kind": "extract",
            "config": {},
            "position_x": 100,
            "position_y": 200,
        },
        {
            "key": "s2",
            "label": "Load",
            "kind": "load",
            "config": {},
            "position_x": 400,
            "position_y": 200,
        },
    ]
    edges = [{"source_key": "s1", "target_key": "s2"}]

    rev = await svc.create_revision(
        pipeline_id=pipe.id,
        number=1,
        summary="First revision",
        stages=stages,
        edges=edges,
    )

    assert rev.id is not None
    assert rev.number == 1
    assert rev.summary == "First revision"
    assert len(rev.stages) == 2
    assert len(rev.edges) == 1


@pytest.mark.asyncio
async def test_pipeline_service_revision_no_edges(db_session):
    user = await _create_user(db_session, "pipe_noedge@test.com")
    ws = await _create_workspace(db_session, user.id, "NE WS", "ne-ws")
    svc = _make_pipeline_service(db_session)

    pipe = await svc.create_pipeline(workspace_id=ws.id, name="No Edge Pipe")

    stages = [
        {"key": "s1", "label": "Solo", "kind": "extract", "config": {}},
    ]
    rev = await svc.create_revision(
        pipeline_id=pipe.id,
        number=1,
        summary="Solo stage",
        stages=stages,
        edges=[],
    )

    assert len(rev.stages) == 1
    assert len(rev.edges) == 0


@pytest.mark.asyncio
async def test_pipeline_service_get_revisions(db_session):
    user = await _create_user(db_session, "pipe_getrev@test.com")
    ws = await _create_workspace(db_session, user.id, "GR WS", "gr-ws")
    svc = _make_pipeline_service(db_session)

    pipe = await svc.create_pipeline(workspace_id=ws.id, name="Multi Rev Pipe")

    await svc.create_revision(
        pipeline_id=pipe.id,
        number=1,
        summary="v1",
        stages=[{"key": "a", "label": "A", "kind": "extract", "config": {}}],
        edges=[],
    )
    await svc.create_revision(
        pipeline_id=pipe.id,
        number=2,
        summary="v2",
        stages=[{"key": "b", "label": "B", "kind": "load", "config": {}}],
        edges=[],
    )

    revisions = await svc.get_pipeline_revisions(pipe.id)
    assert len(revisions) == 2
    # Newest first
    assert revisions[0].number == 2
    assert revisions[1].number == 1


@pytest.mark.asyncio
async def test_pipeline_service_publish_revision(db_session):
    user = await _create_user(db_session, "pipe_publish@test.com")
    ws = await _create_workspace(db_session, user.id, "PP WS", "pp-ws")
    svc = _make_pipeline_service(db_session)

    pipe = await svc.create_pipeline(workspace_id=ws.id, name="Publish Pipe")
    rev = await svc.create_revision(
        pipeline_id=pipe.id,
        number=1,
        summary="ready",
        stages=[{"key": "a", "label": "A", "kind": "extract", "config": {}}],
        edges=[],
    )

    published = await svc.publish_revision(pipe.id, rev.id)
    assert published.published_revision_id == rev.id
    assert published.status == "active"


@pytest.mark.asyncio
async def test_pipeline_service_revision_with_integration_id(db_session):
    user = await _create_user(db_session, "pipe_integ@test.com")
    ws = await _create_workspace(db_session, user.id, "PI WS", "pi-ws")
    svc = _make_pipeline_service(db_session)

    # Create an integration to reference
    int_svc = _make_integration_service(db_session)
    integ = await int_svc.register_integration(
        workspace_id=ws.id,
        name="PG Source",
        adapter_type="postgresql",
        config={"host": "localhost"},
    )

    pipe = await svc.create_pipeline(workspace_id=ws.id, name="Integ Pipe")

    stages = [
        {
            "key": "src",
            "label": "Postgres Source",
            "kind": "extract",
            "config": {"query": "SELECT *"},
            "integration_id": str(integ.id),
            "position_x": 0,
            "position_y": 0,
        },
    ]
    rev = await svc.create_revision(
        pipeline_id=pipe.id,
        number=1,
        summary="With integration",
        stages=stages,
        edges=[],
    )
    assert len(rev.stages) == 1


# ── IntegrationService ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_integration_service_register(db_session):
    user = await _create_user(db_session, "int_reg@test.com")
    ws = await _create_workspace(db_session, user.id, "Int WS", "int-ws")
    svc = _make_integration_service(db_session)

    integ = await svc.register_integration(
        workspace_id=ws.id,
        name="Snowflake",
        adapter_type="snowflake",
        config={"account": "abc12345"},
    )
    assert integ.id is not None
    assert integ.adapter_type == "snowflake"


@pytest.mark.asyncio
async def test_integration_service_list(db_session):
    user = await _create_user(db_session, "int_list@test.com")
    ws = await _create_workspace(db_session, user.id, "IL WS", "il-ws")
    svc = _make_integration_service(db_session)

    await svc.register_integration(
        workspace_id=ws.id,
        name="PG1",
        adapter_type="postgresql",
        config={},
    )
    await svc.register_integration(
        workspace_id=ws.id,
        name="SF1",
        adapter_type="salesforce",
        config={},
    )

    integrations = await svc.get_workspace_integrations(ws.id)
    assert len(integrations) == 2


@pytest.mark.asyncio
async def test_integration_service_sync_assets_salesforce_collection(
    db_session, monkeypatch
):
    from conduit.engine.adapters.registry import AdapterRegistry

    user = await _create_user(db_session, "int_sf_sync@test.com")
    ws = await _create_workspace(db_session, user.id, "SF Sync WS", "sf-sync-ws")
    svc = _make_integration_service(db_session)

    integ = await svc.register_integration(
        workspace_id=ws.id,
        name="SF Source",
        adapter_type="salesforce",
        config={
            "instance_url": "https://test.salesforce.com",
            "username": "sf-user@example.com",
        },
    )

    class FakeSalesforceAdapter:
        @contextmanager
        def session(self):
            yield self

        def discover(self):
            return [
                {"qualified_name": "Account", "asset_type": "collection"},
                {"qualified_name": "Contact", "asset_type": "collection"},
            ]

    monkeypatch.setattr(
        AdapterRegistry,
        "create",
        classmethod(lambda cls, adapter_type, config: FakeSalesforceAdapter()),
    )

    synced = await svc.sync_assets(integ.id)
    assert synced.status == "healthy"
    assert "Successfully synced 2 assets" in (synced.status_message or "")

    assets = await svc.asset_repo.get_by_integration(integ.id)
    assert len(assets) == 2
    assert {a.asset_type for a in assets} == {"collection"}


# ── RunService ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_service_initialize(db_session):
    user = await _create_user(db_session, "run_init@test.com")
    ws = await _create_workspace(db_session, user.id, "Run WS", "run-ws")

    p_repo = PipelineRepository(db_session)
    pipe = await p_repo.create({"workspace_id": ws.id, "name": "Run Pipe"})
    r_repo = RevisionRepository(db_session)
    rev = await r_repo.create({"pipeline_id": pipe.id, "number": 1})

    svc = _make_run_service(db_session)
    run = await svc.initialize_run(
        workspace_id=ws.id,
        pipeline_id=pipe.id,
        revision_id=rev.id,
        trigger_type="manual",
    )
    assert run.id is not None
    assert run.status == "pending"
    assert run.trigger_type == "manual"


@pytest.mark.asyncio
async def test_run_service_log_step(db_session):
    user = await _create_user(db_session, "run_step@test.com")
    ws = await _create_workspace(db_session, user.id, "RS WS", "rs-ws")

    p_repo = PipelineRepository(db_session)
    pipe = await p_repo.create({"workspace_id": ws.id, "name": "Step Pipe"})
    r_repo = RevisionRepository(db_session)
    rev = await r_repo.create({"pipeline_id": pipe.id, "number": 1})

    svc = _make_run_service(db_session)
    run = await svc.initialize_run(
        workspace_id=ws.id,
        pipeline_id=pipe.id,
        revision_id=rev.id,
        trigger_type="manual",
    )

    step = await svc.log_step(
        run_id=run.id,
        stage_key="s1",
        stage_kind="extract",
        status="succeeded",
        checkpoint={"rows": 42},
    )
    assert step.id is not None
    assert step.status == "succeeded"
    assert step.checkpoint == {"rows": 42}


@pytest.mark.asyncio
async def test_run_service_get_runs(db_session):
    user = await _create_user(db_session, "run_list@test.com")
    ws = await _create_workspace(db_session, user.id, "RL WS", "rl-ws")

    p_repo = PipelineRepository(db_session)
    pipe = await p_repo.create({"workspace_id": ws.id, "name": "List Pipe"})
    r_repo = RevisionRepository(db_session)
    rev = await r_repo.create({"pipeline_id": pipe.id, "number": 1})

    svc = _make_run_service(db_session)
    await svc.initialize_run(
        workspace_id=ws.id,
        pipeline_id=pipe.id,
        revision_id=rev.id,
        trigger_type="manual",
    )
    await svc.initialize_run(
        workspace_id=ws.id,
        pipeline_id=pipe.id,
        revision_id=rev.id,
        trigger_type="schedule",
    )

    runs = await svc.get_pipeline_runs(pipe.id)
    assert len(runs) == 2


@pytest.mark.asyncio
async def test_run_service_update_status(db_session):
    user = await _create_user(db_session, "run_upd@test.com")
    ws = await _create_workspace(db_session, user.id, "RU WS", "ru-ws")

    p_repo = PipelineRepository(db_session)
    pipe = await p_repo.create({"workspace_id": ws.id, "name": "Upd Pipe"})
    r_repo = RevisionRepository(db_session)
    rev = await r_repo.create({"pipeline_id": pipe.id, "number": 1})

    svc = _make_run_service(db_session)
    run = await svc.initialize_run(
        workspace_id=ws.id,
        pipeline_id=pipe.id,
        revision_id=rev.id,
        trigger_type="manual",
    )

    updated = await svc.update_run_status(run.id, "running")
    assert updated.status == "running"

    finished = await svc.update_run_status(run.id, "succeeded")
    assert finished.status == "succeeded"


@pytest.mark.asyncio
async def test_run_service_claim_pending_run(db_session):
    user = await _create_user(db_session, "claim@test.com")
    ws = await _create_workspace(db_session, user.id, "Claim WS", "claim-ws")

    p_repo = PipelineRepository(db_session)
    pipe = await p_repo.create({"workspace_id": ws.id, "name": "Claim Pipe"})
    r_repo = RevisionRepository(db_session)
    rev = await r_repo.create({"pipeline_id": pipe.id, "number": 1})

    # Add a stage to test parsing
    s_repo = StageRepository(db_session)
    await s_repo.create(
        {
            "revision_id": rev.id,
            "key": "c1",
            "label": "C1",
            "kind": "extract",
            "config": {
                "adapter": "postgresql",
                "integration_id": "123e4567-e89b-12d3-a456-426614174000",
            },
            "position_x": 0,
            "position_y": 0,
        }
    )

    svc = _make_run_service(db_session)

    # Claim when none pending
    none_found = await svc.claim_pending_run()
    assert none_found is None

    run = await svc.initialize_run(
        workspace_id=ws.id,
        pipeline_id=pipe.id,
        revision_id=rev.id,
        trigger_type="manual",
    )

    claimed = await svc.claim_pending_run()
    assert claimed is not None
    assert claimed["run_id"] == str(run.id)
    assert len(claimed["graph"]["nodes"]) == 1
    # Contract validation for server->runner payload shape
    validate_run_claim_payload(claimed)

    # Second claim should be empty
    second = await svc.claim_pending_run()
    assert second is None


@pytest.mark.asyncio
async def test_run_service_claim_pending_run_contract_payload_details(
    db_session, monkeypatch
):
    secret_env_key = "CONDUIT_TEST_POSTGRES_PASSWORD"
    monkeypatch.setenv(secret_env_key, "super-secret-password")

    user = await _create_user(db_session, "claim_contract@test.com")
    ws = await _create_workspace(
        db_session, user.id, "Claim Contract WS", "claim-contract-ws"
    )

    int_svc = _make_integration_service(db_session)
    integ = await int_svc.register_integration(
        workspace_id=ws.id,
        name="Contract PG",
        adapter_type="postgresql",
        config={
            "host": "localhost",
            "database": "analytics",
            "username": "etl_user",
            "password": secret_env_key,
        },
    )

    pipe_svc = _make_pipeline_service(db_session)
    pipe = await pipe_svc.create_pipeline(workspace_id=ws.id, name="Contract Pipe")
    rev = await pipe_svc.create_revision(
        pipeline_id=pipe.id,
        number=1,
        summary="contract payload",
        stages=[
            {
                "key": "extract_pg",
                "label": "Extract PG",
                "kind": "extract",
                # Intentionally omit integration_id from config to verify DB-column injection.
                "config": {"adapter": "postgresql"},
                "integration_id": str(integ.id),
                "position_x": 0,
                "position_y": 0,
            },
            {
                "key": "load_sink",
                "label": "Load Sink",
                "kind": "load",
                "config": {},
                "position_x": 300,
                "position_y": 0,
            },
        ],
        edges=[{"source_key": "extract_pg", "target_key": "load_sink"}],
    )

    stage_id_by_key = {stage.key: str(stage.id) for stage in rev.stages}

    svc = _make_run_service(db_session)
    run = await svc.initialize_run(
        workspace_id=ws.id,
        pipeline_id=pipe.id,
        revision_id=rev.id,
        trigger_type="manual",
    )

    claimed = await svc.claim_pending_run()
    assert claimed is not None
    assert claimed["run_id"] == str(run.id)
    validate_run_claim_payload(claimed)

    extract_node = claimed["graph"]["nodes"][stage_id_by_key["extract_pg"]]
    assert extract_node["config"]["integration_id"] == str(integ.id)

    expected_edge = {
        "id": str(rev.edges[0].id),
        "source": stage_id_by_key["extract_pg"],
        "target": stage_id_by_key["load_sink"],
    }
    assert claimed["graph"]["edges"] == [expected_edge]

    resolved = claimed["integration_configs"][str(integ.id)]
    assert resolved["password"] == "super-secret-password"
