"""Request ids, request logging and safe error responses (OR-003)."""

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from structlog.testing import capture_logs

from backend.app.core.logging import REQUEST_ID_HEADER, resolve_request_id

ERROR_DETAIL = "boom-secret-detail"


def test_supplied_request_id_is_echoed(client: TestClient) -> None:
    response = client.get("/health", headers={REQUEST_ID_HEADER: "abc-123.req_1"})

    assert response.headers[REQUEST_ID_HEADER] == "abc-123.req_1"


def test_request_id_generated_when_missing(client: TestClient) -> None:
    response = client.get("/health")

    assert len(response.headers[REQUEST_ID_HEADER]) == 32


@pytest.mark.parametrize("supplied", ["x" * 65, "bad id with spaces", "injecté", ""])
def test_malformed_request_id_is_replaced(supplied: str) -> None:
    resolved = resolve_request_id(supplied)

    assert resolved != supplied
    assert len(resolved) == 32


def test_request_completed_is_logged(client: TestClient) -> None:
    with capture_logs() as logs:
        response = client.get("/health", headers={REQUEST_ID_HEADER: "req-42"})

    completed = [entry for entry in logs if entry["event"] == "request_completed"]
    assert len(completed) == 1
    entry = completed[0]
    assert entry["method"] == "GET"
    assert entry["path"] == "/health"
    assert entry["status"] == response.status_code
    assert isinstance(entry["duration_ms"], float)


def test_unhandled_error_returns_generic_body_with_request_id(
    app: FastAPI, client: TestClient
) -> None:
    def explode() -> None:
        raise RuntimeError(ERROR_DETAIL)

    app.add_api_route("/explode", explode)

    with capture_logs() as logs:
        response = client.get("/explode", headers={REQUEST_ID_HEADER: "req-500"})

    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert response.json() == {"detail": "Internal server error"}
    assert response.headers[REQUEST_ID_HEADER] == "req-500"
    assert ERROR_DETAIL not in response.text
    assert "Traceback" not in response.text
    errors = [entry for entry in logs if entry["event"] == "unhandled_exception"]
    assert errors and errors[0]["request_id"] == "req-500"
