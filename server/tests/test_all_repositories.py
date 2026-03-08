from uuid import uuid4

import pytest

from app.infra.database.repositories.asset import AssetEventRepository, AssetRepository
from app.infra.database.repositories.audit_log import AuditLogRepository
from app.infra.database.repositories.integration import IntegrationRepository
from app.infra.database.repositories.pipeline import (
    EdgeRepository,
    PipelineRepository,
    RevisionRepository,
    StageRepository,
)
from app.infra.database.repositories.quarantine import QuarantineRepository
from app.infra.database.repositories.run import RunRepository, StepRepository
from app.infra.database.repositories.runner import RunnerRepository
from app.infra.database.repositories.user import UserRepository
from app.infra.database.repositories.workspace import WorkspaceRepository


@pytest.mark.asyncio
async def test_integration_repository(db_session):
    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        {"email": "int_user@test.com", "display_name": "Int User"}
    )
    ws_repo = WorkspaceRepository(db_session)
    ws = await ws_repo.create({"name": "WS1", "slug": "ws1", "created_by": user.id})

    repo = IntegrationRepository(db_session)
    item = await repo.create(
        {
            "workspace_id": ws.id,
            "name": "Postgres Source",
            "adapter_type": "postgresql",
            "created_by": user.id,
        },
    )
    assert item.id is not None

    fetched = await repo.get_by_workspace(ws.id)
    assert len(fetched) == 1


@pytest.mark.asyncio
async def test_asset_repositories(db_session):
    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        {"email": "asset_user@test.com", "display_name": "Asset User"}
    )
    ws_repo = WorkspaceRepository(db_session)
    ws = await ws_repo.create({"name": "WS2", "slug": "ws2", "created_by": user.id})
    int_repo = IntegrationRepository(db_session)
    integr = await int_repo.create(
        {
            "workspace_id": ws.id,
            "name": "Source",
            "adapter_type": "postgresql",
            "created_by": user.id,
        },
    )

    repo = AssetRepository(db_session)
    asset = await repo.create(
        {
            "integration_id": integr.id,
            "workspace_id": ws.id,
            "qualified_name": "public.users",
            "asset_type": "table",
        },
    )
    assert asset.id is not None

    event_repo = AssetEventRepository(db_session)
    event = await event_repo.create(
        {
            "asset_id": asset.id,
            "event_type": "schema_change",
            "details": {"change": "added column"},
        },
    )
    assert event.id is not None


@pytest.mark.asyncio
async def test_pipeline_repositories(db_session):
    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        {"email": "pipe_user@test.com", "display_name": "Pipe User"}
    )
    ws_repo = WorkspaceRepository(db_session)
    ws = await ws_repo.create({"name": "WS3", "slug": "ws3", "created_by": user.id})

    pipe_repo = PipelineRepository(db_session)
    pipe = await pipe_repo.create({"workspace_id": ws.id, "name": "Pipe 1"})

    rev_repo = RevisionRepository(db_session)
    rev = await rev_repo.create(
        {"pipeline_id": pipe.id, "number": 1, "summary": "Initial"}
    )

    stage_repo = StageRepository(db_session)
    stage = await stage_repo.create(
        {"revision_id": rev.id, "key": "s1", "label": "Extract", "kind": "extract"},
    )

    edge_repo = EdgeRepository(db_session)
    target = await stage_repo.create(
        {"revision_id": rev.id, "key": "s2", "label": "Load", "kind": "load"},
    )
    await edge_repo.create(
        {"revision_id": rev.id, "source_id": stage.id, "target_id": target.id},
    )

    # Coverage for query methods
    pipes = await pipe_repo.get_by_workspace(ws.id)
    assert len(pipes) == 1

    revs = await rev_repo.get_by_pipeline(pipe.id)
    assert len(revs) == 1

    stages = await stage_repo.get_by_revision(rev.id)
    assert len(stages) == 2

    edges = await edge_repo.get_by_revision(rev.id)
    assert len(edges) == 1


@pytest.mark.asyncio
async def test_execution_repositories(db_session):
    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        {"email": "exec_user@test.com", "display_name": "Exec User"}
    )
    ws_repo = WorkspaceRepository(db_session)
    ws = await ws_repo.create({"name": "WS4", "slug": "ws4", "created_by": user.id})

    runner_repo = RunnerRepository(db_session)
    runner = await runner_repo.create(
        {
            "workspace_id": ws.id,
            "name": "Local Runner",
            "status": "online",
            "client_id": str(uuid4()),
        },
    )

    pipe_repo = PipelineRepository(db_session)
    pipe = await pipe_repo.create({"workspace_id": ws.id, "name": "Exec Pipe"})
    rev_repo = RevisionRepository(db_session)
    rev = await rev_repo.create({"pipeline_id": pipe.id, "number": 1})

    run_repo = RunRepository(db_session)
    run = await run_repo.create(
        {
            "workspace_id": ws.id,
            "pipeline_id": pipe.id,
            "revision_id": rev.id,
            "status": "pending",
        },
    )

    step_repo = StepRepository(db_session)
    step = await step_repo.create(
        {
            "run_id": run.id,
            "stage_key": "s1",
            "stage_kind": "extract",
            "status": "running",
        },
    )

    assert runner.id is not None
    assert run.id is not None
    assert step.id is not None


@pytest.mark.asyncio
async def test_quality_and_audit_repositories(db_session):
    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        {"email": "audit_user@test.com", "display_name": "Audit User"}
    )
    ws_repo = WorkspaceRepository(db_session)
    ws = await ws_repo.create({"name": "WS5", "slug": "ws5", "created_by": user.id})
    pipe_repo = PipelineRepository(db_session)
    pipe = await pipe_repo.create({"workspace_id": ws.id, "name": "Q Pipe"})
    rev_repo = RevisionRepository(db_session)
    rev = await rev_repo.create({"pipeline_id": pipe.id, "number": 1})
    run_repo = RunRepository(db_session)
    run = await run_repo.create(
        {"workspace_id": ws.id, "pipeline_id": pipe.id, "revision_id": rev.id},
    )
    step_repo = StepRepository(db_session)
    step = await step_repo.create(
        {"run_id": run.id, "stage_key": "s1", "stage_kind": "extract"}
    )

    q_repo = QuarantineRepository(db_session)
    q = await q_repo.create(
        {
            "workspace_id": ws.id,
            "pipeline_id": pipe.id,
            "run_id": run.id,
            "step_id": step.id,
            "record_data": {"id": 1},
            "quality_score": 50,
            "failed_rules": {"rule1": "failed"},
        },
    )

    audit_repo = AuditLogRepository(db_session)
    log = await audit_repo.create(
        {
            "workspace_id": ws.id,
            "user_id": user.id,
            "action": "create_workspace",
            "entity_type": "workspace",
            "entity_id": ws.id,
        },
    )

    assert q.id is not None
    assert log.id is not None
