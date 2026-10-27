"""catalogue_sync_runs rows and the single-sync advisory lock (OR-012).

The lock is a PostgreSQL session-level advisory lock held on a dedicated connection,
so it survives the commits the sync makes on its own session and is released even if
the process dies (the connection closes).
"""

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Engine, func, select, update
from sqlalchemy.orm import Session

from backend.app.models import CatalogueSyncRun, SyncRunStatus

# Arbitrary fixed key shared by every process that runs a catalogue sync.
CATALOGUE_SYNC_LOCK_KEY = 4_021_011
ERROR_DETAIL_MAX_LENGTH = 4000
_TRUNCATION_MARK = " [truncated]"


class SyncAlreadyRunningError(RuntimeError):
    """Another catalogue sync holds the lock."""

    def __init__(self) -> None:
        super().__init__("A catalogue sync is already running; try again when it finishes.")


@dataclass(frozen=True)
class SyncCounts:
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    errors: int = 0


@contextmanager
def catalogue_sync_lock(engine: Engine) -> Iterator[None]:
    """Hold the catalogue sync lock, or raise SyncAlreadyRunningError at once."""
    with engine.connect() as connection:
        acquired = connection.scalar(select(func.pg_try_advisory_lock(CATALOGUE_SYNC_LOCK_KEY)))
        connection.commit()
        if not acquired:
            raise SyncAlreadyRunningError
        try:
            yield
        finally:
            connection.scalar(select(func.pg_advisory_unlock(CATALOGUE_SYNC_LOCK_KEY)))
            connection.commit()


def truncate_error_detail(detail: str | None) -> str | None:
    if detail is None or len(detail) <= ERROR_DETAIL_MAX_LENGTH:
        return detail
    return detail[: ERROR_DETAIL_MAX_LENGTH - len(_TRUNCATION_MARK)] + _TRUNCATION_MARK


def start_run(session: Session, source: str) -> CatalogueSyncRun:
    run = CatalogueSyncRun(source=source, status=SyncRunStatus.RUNNING)
    session.add(run)
    session.flush()
    return run


def finish_run(
    session: Session,
    run: CatalogueSyncRun,
    *,
    status: SyncRunStatus,
    counts: SyncCounts,
    error_detail: str | None = None,
) -> None:
    if status is SyncRunStatus.RUNNING:
        raise ValueError("A finished run needs a final status.")
    run.status = status
    run.finished_at = func.now()
    run.created_count = counts.created
    run.updated_count = counts.updated
    run.unchanged_count = counts.unchanged
    run.error_count = counts.errors
    run.error_detail = truncate_error_detail(error_detail)
    session.flush()


def fail_stale_runs(session: Session, *, started_before: datetime | None = None) -> int:
    """Mark runs left 'running' as failed. Returns how many.

    With ``started_before`` only older runs are touched. Without it every running run
    is failed, which is correct only while holding ``catalogue_sync_lock``.
    """
    conditions = [CatalogueSyncRun.status == SyncRunStatus.RUNNING]
    if started_before is not None:
        conditions.append(CatalogueSyncRun.started_at < started_before)
    result = session.execute(
        update(CatalogueSyncRun)
        .where(*conditions)
        .values(
            status=SyncRunStatus.FAILED,
            finished_at=func.now(),
            error_detail="Marked failed: run did not finish (stale run recovery).",
        )
        .returning(CatalogueSyncRun.id)
    )
    return len(result.all())


def sync_lock_available(engine: Engine) -> bool:
    """Whether no sync holds the lock right now (probe: take and release at once)."""
    try:
        with catalogue_sync_lock(engine):
            return True
    except SyncAlreadyRunningError:
        return False


def page_runs(session: Session, *, page: int, page_size: int) -> tuple[list[CatalogueSyncRun], int]:
    """Newest first."""
    total = session.scalar(select(func.count()).select_from(CatalogueSyncRun)) or 0
    rows = session.scalars(
        select(CatalogueSyncRun)
        .order_by(CatalogueSyncRun.started_at.desc(), CatalogueSyncRun.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return list(rows), total


def last_success_at(session: Session) -> datetime | None:
    return session.scalar(
        select(func.max(CatalogueSyncRun.finished_at)).where(
            CatalogueSyncRun.status == SyncRunStatus.SUCCESS
        )
    )
