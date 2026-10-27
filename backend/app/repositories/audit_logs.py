"""audit_logs persistence (OR-046)."""

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.models.audit import AuditLog


def add(
    session: Session,
    *,
    action: str,
    admin_user_id: int | None,
    target_type: str | None,
    target_id: str | None,
    details: dict[str, Any],
) -> AuditLog:
    entry = AuditLog(
        action=action,
        admin_user_id=admin_user_id,
        target_type=target_type,
        target_id=target_id,
        details=details,
    )
    session.add(entry)
    session.flush()
    return entry


def page(session: Session, *, page: int, page_size: int) -> tuple[list[AuditLog], int]:
    """Newest first."""
    total = session.scalar(select(func.count()).select_from(AuditLog)) or 0
    rows = session.scalars(
        select(AuditLog)
        .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return list(rows), total
