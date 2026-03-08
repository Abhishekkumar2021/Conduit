"""
Compatibility entrypoint for `uvicorn main:app`.

The canonical FastAPI app lives in `app.main`.
"""

from app.main import app, create_app

__all__ = ["app", "create_app"]
