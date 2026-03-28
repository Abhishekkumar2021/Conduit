"""
Conduit Server — Application configuration.

All config comes from environment variables with the CONDUIT_ prefix.
"""

import secrets
from functools import cached_property

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    app_name: str = "Conduit"
    debug: bool = False
    secret_key: str = ""

    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "conduit"
    db_password: str = "conduit123"
    db_name: str = "conduit"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    # Auth
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    # Server
    api_port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173"]

    @cached_property
    def effective_secret_key(self) -> str:
        """
        Returns the configured secret key, or generates a random one for dev.
        Logs a warning when falling back to a random key.
        """
        if self.secret_key:
            return self.secret_key
        if not self.debug:
            raise RuntimeError(
                "CONDUIT_SECRET_KEY must be set in production (debug=False). "
                "Set CONDUIT_SECRET_KEY in your environment or .env file."
            )
        import logging

        logging.getLogger(__name__).warning(
            "No CONDUIT_SECRET_KEY set — using random key (sessions won't survive restarts)"
        )
        return secrets.token_urlsafe(32)

    model_config = {"env_prefix": "CONDUIT_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
