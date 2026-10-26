"""CORS is restricted to the configured origins (OR-003)."""

from fastapi import status
from fastapi.testclient import TestClient

from backend.tests.conftest import ALLOWED_ORIGIN


def test_preflight_from_allowed_origin_succeeds(client: TestClient) -> None:
    response = client.options(
        "/health",
        headers={"Origin": ALLOWED_ORIGIN, "Access-Control-Request-Method": "GET"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "access-control-allow-credentials" not in response.headers


def test_preflight_from_disallowed_origin_gets_no_cors_headers(client: TestClient) -> None:
    response = client.options(
        "/health",
        headers={"Origin": "https://evil.example.test", "Access-Control-Request-Method": "GET"},
    )

    assert "access-control-allow-origin" not in response.headers


def test_simple_request_from_allowed_origin_exposes_request_id(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": ALLOWED_ORIGIN})

    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "x-request-id" in response.headers["access-control-expose-headers"].lower()
