"""
Conduit Server — Authentication endpoints.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, EmailStr, Field

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.services import get_auth_service
from app.infra.database.models import User
from app.services.auth import AuthService

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class AuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: UUID
    email: str
    display_name: str
    auth_provider: str

    model_config = {"from_attributes": True}


@router.post(
    "/register",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    req: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Register a new user account."""
    user = await auth_service.register(
        email=req.email,
        password=req.password,
        display_name=req.display_name,
    )
    access_token = auth_service.create_access_token(str(user.id))
    refresh_token = auth_service.create_refresh_token(str(user.id))
    return AuthTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=AuthTokenResponse)
async def login(
    req: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Login with email and password."""
    user, access_token, refresh_token = await auth_service.login(
        email=req.email, password=req.password
    )
    return AuthTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=AuthTokenResponse)
async def refresh_token(
    req: RefreshRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Exchange a refresh token for a new token pair."""
    access, refresh = await auth_service.refresh(req.refresh_token)
    payload = auth_service.decode_token(access)
    user_id = payload["sub"]
    user = await auth_service.user_repo.get(UUID(user_id))
    return AuthTokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    user: User = Depends(get_current_user),
):
    """Get the current authenticated user's profile."""
    return UserResponse.model_validate(user)
