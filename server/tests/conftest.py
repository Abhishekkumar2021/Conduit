import asyncio
import os
import re
from typing import AsyncGenerator

import asyncpg
import pytest
import pytest_asyncio
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.infra.database.models import Base

TEST_DB_URL = os.getenv(
    "CONDUIT_TEST_DB_URL",
    "postgresql+asyncpg://conduit:conduit123@127.0.0.1:5432/conduit_test",
)


def _build_admin_dsn_and_db_name(test_url: str) -> tuple[str, str]:
    parsed = make_url(test_url)
    db_name = parsed.database or ""

    if parsed.get_backend_name() != "postgresql":
        raise ValueError(
            "Server tests require PostgreSQL. Set CONDUIT_TEST_DB_URL to a PostgreSQL DSN."
        )
    if not db_name:
        raise ValueError(
            "CONDUIT_TEST_DB_URL must include a database name for test isolation."
        )
    if not re.fullmatch(r"[A-Za-z0-9_]+", db_name):
        raise ValueError(
            "Test database name must match [A-Za-z0-9_]+ for safe auto-create."
        )

    user = parsed.username or "conduit"
    password = parsed.password or "conduit123"
    host = parsed.host or "127.0.0.1"
    port = parsed.port or 5432
    admin_dsn = f"postgresql://{user}:{password}@{host}:{port}/postgres"
    return admin_dsn, db_name


async def _ensure_test_database_exists(test_url: str) -> None:
    admin_dsn, db_name = _build_admin_dsn_and_db_name(test_url)
    conn = await asyncpg.connect(admin_dsn)
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        await conn.close()


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def engine():
    await _ensure_test_database_exists(TEST_DB_URL)
    test_engine = create_async_engine(TEST_DB_URL, echo=False, pool_pre_ping=True)
    try:
        yield test_engine
    finally:
        await test_engine.dispose()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def prepare_database(engine):
    """Create all tables before tests and drop them after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture()
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional DB session for each test."""
    async with engine.connect() as connection:
        async with connection.begin() as transaction:
            session = AsyncSession(bind=connection, expire_on_commit=False)
            yield session
            await session.close()
            await transaction.rollback()
