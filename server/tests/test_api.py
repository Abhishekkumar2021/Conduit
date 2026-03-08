import pytest
from httpx import ASGITransport, AsyncClient
from datetime import datetime, timedelta, timezone

from app.infra.database.session import get_db_session
from app.main import app


@pytest.fixture(autouse=True)
def override_db(db_session):
    """Override the get_db_session dependency with the test session."""

    async def _get_db_session():
        yield db_session

    app.dependency_overrides[get_db_session] = _get_db_session
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_create_and_get_workspace(db_session):
    from app.infra.database.repositories.user import UserRepository

    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        {"email": "api_user@test.com", "display_name": "API User"}
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        # Create workspace
        payload = {"name": "API WS", "slug": "api-ws", "owner_id": str(user.id)}
        response = await ac.post("/api/v1/workspaces/", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "API WS"
        ws_id = data["id"]

        # Get workspace
        response = await ac.get(f"/api/v1/workspaces/{ws_id}")
        assert response.status_code == 200
        assert response.json()["slug"] == "api-ws"

        # List workspaces
        response = await ac.get("/api/v1/workspaces/")
        assert response.status_code == 200
        ids = {w["id"] for w in response.json()}
        assert ws_id in ids


@pytest.mark.asyncio
async def test_get_workspace_not_found():
    import uuid

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get(f"/api/v1/workspaces/{uuid.uuid4()}")
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_pipeline_endpoints(db_session):
    from app.infra.database.repositories.user import UserRepository
    from app.infra.database.repositories.workspace import WorkspaceRepository

    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        {"email": "api_pipe_user@test.com", "display_name": "API User"}
    )
    ws_repo = WorkspaceRepository(db_session)
    ws = await ws_repo.create(
        {"name": "Pipe WS", "slug": "pipe-ws", "created_by": user.id}
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        # Create pipeline
        pipe_payload = {"name": "API Pipe", "description": "Desc"}
        response = await ac.post(
            f"/api/v1/workspaces/{ws.id}/pipelines", json=pipe_payload
        )
        assert response.status_code == 201
        pipe_id = response.json()["id"]

        # Create revision
        rev_payload = {
            "number": 1,
            "summary": "API Rev",
            "stages": [
                {
                    "key": "s1",
                    "label": "S1",
                    "kind": "extract",
                    "position_x": 0,
                    "position_y": 0,
                    "config": {},
                }
            ],
            "edges": [],
        }
        response = await ac.post(
            f"/api/v1/pipelines/{pipe_id}/revisions", json=rev_payload
        )
        assert response.status_code == 201
        assert response.json()["number"] == 1
        rev_id = response.json()["id"]

        # Publish revision
        response = await ac.post(
            f"/api/v1/pipelines/{pipe_id}/revisions/{rev_id}/publish"
        )
        assert response.status_code == 200
        assert response.json()["published_revision_id"] == rev_id


@pytest.mark.asyncio
async def test_get_pipeline_not_found():
    import uuid

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get(f"/api/v1/pipelines/{uuid.uuid4()}")
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_auth_endpoint(db_session):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        payload = {"github_id": "gh_123", "email": "gh@test.com", "name": "GH User"}
        response = await ac.post("/api/v1/auth/oauth/github", json=payload)
        assert response.status_code == 200
        assert "user_id" in response.json()


@pytest.mark.asyncio
async def test_run_endpoints(db_session):
    from app.infra.database.repositories.user import UserRepository
    from app.infra.database.repositories.workspace import WorkspaceRepository
    from app.infra.database.repositories.pipeline import (
        PipelineRepository,
        RevisionRepository,
    )

    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        {"email": "run_api@test.com", "display_name": "API User"}
    )
    ws_repo = WorkspaceRepository(db_session)
    ws = await ws_repo.create(
        {"name": "Run WS", "slug": "run-ws", "created_by": user.id}
    )
    p_repo = PipelineRepository(db_session)
    pipe = await p_repo.create({"workspace_id": ws.id, "name": "API Run Pipe"})
    r_repo = RevisionRepository(db_session)
    rev = await r_repo.create({"pipeline_id": pipe.id, "number": 1})

    await p_repo.update(pipe.id, {"published_revision_id": rev.id})

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        # Trigger
        resp = await ac.post(f"/api/v1/pipelines/{pipe.id}/runs")
        assert resp.status_code == 201
        run_id = resp.json()["id"]

        # List Pipeline
        resp = await ac.get(f"/api/v1/pipelines/{pipe.id}/runs")
        assert resp.status_code == 200

        # List WS
        resp = await ac.get(f"/api/v1/workspaces/{ws.id}/runs")
        assert resp.status_code == 200

        # Claim
        resp = await ac.post("/api/v1/runs/claim")
        assert resp.status_code == 200
        claimed_run_id = resp.json()["run_id"]
        assert claimed_run_id == run_id

        # Update status
        resp = await ac.patch(
            f"/api/v1/runs/{run_id}/status",
            json={"status": "succeeded", "duration_ms": 100},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "succeeded"


@pytest.mark.asyncio
async def test_run_detail_endpoint_returns_steps(db_session):
    import uuid

    from app.infra.database.repositories.user import UserRepository
    from app.infra.database.repositories.workspace import WorkspaceRepository
    from app.infra.database.repositories.pipeline import (
        PipelineRepository,
        RevisionRepository,
    )
    from app.infra.database.repositories.run import RunRepository, StepRepository

    user = await UserRepository(db_session).create(
        {"email": "run_detail_api@test.com", "display_name": "API User"}
    )
    ws = await WorkspaceRepository(db_session).create(
        {"name": "Run Detail WS", "slug": "run-detail-ws", "created_by": user.id}
    )
    pipe = await PipelineRepository(db_session).create(
        {"workspace_id": ws.id, "name": "Run Detail Pipe"}
    )
    rev = await RevisionRepository(db_session).create({"pipeline_id": pipe.id, "number": 1})

    run = await RunRepository(db_session).create(
        {
            "workspace_id": ws.id,
            "pipeline_id": pipe.id,
            "revision_id": rev.id,
            "status": "failed",
            "trigger_type": "manual",
            "error_message": "stage failed",
        }
    )

    step_repo = StepRepository(db_session)
    base_time = datetime.now(timezone.utc)
    await step_repo.create(
        {
            "run_id": run.id,
            "stage_key": "extract_1",
            "stage_kind": "extract",
            "status": "succeeded",
            "records_in": 10,
            "records_out": 10,
            "started_at": base_time,
            "finished_at": base_time + timedelta(seconds=1),
            "duration_ms": 1000,
        }
    )
    await step_repo.create(
        {
            "run_id": run.id,
            "stage_key": "load_1",
            "stage_kind": "load",
            "status": "failed",
            "records_in": 10,
            "records_out": 0,
            "records_failed": 10,
            "started_at": base_time + timedelta(seconds=2),
            "finished_at": base_time + timedelta(seconds=3),
            "duration_ms": 1000,
            "error_message": "target unavailable",
        }
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        resp = await ac.get(f"/api/v1/runs/{run.id}")
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["id"] == str(run.id)
        assert payload["status"] == "failed"
        assert payload["error_message"] == "stage failed"
        assert [s["stage_key"] for s in payload["steps"]] == ["extract_1", "load_1"]
        assert payload["steps"][1]["error_message"] == "target unavailable"

        resp = await ac.get(f"/api/v1/runs/{uuid.uuid4()}")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Run not found"


@pytest.mark.asyncio
async def test_workspace_run_filters_endpoint(db_session):
    from app.infra.database.repositories.user import UserRepository
    from app.infra.database.repositories.workspace import WorkspaceRepository
    from app.infra.database.repositories.pipeline import (
        PipelineRepository,
        RevisionRepository,
    )
    from app.infra.database.repositories.run import RunRepository

    user = await UserRepository(db_session).create(
        {"email": "run_filters_api@test.com", "display_name": "API User"}
    )
    ws = await WorkspaceRepository(db_session).create(
        {"name": "Run Filter WS", "slug": "run-filter-ws", "created_by": user.id}
    )

    p_repo = PipelineRepository(db_session)
    orders_pipe = await p_repo.create({"workspace_id": ws.id, "name": "Orders ETL"})
    billing_pipe = await p_repo.create({"workspace_id": ws.id, "name": "Billing Sync"})
    r_repo = RevisionRepository(db_session)
    orders_rev = await r_repo.create({"pipeline_id": orders_pipe.id, "number": 1})
    billing_rev = await r_repo.create({"pipeline_id": billing_pipe.id, "number": 1})

    run_repo = RunRepository(db_session)
    pending_manual = await run_repo.create(
        {
            "workspace_id": ws.id,
            "pipeline_id": orders_pipe.id,
            "revision_id": orders_rev.id,
            "status": "pending",
            "trigger_type": "manual",
        }
    )
    failed_schedule = await run_repo.create(
        {
            "workspace_id": ws.id,
            "pipeline_id": billing_pipe.id,
            "revision_id": billing_rev.id,
            "status": "failed",
            "trigger_type": "schedule",
        }
    )
    succeeded_api = await run_repo.create(
        {
            "workspace_id": ws.id,
            "pipeline_id": orders_pipe.id,
            "revision_id": orders_rev.id,
            "status": "succeeded",
            "trigger_type": "api",
        }
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        resp = await ac.get(f"/api/v1/workspaces/{ws.id}/runs?status=failed")
        assert resp.status_code == 200
        assert [r["id"] for r in resp.json()] == [str(failed_schedule.id)]

        resp = await ac.get(f"/api/v1/workspaces/{ws.id}/runs?trigger_type=manual")
        assert resp.status_code == 200
        assert [r["id"] for r in resp.json()] == [str(pending_manual.id)]

        resp = await ac.get(f"/api/v1/workspaces/{ws.id}/runs?search=orders")
        assert resp.status_code == 200
        assert {r["id"] for r in resp.json()} == {
            str(pending_manual.id),
            str(succeeded_api.id),
        }

        resp = await ac.get(
            f"/api/v1/workspaces/{ws.id}/runs"
            f"?status=succeeded&trigger_type=api&search={str(succeeded_api.id)[:8]}"
        )
        assert resp.status_code == 200
        assert [r["id"] for r in resp.json()] == [str(succeeded_api.id)]


@pytest.mark.asyncio
async def test_run_endpoints_reject_invalid_status_values():
    import uuid

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        resp = await ac.get(
            f"/api/v1/workspaces/{uuid.uuid4()}/runs?status=not-a-status"
        )
        assert resp.status_code == 422

        resp = await ac.patch(
            f"/api/v1/runs/{uuid.uuid4()}/status",
            json={"status": "not-a-status"},
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_trigger_run_requires_published_revision(db_session):
    from app.infra.database.repositories.user import UserRepository
    from app.infra.database.repositories.workspace import WorkspaceRepository
    from app.infra.database.repositories.pipeline import PipelineRepository

    user = await UserRepository(db_session).create(
        {"email": "run_unpub@test.com", "display_name": "API User"}
    )
    ws = await WorkspaceRepository(db_session).create(
        {"name": "Run Draft WS", "slug": "run-draft-ws", "created_by": user.id}
    )
    pipe = await PipelineRepository(db_session).create(
        {"workspace_id": ws.id, "name": "Draft Pipe"}
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        resp = await ac.post(f"/api/v1/pipelines/{pipe.id}/runs")
        assert resp.status_code == 400
        assert "Publish a revision first" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_claim_run_no_pending_returns_404():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        resp = await ac.post("/api/v1/runs/claim")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_asset_discovery_endpoints(db_session, monkeypatch):
    from app.infra.database.repositories.user import UserRepository
    from app.infra.database.repositories.workspace import WorkspaceRepository
    from app.services.integration import IntegrationService

    user = await UserRepository(db_session).create(
        {"email": "assets@test.com", "display_name": "API User"}
    )
    ws = await WorkspaceRepository(db_session).create(
        {"name": "Asset WS", "slug": "asset-ws", "created_by": user.id}
    )

    # Mock sync_assets to avoid actually connecting to a real DB during testing
    async def mock_sync_assets(self, integration_id):
        integration = await self.integration_repo.get(integration_id)
        await self.asset_repo.upsert_assets(
            integration_id=integration_id,
            workspace_id=ws.id,
            assets_data=[
                {"qualified_name": "public.mock_table", "asset_type": "table"}
            ],
        )
        integration.status = "healthy"
        await self.integration_repo.update(integration.id, {"status": "healthy"})
        return integration

    monkeypatch.setattr(IntegrationService, "sync_assets", mock_sync_assets)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        # Create integration
        payload = {"name": "Mock Source", "adapter_type": "postgresql", "config": {}}
        resp = await ac.post(f"/api/v1/workspaces/{ws.id}/integrations", json=payload)
        assert resp.status_code == 201
        int_id = resp.json()["id"]

        # Discover
        resp = await ac.post(f"/api/v1/integrations/{int_id}/discover")
        assert resp.status_code == 200

        # List assets
        resp = await ac.get(f"/api/v1/integrations/{int_id}/assets")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["qualified_name"] == "public.mock_table"


@pytest.mark.asyncio
async def test_create_integration_invalid_adapter_returns_400(db_session):
    from app.infra.database.repositories.user import UserRepository
    from app.infra.database.repositories.workspace import WorkspaceRepository

    user = await UserRepository(db_session).create(
        {"email": "invalid_adapter@test.com", "display_name": "API User"}
    )
    ws = await WorkspaceRepository(db_session).create(
        {"name": "Invalid Adapter WS", "slug": "invalid-adapter-ws", "created_by": user.id}
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        payload = {"name": "Bad Source", "adapter_type": "pg", "config": {}}
        resp = await ac.post(f"/api/v1/workspaces/{ws.id}/integrations", json=payload)
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_salesforce_asset_discovery_endpoint_persists_collection_assets(
    db_session, monkeypatch
):
    from types import SimpleNamespace
    from app.infra.database.repositories.user import UserRepository
    from app.infra.database.repositories.workspace import WorkspaceRepository
    from app.services.integration import IntegrationService
    from conduit.engine.adapters.registry import AdapterRegistry

    user = await UserRepository(db_session).create(
        {"email": "sf_assets@test.com", "display_name": "API User"}
    )
    ws = await WorkspaceRepository(db_session).create(
        {"name": "SF Asset WS", "slug": "sf-asset-ws", "created_by": user.id}
    )

    original_get = AdapterRegistry.get
    fake_vault_fields = ["instance_url", "username", "password:secret"]

    class FakeSalesforceAdapterClass:
        vault_fields = fake_vault_fields
        meta = SimpleNamespace(type="salesforce", vault_fields=fake_vault_fields)

    monkeypatch.setattr(
        AdapterRegistry,
        "get",
        classmethod(
            lambda cls, adapter_type: (
                FakeSalesforceAdapterClass
                if adapter_type == "salesforce"
                else original_get(adapter_type)
            )
        ),
    )

    async def mock_sync_assets(self, integration_id):
        integration = await self.integration_repo.get(integration_id)
        await self.asset_repo.upsert_assets(
            integration_id=integration_id,
            workspace_id=ws.id,
            assets_data=[
                {"qualified_name": "Account", "asset_type": "collection"},
                {"qualified_name": "Contact", "asset_type": "collection"},
            ],
        )
        integration.status = "healthy"
        await self.integration_repo.update(integration.id, {"status": "healthy"})
        return integration

    monkeypatch.setattr(IntegrationService, "sync_assets", mock_sync_assets)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        payload = {"name": "SF Source", "adapter_type": "salesforce", "config": {}}
        resp = await ac.post(f"/api/v1/workspaces/{ws.id}/integrations", json=payload)
        assert resp.status_code == 201
        int_id = resp.json()["id"]

        resp = await ac.post(f"/api/v1/integrations/{int_id}/discover")
        assert resp.status_code == 200

        resp = await ac.get(f"/api/v1/integrations/{int_id}/assets")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert {a["asset_type"] for a in data} == {"collection"}
