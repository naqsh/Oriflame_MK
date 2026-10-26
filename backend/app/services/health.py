"""Readiness checks for the health endpoints."""

from typing import Annotated

import structlog
from fastapi import Depends
from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from backend.app.db.session import get_engine

logger = structlog.get_logger(__name__)


class ReadinessService:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def database_is_reachable(self) -> bool:
        """Run ``SELECT 1``; bounded by the engine's connect and pool timeouts."""
        try:
            with self._engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError as exc:
            # Only the class name: driver messages can include connection details.
            logger.warning("database_unavailable", error_type=type(exc).__name__)
            return False
        return True


def get_readiness_service(engine: Annotated[Engine, Depends(get_engine)]) -> ReadinessService:
    return ReadinessService(engine)
