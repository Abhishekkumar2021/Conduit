"""
Conduit Server — FastAPI control plane entry point.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from conduit.domain.errors import (
    AuthError,
    ConduitError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan — startup and shutdown hooks."""
    # Startup: initialize database, discover adapters
    yield
    # Shutdown: cleanup


app = FastAPI(
    title="Conduit API",
    description="Data integration platform — control plane",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# ── Middleware ──

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Console dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Exception Handlers ──


@app.exception_handler(NotFoundError)
async def not_found_handler(_: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=404, content={"error": exc.code, "message": exc.message}
    )


@app.exception_handler(ValidationError)
async def validation_handler(_: Request, exc: ValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"error": exc.code, "message": exc.message, "field": exc.field},
    )


@app.exception_handler(AuthError)
async def auth_handler(_: Request, exc: AuthError) -> JSONResponse:
    return JSONResponse(
        status_code=401, content={"error": exc.code, "message": exc.message}
    )


@app.exception_handler(PermissionDeniedError)
async def permission_handler(_: Request, exc: PermissionDeniedError) -> JSONResponse:
    return JSONResponse(
        status_code=403, content={"error": exc.code, "message": exc.message}
    )


@app.exception_handler(ConduitError)
async def conduit_error_handler(_: Request, exc: ConduitError) -> JSONResponse:
    return JSONResponse(
        status_code=400, content={"error": exc.code, "message": exc.message}
    )


# ── Health Check ──


@app.get("/health", tags=["system"])
async def health():
    return {"status": "healthy", "service": "conduit-server", "version": "0.1.0"}


# ── API Router Registration ──
# (routers will be added here as we build Phase 2+)
