"""
Conduit Server — User service.
"""

import logging
from uuid import UUID

from app.infra.database.models import User
from app.infra.database.repositories.user import UserRepository

logger = logging.getLogger(__name__)


class UserService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def get_or_create_github_user(
        self, github_id: str, email: str, name: str
    ) -> User:
        """Get existing user by GitHub ID, or create a new one."""
        user = await self.user_repo.get_by_auth_provider_id("github", github_id)
        if user:
            return user

        user = await self.user_repo.create(
            {
                "email": email,
                "display_name": name,
                "auth_provider": "github",
                "auth_provider_id": github_id,
            },
        )
        logger.info(f"Created new user via GitHub: {email}")
        return user

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        return await self.user_repo.get(user_id)
