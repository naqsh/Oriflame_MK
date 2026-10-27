"""CORS is restricted to the configured origins (OR-003)."""

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from backend.app.main import create_app
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


def test_api_responses_carry_security_headers(client: TestClient) -> None:
    response = client.get("/health")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert (
        response.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"
    )
    assert "camera=()" in response.headers["permissions-policy"]
    # HSTS only in production (it would pin http://localhost to https otherwise).
    assert "strict-transport-security" not in response.headers


def test_error_responses_carry_security_headers_too(client: TestClient) -> None:
    response = client.get("/api/v1/admin/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.headers["x-content-type-options"] == "nosniff"


def test_hsts_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://store.example.pk")
    with TestClient(create_app()) as client:
        response = client.get("/health")
    assert response.headers["strict-transport-security"].startswith("max-age=63072000")
    assert (
        "access-control-allow-origin"
        not in client.get("/health", headers={"Origin": "http://localhost:3000"}).headers
    )
