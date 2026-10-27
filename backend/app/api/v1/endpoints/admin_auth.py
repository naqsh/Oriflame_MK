"""Admin login (public) and session endpoints (OR-044). No logic here.

Login answers every failure with the same 401 message. It is rate limited per client
address on top of the per-account lockout in AdminAuthService.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from backend.app.core.rate_limit import RateLimiter, rate_limit_dependency
from backend.app.core.security import CurrentAdmin
from backend.app.schemas.admin import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminMe,
    AdminSetupStatus,
)
from backend.app.services.admin_auth import AdminAuthService, get_admin_auth_service

LOGIN_LIMIT_PER_MINUTE = 10
login_limiter = RateLimiter(limit=LOGIN_LIMIT_PER_MINUTE)
INVALID_LOGIN = "Invalid email or password."

AuthService = Annotated[AdminAuthService, Depends(get_admin_auth_service)]

# Public: the only admin routes reachable without a session.
public_router = APIRouter(prefix="/admin", tags=["admin"])
# Protected: included in the admin router, which applies require_admin.
router = APIRouter(tags=["admin"])


@public_router.post(
    "/login",
    response_model=AdminLoginResponse,
    dependencies=[Depends(rate_limit_dependency(login_limiter))],
)
def admin_login(
    body: AdminLoginRequest, response: Response, auth: AuthService
) -> AdminLoginResponse:
    response.headers["Cache-Control"] = "no-store"
    result = auth.login(body.email, body.password)
    if result is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_LOGIN)
    return AdminLoginResponse(token=result.token, expires_at=result.expires_at)


@public_router.get("/setup", response_model=AdminSetupStatus)
def admin_setup(auth: AuthService) -> AdminSetupStatus:
    """Whether any admin exists, so the login page can show the CLI setup step."""
    return AdminSetupStatus(has_admin=auth.has_admin())


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def admin_logout(request: Request, admin: CurrentAdmin, auth: AuthService) -> None:
    auth.logout(request.state.admin_token)


@router.get("/me", response_model=AdminMe)
def admin_me(admin: CurrentAdmin, response: Response) -> AdminMe:
    response.headers["Cache-Control"] = "no-store"
    return AdminMe(email=admin.email, last_login_at=admin.last_login_at)
