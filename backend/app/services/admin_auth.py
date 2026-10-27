"""Admin login, logout and session checks (OR-044, ADR-003).

Login failures are indistinguishable to the caller: unknown email, wrong password,
inactive or locked account all return None, and the caller answers with one generic
message. Passwords and raw tokens are never logged or stored.
"""

import hashlib
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

import structlog
from fastapi import Depends
from sqlalchemy.orm import Session

from backend.app.core.passwords import DUMMY_HASH, verify_password
from backend.app.db.session import get_db
from backend.app.models import AdminUser
from backend.app.repositories import admin_users
from backend.app.services import audit

logger = structlog.get_logger(__name__)

SESSION_LIFETIME = timedelta(hours=8)
MAX_FAILED_ATTEMPTS = 5
LOCKOUT = timedelta(minutes=15)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class LoginResult:
    token: str
    expires_at: datetime
    user: AdminUser


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AdminAuthService:
    def __init__(self, session: Session, clock: Callable[[], datetime] = _utcnow) -> None:
        self._session = session
        self._clock = clock

    def login(self, email: str, password: str) -> LoginResult | None:
        now = self._clock()
        user = admin_users.get_by_email(self._session, email)
        if user is None:
            verify_password(password, DUMMY_HASH)  # same cost as a real check
            audit.record(
                self._session,
                audit.ADMIN_LOGIN_FAILED,
                admin_user_id=None,
                details={"reason": "unknown_email"},
            )
            self._session.commit()
            logger.info("admin_login_failed", reason="unknown_email")
            return None
        if user.locked_until is not None and user.locked_until > now:
            audit.record(
                self._session,
                audit.ADMIN_LOGIN_FAILED,
                admin_user_id=user.id,
                details={"reason": "locked"},
            )
            self._session.commit()
            logger.info("admin_login_failed", reason="locked", admin_user_id=user.id)
            return None
        if not verify_password(password, user.password_hash) or not user.is_active:
            self._record_failure(user, now)
            return None

        user.failed_attempts = 0
        user.locked_until = None
        user.last_login_at = now
        token = secrets.token_urlsafe(32)
        expires_at = now + SESSION_LIFETIME
        admin_users.add_session(
            self._session,
            admin_user_id=user.id,
            token_hash=hash_token(token),
            expires_at=expires_at,
        )
        audit.record(self._session, audit.ADMIN_LOGIN, admin_user_id=user.id)
        self._session.commit()
        logger.info("admin_login", admin_user_id=user.id)
        return LoginResult(token=token, expires_at=expires_at, user=user)

    def _record_failure(self, user: AdminUser, now: datetime) -> None:
        reason = "inactive" if not user.is_active else "bad_password"
        user.failed_attempts += 1
        locked_now = user.failed_attempts >= MAX_FAILED_ATTEMPTS
        if locked_now:
            user.locked_until = now + LOCKOUT
            user.failed_attempts = 0
            logger.warning("admin_account_locked", admin_user_id=user.id)
        audit.record(
            self._session,
            audit.ADMIN_LOGIN_FAILED,
            admin_user_id=user.id,
            details={"reason": reason, "locked": locked_now},
        )
        self._session.commit()
        logger.info("admin_login_failed", reason=reason, admin_user_id=user.id)

    def authenticate(self, token: str) -> AdminUser | None:
        return admin_users.active_session_user(self._session, hash_token(token), self._clock())

    def logout(self, token: str, admin_user_id: int) -> None:
        admin_users.revoke_session(self._session, hash_token(token), self._clock())
        audit.record(self._session, audit.ADMIN_LOGOUT, admin_user_id=admin_user_id)
        self._session.commit()

    def has_admin(self) -> bool:
        return admin_users.count(self._session) > 0


def get_admin_auth_service(db: Annotated[Session, Depends(get_db)]) -> AdminAuthService:
    return AdminAuthService(db)
