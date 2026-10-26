"""Session lifecycle and connection-error messages (OR-004)."""

from typing import Annotated, ClassVar

import pytest
from fastapi import Depends, FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from backend.app.core.config import load_settings
from backend.app.db.session import (
    create_db_engine,
    describe_connection_error,
    get_db,
    get_session_factory,
)
from backend.app.models.base import Base


class CountingSession(Session):
    closed: ClassVar[int] = 0

    def close(self) -> None:
        CountingSession.closed += 1  # sessionmaker subclasses class_, so not type(self)
        super().close()


@pytest.fixture
def counting_app(app: FastAPI) -> FastAPI:
    CountingSession.closed = 0
    # Creating a session does not connect, so no database is needed.
    factory = sessionmaker(bind=create_db_engine(load_settings()), class_=CountingSession)
    app.dependency_overrides[get_session_factory] = lambda: factory

    def uses_db(db: Annotated[Session, Depends(get_db)]) -> dict[str, bool]:
        return {"is_session": isinstance(db, CountingSession)}

    def fails_with_db(db: Annotated[Session, Depends(get_db)]) -> None:
        raise RuntimeError("route failure")

    app.add_api_route("/uses-db", uses_db)
    app.add_api_route("/fails-with-db", fails_with_db)
    return app


def test_get_db_closes_session_after_request(counting_app: FastAPI, client: TestClient) -> None:
    response = client.get("/uses-db")

    assert response.json() == {"is_session": True}
    assert CountingSession.closed == 1


def test_get_db_closes_session_when_route_raises(counting_app: FastAPI, client: TestClient) -> None:
    response = client.get("/fails-with-db")

    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert CountingSession.closed == 1


def _operational_error(driver_message: str) -> OperationalError:
    return OperationalError("SELECT 1", {}, Exception(driver_message))


def test_auth_failure_message_points_at_password(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POSTGRES_URL", "postgresql://app:pw-not-shown@db.example.test:5432/app")

    message = describe_connection_error(
        _operational_error('password authentication failed for user "app"'), load_settings()
    )

    assert "authentication failed" in message
    assert "[ ]" in message
    assert "pw-not-shown" not in message
    assert "db.example.test" not in message


def test_supabase_direct_host_failure_suggests_session_pooler(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "POSTGRES_URL", "postgresql://postgres@db.abcdefgh.supabase.co:5432/postgres"
    )

    message = describe_connection_error(
        _operational_error("could not translate host name"), load_settings()
    )

    assert "Session pooler" in message
    assert "abcdefgh" not in message


def test_other_connection_failure_is_generic() -> None:
    message = describe_connection_error(_operational_error("connection refused"), load_settings())

    assert message == "Could not connect to the database in POSTGRES_URL."


def test_metadata_uses_naming_convention() -> None:
    assert Base.metadata.naming_convention["pk"] == "pk_%(table_name)s"
