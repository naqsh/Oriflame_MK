"""Audit logging for admin actions (OR-046).

``record`` adds the row to the caller's session without committing: the action and its
audit row commit or roll back together. Details are checked for secret-looking keys,
which are refused rather than silently stored.
"""

import re
from collections.abc import Mapping
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.audit import AuditLog
from backend.app.repositories import audit_logs

ADMIN_LOGIN = "admin.login"
ADMIN_LOGIN_FAILED = "admin.login_failed"
ADMIN_LOGOUT = "admin.logout"
CATALOGUE_SYNC_STARTED = "catalogue.sync_started"

_SECRET_KEY = re.compile(r"password|token|secret|consultant_code|authorization|cookie", re.I)


class UnsafeAuditDetailsError(ValueError):
    """Audit details contained a key that may hold a secret."""


def _check(details: Mapping[str, Any]) -> None:
    for key, value in details.items():
        if _SECRET_KEY.search(key):
            raise UnsafeAuditDetailsError(f"audit details may not contain {key!r}")
        if isinstance(value, Mapping):
            _check(value)


def record(
    session: Session,
    action: str,
    *,
    admin_user_id: int | None,
    target_type: str | None = None,
    target_id: str | None = None,
    details: Mapping[str, Any] | None = None,
) -> AuditLog:
    safe = dict(details or {})
    _check(safe)
    return audit_logs.add(
        session,
        action=action,
        admin_user_id=admin_user_id,
        target_type=target_type,
        target_id=target_id,
        details=safe,
    )


class AuditService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def recent(self, *, page: int, page_size: int) -> tuple[list[AuditLog], int]:
        return audit_logs.page(self._session, page=page, page_size=page_size)


def get_audit_service(db: Annotated[Session, Depends(get_db)]) -> AuditService:
    return AuditService(db)
