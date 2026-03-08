import logging

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from app.api.dependencies.services import get_user_service
from app.services.user import UserService

router = APIRouter()
logger = logging.getLogger(__name__)


class OAuthCallback(BaseModel):
    github_id: str
    email: str
    name: str


@router.post("/oauth/github", status_code=status.HTTP_200_OK)
async def github_oauth_callback(
    req: OAuthCallback,
    user_service: UserService = Depends(get_user_service),
):
    """
    Simulated OAuth callback. In production, this would exchange a code for a token
    and fetch the user's GitHub profile.
    """
    user = await user_service.get_or_create_github_user(
        github_id=req.github_id, email=req.email, name=req.name
    )
    # Generate and return a JWT here in future
    return {"message": "Success", "user_id": str(user.id)}
