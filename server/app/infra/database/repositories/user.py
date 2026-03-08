from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.models import User
from app.infra.database.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User model."""

    def __init__(self, session: AsyncSession):
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> User | None:
        """Get a user by email."""
        stmt = select(self.model).where(self.model.email == email)
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_by_auth_provider_id(
        self, auth_provider: str, auth_provider_id: str
    ) -> User | None:
        """Get a user by provider ID."""
        stmt = select(self.model).where(
            self.model.auth_provider == auth_provider,
            self.model.auth_provider_id == auth_provider_id,
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()
