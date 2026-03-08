import pytest
from httpx import ASGITransport, AsyncClient

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
