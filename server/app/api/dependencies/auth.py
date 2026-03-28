"""
Conduit Server — Auth dependencies for FastAPI.

Provides `get_current_user` for protected endpoints and
`get_optional_user` for endpoints that work with or without auth.
"""

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.dependencies.services import get_auth_service
from app.infra.database.models import User
from app.services.auth import AuthService
from conduit.domain.errors import AuthError

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    """Require authentication — raises 401 if no valid token."""
    if not credentials:
        raise AuthError("Missing authorization header")
    return await auth_service.get_user_from_token(credentials.credentials)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> User | None:
    """Optional auth — returns None if no token provided."""
    if not credentials:
        return None
    try:
        return await auth_service.get_user_from_token(credentials.credentials)
    except AuthError:
        return None
