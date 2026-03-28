"""
Compatibility entrypoint for `uvicorn main:app`.

The canonical FastAPI app lives in `app.main`.
"""

from app.config import settings
from app.logging import setup_logging

setup_logging(debug=settings.debug, json_output=not settings.debug)

from app.main import app, create_app  # noqa: E402

__all__ = ["app", "create_app"]
