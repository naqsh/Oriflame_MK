"""Liveness and readiness endpoints, mounted at the root (not under /api/v1)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from backend.app.schemas.health import HealthResponse, ReadinessResponse
from backend.app.services.health import ReadinessService, get_readiness_service

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def liveness() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get(
    "/health/ready",
    response_model=ReadinessResponse,
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": ReadinessResponse}},
)
def readiness(
    response: Response,
    service: Annotated[ReadinessService, Depends(get_readiness_service)],
) -> ReadinessResponse:
    if service.database_is_reachable():
        return ReadinessResponse(status="ready", database="ok")
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadinessResponse(status="not_ready", database="unavailable")
