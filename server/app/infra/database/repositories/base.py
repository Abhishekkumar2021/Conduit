"""
Conduit Server — Generic repository base class.

Session is injected at construction time via FastAPI's dependency system.
"""

from typing import Any, Generic, Sequence, Type, TypeVar
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

ModelType = TypeVar("ModelType", bound=DeclarativeBase)


class BaseRepository(Generic[ModelType]):
    """Base repository with common CRUD operations.

    Session is passed once in __init__ (request-scoped via DI),
    not repeated in every method call.
    """

    def __init__(self, model: Type[ModelType], session: AsyncSession):
        self.model = model
        self._session = session

    async def get(self, id: UUID) -> ModelType | None:
        """Get a single record by its primary key."""
        stmt = select(self.model).where(self.model.id == id)
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_all(self, skip: int = 0, limit: int = 100) -> Sequence[ModelType]:
        """Get multiple records with pagination."""
        stmt = select(self.model).offset(skip).limit(limit)
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def create(self, obj_in: dict[str, Any]) -> ModelType:
        """Create a new record."""
        db_obj = self.model(**obj_in)
        self._session.add(db_obj)
        await self._session.flush()
        return db_obj

    async def update(self, id: UUID, obj_in: dict[str, Any]) -> ModelType | None:
        """Update an existing record."""
        stmt = (
            update(self.model)
            .where(self.model.id == id)
            .values(**obj_in)
            .returning(self.model)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def delete(self, id: UUID) -> bool:
        """Delete a record by its primary key."""
        stmt = delete(self.model).where(self.model.id == id)
        result = await self._session.execute(stmt)
        return result.rowcount > 0
