"""DocuMind AI backend — FastAPI application factory."""
from __future__ import annotations

import logging
import os
import traceback

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .config import get_settings
from .database import create_tables, init_db
from .middleware.rate_limit import limiter, rate_limit_exceeded_handler
from .routes import chat, documents, health

logger = logging.getLogger("documind")


async def _unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    # Log the full traceback server-side; never expose it to the client.
    logger.error("Unhandled error: %s\n%s", exc, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


async def _validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid request. Please check your input and try again."},
    )


def create_app() -> FastAPI:
    settings = get_settings()

    init_db(settings.database_url)
    create_tables()
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.vector_store_dir, exist_ok=True)

    app = FastAPI(title="DocuMind AI", version=settings.version)

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(Exception, _unhandled_error)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(documents.router, prefix="/api")
    app.include_router(chat.router, prefix="/api")
    app.include_router(health.router, prefix="/api")

    return app


app = create_app()
