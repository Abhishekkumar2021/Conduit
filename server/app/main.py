import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.config import settings
from conduit.domain.errors import (
    AuthError,
    ConduitError,
    DuplicateError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from conduit.engine.adapters.registry import AdapterRegistry

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    AdapterRegistry.discover()
    logger.info("Conduit server started")
    yield
    logger.info("Conduit server shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    _register_exception_handlers(app)
    _register_middleware(app)

    app.include_router(api_router, prefix="/api/v1")

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "app": settings.app_name}

    return app


def _register_exception_handlers(app: FastAPI) -> None:
    """Map domain exceptions to proper HTTP responses."""

    @app.exception_handler(NotFoundError)
    async def not_found_handler(_req: Request, exc: NotFoundError):
        return JSONResponse(
            status_code=404,
            content={"error": exc.code, "message": exc.message},
        )

    @app.exception_handler(ValidationError)
    async def validation_handler(_req: Request, exc: ValidationError):
        return JSONResponse(
            status_code=422,
            content={"error": exc.code, "message": exc.message, "field": exc.field},
        )

    @app.exception_handler(DuplicateError)
    async def duplicate_handler(_req: Request, exc: DuplicateError):
        return JSONResponse(
            status_code=409,
            content={"error": exc.code, "message": exc.message},
        )

    @app.exception_handler(AuthError)
    async def auth_handler(_req: Request, exc: AuthError):
        return JSONResponse(
            status_code=401,
            content={"error": exc.code, "message": exc.message},
        )

    @app.exception_handler(PermissionDeniedError)
    async def permission_handler(_req: Request, exc: PermissionDeniedError):
        return JSONResponse(
            status_code=403,
            content={"error": exc.code, "message": exc.message},
        )

    @app.exception_handler(ConduitError)
    async def conduit_error_handler(_req: Request, exc: ConduitError):
        return JSONResponse(
            status_code=500,
            content={"error": exc.code, "message": exc.message},
        )


def _register_middleware(app: FastAPI) -> None:
    """Register request-level middleware."""

    @app.middleware("http")
    async def correlation_id_middleware(request: Request, call_next):
        correlation_id = request.headers.get(
            "X-Correlation-ID", str(uuid.uuid4())
        )
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        return response


app = create_app()
