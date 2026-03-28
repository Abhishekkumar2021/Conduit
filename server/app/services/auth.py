"""
Conduit Server — Authentication service.

Handles JWT token creation/validation, user registration, and login.
"""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
from jose import JWTError, jwt

from app.config import settings
from app.infra.database.models import User
from app.infra.database.repositories.user import UserRepository
from conduit.domain.errors import AuthError, DuplicateError, ValidationError

logger = logging.getLogger(__name__)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


class AuthService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def register(self, email: str, password: str, display_name: str) -> User:
        """Register a new local user."""
        existing = await self.user_repo.get_by_email(email)
        if existing:
            raise DuplicateError("User", email)

        if len(password) < 8:
            raise ValidationError(
                "Password must be at least 8 characters", field="password"
            )

        user = await self.user_repo.create(
            {
                "email": email,
                "display_name": display_name,
                "password_hash": _hash_password(password),
                "auth_provider": "local",
            }
        )
        logger.info("Registered new user: %s", email)
        return user

    async def login(self, email: str, password: str) -> tuple[User, str, str]:
        """Authenticate and return (user, access_token, refresh_token)."""
        user = await self.user_repo.get_by_email(email)
        if not user or not user.password_hash:
            raise AuthError("Invalid email or password")

        if not _verify_password(password, user.password_hash):
            raise AuthError("Invalid email or password")

        if not user.is_active:
            raise AuthError("Account is disabled")

        access_token = self.create_access_token(user_id=str(user.id))
        refresh_token = self.create_refresh_token(user_id=str(user.id))

        user.last_login_at = datetime.now(timezone.utc)
        await self.user_repo._session.flush()

        return user, access_token, refresh_token

    async def refresh(self, refresh_token: str) -> tuple[str, str]:
        """Validate refresh token and issue new token pair."""
        payload = self.decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise AuthError("Invalid refresh token")

        user_id = payload.get("sub")
        if not user_id:
            raise AuthError("Invalid refresh token")

        user = await self.user_repo.get(UUID(user_id))
        if not user or not user.is_active:
            raise AuthError("User not found or disabled")

        return (
            self.create_access_token(user_id=user_id),
            self.create_refresh_token(user_id=user_id),
        )

    async def get_user_from_token(self, token: str) -> User:
        """Validate access token and return the user."""
        payload = self.decode_token(token)
        if payload.get("type") != "access":
            raise AuthError("Invalid access token")

        user_id = payload.get("sub")
        if not user_id:
            raise AuthError("Invalid token payload")

        user = await self.user_repo.get(UUID(user_id))
        if not user:
            raise AuthError("User not found")
        if not user.is_active:
            raise AuthError("Account is disabled")

        return user

    def create_access_token(self, user_id: str) -> str:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.jwt_expire_minutes
        )
        return jwt.encode(
            {"sub": user_id, "exp": expire, "type": "access"},
            settings.effective_secret_key,
            algorithm=settings.jwt_algorithm,
        )

    def create_refresh_token(self, user_id: str) -> str:
        expire = datetime.now(timezone.utc) + timedelta(days=30)
        return jwt.encode(
            {"sub": user_id, "exp": expire, "type": "refresh"},
            settings.effective_secret_key,
            algorithm=settings.jwt_algorithm,
        )

    def decode_token(self, token: str) -> dict:
        try:
            return jwt.decode(
                token,
                settings.effective_secret_key,
                algorithms=[settings.jwt_algorithm],
            )
        except JWTError as e:
            raise AuthError(f"Invalid or expired token: {e}")
