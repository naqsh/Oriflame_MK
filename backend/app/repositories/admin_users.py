"""admin_users and admin_sessions persistence (OR-044)."""

from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from backend.app.models import AdminSession, AdminUser


def get_by_email(session: Session, email: str) -> AdminUser | None:
    return session.scalars(select(AdminUser).where(AdminUser.email == email.lower())).first()


def count(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(AdminUser)) or 0


def create(session: Session, *, email: str, password_hash: str) -> AdminUser:
    user = AdminUser(email=email.lower(), password_hash=password_hash)
    session.add(user)
    session.flush()
    return user


def add_session(
    session: Session, *, admin_user_id: int, token_hash: str, expires_at: datetime
) -> None:
    session.add(
        AdminSession(admin_user_id=admin_user_id, token_hash=token_hash, expires_at=expires_at)
    )
    session.flush()


def active_session_user(session: Session, token_hash: str, now: datetime) -> AdminUser | None:
    """The active admin behind an unexpired, unrevoked session, or None."""
    return session.scalars(
        select(AdminUser)
        .join(AdminSession, AdminSession.admin_user_id == AdminUser.id)
        .where(
            AdminSession.token_hash == token_hash,
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > now,
            AdminUser.is_active.is_(True),
        )
    ).first()


def revoke_session(session: Session, token_hash: str, now: datetime) -> None:
    session.execute(
        update(AdminSession)
        .where(AdminSession.token_hash == token_hash, AdminSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
