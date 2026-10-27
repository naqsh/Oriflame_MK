"""Admin authorisation dependency (OR-045, ADR-003).

Applied at the admin router level, so every route added to that router is protected
without per-endpoint wiring. The API authenticates only with a bearer session token
(sent by the Next.js server), never a cookie, so cross-site requests carry no credentials.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.models import AdminUser
from backend.app.services.admin_auth import AdminAuthService, get_admin_auth_service

_bearer = HTTPBearer(auto_error=False)
UNAUTHENTICATED = "Authentication required."


def require_admin(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    auth: Annotated[AdminAuthService, Depends(get_admin_auth_service)],
) -> AdminUser:
    user = auth.authenticate(credentials.credentials) if credentials else None
    if user is None or credentials is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail=UNAUTHENTICATED,
            headers={"WWW-Authenticate": "Bearer"},
        )
    request.state.admin_token = credentials.credentials
    return user


CurrentAdmin = Annotated[AdminUser, Depends(require_admin)]
