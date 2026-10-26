"""FastAPI application factory.

Run locally with: uv run uvicorn backend.app.main:create_app --factory --reload
"""

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.health import router as health_router
from backend.app.api.v1.router import api_router
from backend.app.core.config import get_config_provider
from backend.app.core.logging import REQUEST_ID_HEADER, RequestContextMiddleware, configure_logging
from backend.app.schemas.errors import ErrorResponse

logger = structlog.get_logger(__name__)

INTERNAL_ERROR_MESSAGE = "Internal server error"


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    """Last-resort handler: generic body for the client, full detail in the server log."""
    request_id: str | None = getattr(request.state, "request_id", None)
    logger.error(
        "unhandled_exception",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        exc_info=exc,
    )
    headers = {REQUEST_ID_HEADER: request_id} if request_id else None
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(detail=INTERNAL_ERROR_MESSAGE).model_dump(),
        headers=headers,
    )


def create_app() -> FastAPI:
    settings = get_config_provider().get_settings()
    configure_logging()

    app = FastAPI(
        title="Oriflame Pakistan Referral Store API",
        version="0.1.0",
        docs_url=None if settings.app_env == "production" else "/docs",
        redoc_url=None,
        openapi_url=None if settings.app_env == "production" else "/openapi.json",
    )

    # Added first so RequestContextMiddleware (added last) is the outer layer.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", REQUEST_ID_HEADER],
        expose_headers=[REQUEST_ID_HEADER],
    )
    app.add_middleware(RequestContextMiddleware)
    app.add_exception_handler(Exception, handle_unexpected_error)

    app.include_router(health_router)
    app.include_router(api_router, prefix="/api/v1")
    return app
