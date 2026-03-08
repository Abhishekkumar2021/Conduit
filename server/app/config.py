"""
Conduit Server — Application configuration.

All config comes from environment variables. No hardcoded secrets.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    app_name: str = "Conduit"
    debug: bool = False
    secret_key: str = ""  # MUST be set via env var in production

    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "conduit"
    db_password: str = "conduit123"
    db_name: str = "conduit"

    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    # Auth
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 hours

    # Server
    api_port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_prefix": "CONDUIT_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
