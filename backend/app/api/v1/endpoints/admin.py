"""The protected admin router (OR-045).

require_admin is a router-level dependency: every route included here, now or later,
answers 401 without a valid session. Only admin_auth.public_router (login, setup) is
outside it.
"""

from fastapi import APIRouter, Depends

from backend.app.api.v1.endpoints import admin_auth
from backend.app.core.security import require_admin

router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])
router.include_router(admin_auth.router)
