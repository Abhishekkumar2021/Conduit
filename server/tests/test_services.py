import pytest

from app.infra.database.repositories.member import MemberRepository
from app.infra.database.repositories.user import UserRepository
from app.infra.database.repositories.workspace import WorkspaceRepository
from app.services.user import UserService
from app.services.workspace import WorkspaceService


@pytest.mark.asyncio
async def test_user_service_get_or_create(db_session):
    service = UserService(UserRepository(db_session))

    # Create
    user1 = await service.get_or_create_github_user(
        github_id="github_1", email="u1@test.com", name="U1"
    )
    assert user1.id is not None

    # Get existing
    user2 = await service.get_or_create_github_user(
        github_id="github_1", email="u1@test.com", name="U1"
    )
    assert user1.id == user2.id

    fetched = await service.get_user_by_id(user1.id)
    assert fetched.id == user1.id


@pytest.mark.asyncio
async def test_workspace_service_creation(db_session):
    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        {
            "email": "owner@conduit.dev",
            "display_name": "Owner",
            "auth_provider_id": "owner",
        },
    )

    service = WorkspaceService(
        WorkspaceRepository(db_session), MemberRepository(db_session)
    )

    ws = await service.create_workspace(
        name="My Workspace", slug="my-ws", owner_id=user.id
    )
    assert ws.id is not None
    assert ws.slug == "my-ws"

    # Verify membership
    memberships = await service.get_user_workspaces(user.id)
    assert len(memberships) == 1
    assert memberships[0].workspace_id == ws.id
    assert memberships[0].role == "owner"

    # Test duplicate slug
    with pytest.raises(ValueError, match="already exists"):
        await service.create_workspace(name="Duplicate", slug="my-ws", owner_id=user.id)

    # get workspace
    fetched = await service.get_workspace(ws.id)
    assert fetched is not None
    assert fetched.id == ws.id
