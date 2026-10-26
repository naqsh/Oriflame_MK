"""Liveness and readiness endpoints (OR-003)."""

import os
import time

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from structlog.testing import capture_logs

from backend.app.core.config import load_settings
from backend.app.db.session import create_db_engine, get_engine
from backend.app.services.health import ReadinessService, get_readiness_service

# Closed local port: connection is refused immediately.
UNREACHABLE_DB = "postgresql://health_user:pw-must-not-be-logged@127.0.0.1:1/app"
# Non-routable address: the connection attempt hangs until connect_timeout.
BLACKHOLE_DB = "postgresql://health_user@10.255.255.1:5432/app"


class FakeReadiness(ReadinessService):
    def __init__(self, reachable: bool) -> None:
        self._reachable = reachable

    def database_is_reachable(self) -> bool:
        return self._reachable


def test_liveness_returns_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok"}


def test_readiness_ok_when_database_reachable(app: FastAPI, client: TestClient) -> None:
    app.dependency_overrides[get_readiness_service] = lambda: FakeReadiness(reachable=True)

    response = client.get("/health/ready")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ready", "database": "ok"}


def test_readiness_503_when_database_unreachable(
    monkeypatch: pytest.MonkeyPatch, app: FastAPI, client: TestClient
) -> None:
    monkeypatch.setenv("POSTGRES_URL", UNREACHABLE_DB)
    # Real engine and readiness path, with a short timeout to keep the test fast.
    app.dependency_overrides[get_engine] = lambda: create_db_engine(
        load_settings(), connect_timeout_seconds=1
    )

    with capture_logs() as logs:
        response = client.get("/health/ready")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.json() == {"status": "not_ready", "database": "unavailable"}
    assert any(entry["event"] == "database_unavailable" for entry in logs)
    assert "pw-must-not-be-logged" not in repr(logs)


def test_readiness_check_is_bounded_by_connect_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POSTGRES_URL", BLACKHOLE_DB)
    engine = create_db_engine(load_settings(), connect_timeout_seconds=1)

    started = time.perf_counter()
    reachable = ReadinessService(engine).database_is_reachable()

    assert reachable is False
    # libpq's default sslmode=prefer makes a second (non-SSL) attempt, so allow 2x.
    assert time.perf_counter() - started < 5


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRES_URL"),
    reason="Needs a real PostgreSQL via TEST_POSTGRES_URL (CI service container, OR-007)",
)
def test_readiness_ok_against_real_database(
    monkeypatch: pytest.MonkeyPatch, client: TestClient
) -> None:
    monkeypatch.setenv("POSTGRES_URL", os.environ["TEST_POSTGRES_URL"])

    response = client.get("/health/ready")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ready", "database": "ok"}
