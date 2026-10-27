"""Every admin route rejects requests without a valid session (OR-045).

Routes are enumerated from the application, so a route added later under /api/v1/admin
is covered automatically. Only the explicitly public login and setup routes are exempt.
"""

import re

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from backend.app.api.v1.endpoints.admin import router as admin_router
from backend.app.core.security import require_admin
from backend.app.services.admin_auth import get_admin_auth_service

PUBLIC_ADMIN_ROUTES = {("POST", "/api/v1/admin/login"), ("GET", "/api/v1/admin/setup")}


def admin_routes(app: FastAPI) -> list[tuple[str, str]]:
    """Every /api/v1/admin operation, read from the app's OpenAPI schema.

    FastAPI 0.16x nests included routers, so app.routes is not a flat list of APIRoute;
    the schema is built from every included route and is the stable way to list them.
    """
    paths: dict[str, dict[str, object]] = app.openapi()["paths"]
    return [
        (method.upper(), path)
        for path, operations in paths.items()
        if path.startswith("/api/v1/admin")
        for method in operations
    ]


def concrete(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "1", path)


class NoSessions:
    def authenticate(self, token: str) -> None:
        return None


def test_admin_routes_are_enumerated(app: FastAPI) -> None:
    routes = set(admin_routes(app))
    assert routes >= PUBLIC_ADMIN_ROUTES
    protected = routes - PUBLIC_ADMIN_ROUTES
    assert ("GET", "/api/v1/admin/me") in protected
    assert ("POST", "/api/v1/admin/logout") in protected


@pytest.mark.parametrize("auth", [None, "Bearer not-a-real-token", "Basic dXNlcjpwYXNz"])
def test_every_protected_admin_route_rejects_requests_without_a_valid_session(
    app: FastAPI, auth: str | None
) -> None:
    app.dependency_overrides[get_admin_auth_service] = NoSessions
    headers = {"Authorization": auth} if auth else {}
    protected = [route for route in admin_routes(app) if route not in PUBLIC_ADMIN_ROUTES]
    assert protected  # never pass vacuously
    with TestClient(app, raise_server_exceptions=False) as client:
        for method, path in protected:
            response = client.request(method, concrete(path), headers=headers, json={})
            assert response.status_code == status.HTTP_401_UNAUTHORIZED, (method, path)
            assert response.json() == {"detail": "Authentication required."}


def test_protection_is_router_level_not_per_endpoint() -> None:
    assert any(dep.dependency is require_admin for dep in admin_router.dependencies)
