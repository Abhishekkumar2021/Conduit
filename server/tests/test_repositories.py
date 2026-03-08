import pytest

from app.infra.database.repositories.user import UserRepository
from app.infra.database.repositories.workspace import WorkspaceRepository


@pytest.mark.asyncio
async def test_user_repository(db_session):
    repo = UserRepository(db_session)
    user = await repo.create(
        {
            "email": "test@conduit.dev",
            "display_name": "Test User",
            "auth_provider": "github",
            "auth_provider_id": "12345",
        },
    )
    assert user.id is not None
    assert user.email == "test@conduit.dev"

    fetched = await repo.get_by_email("test@conduit.dev")
    assert fetched is not None
    assert fetched.id == user.id

    fetched_github = await repo.get_by_auth_provider_id("github", "12345")
    assert fetched_github is not None


@pytest.mark.asyncio
async def test_workspace_repository(db_session):
    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        {"email": "ws_owner@conduit.dev", "display_name": "Owner"}
    )

    repo = WorkspaceRepository(db_session)
    ws = await repo.create(
        {"name": "Test Workspace", "slug": "test-ws", "created_by": user.id}
    )
    assert ws.id is not None

    fetched = await repo.get_by_slug("test-ws")
    assert fetched is not None
    assert fetched.name == "Test Workspace"


@pytest.mark.asyncio
async def test_base_repository_methods(db_session):
    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        {"email": "ws_updater@conduit.dev", "display_name": "Owner"}
    )

    repo = WorkspaceRepository(db_session)
    ws = await repo.create(
        {"name": "Update Me", "slug": "update-me", "created_by": user.id}
    )

    # Update
    updated = await repo.update(ws.id, {"name": "Updated Name"})
    assert updated.name == "Updated Name"

    # Get all
    all_ws = await repo.get_all()
    assert len(all_ws) > 0

    # Delete
    deleted = await repo.delete(ws.id)
    assert deleted is True

    fetched = await repo.get(ws.id)
    assert fetched is None
