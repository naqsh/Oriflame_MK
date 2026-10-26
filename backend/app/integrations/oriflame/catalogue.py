"""Catalogue sync orchestration (OR-014).

One run: take the sync lock, recover orphaned runs, record a ``running`` row, upsert
categories then products in committed batches, hide products the source no longer
lists, and finish the row as success, partial or failed.

- Per-record problems (invalid payloads, rows the database rejects) are counted and
  summarised in ``error_detail``; the run carries on and ends ``partial``.
- Whole-source problems (auth, unreachable, rate limited, malformed) end the run
  ``failed``. A later page failing ends it ``partial`` and skips hiding.
- A source that lists no valid products fails the run instead of hiding the catalogue.
- Batches already committed stay: upserts are idempotent, so a rerun completes the
  work without duplicates.

Counts on the run row are product outcomes. Error text never includes input values,
query strings or raw database driver messages.
"""

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy import Engine
from sqlalchemy.exc import DataError, IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from backend.app.integrations.oriflame.client import (
    CatalogueSource,
    InvalidRecord,
    SourceCategory,
    SourceError,
    SourcePageError,
)
from backend.app.models import CatalogueSyncRun, SyncRunStatus
from backend.app.repositories.categories import upsert_categories
from backend.app.repositories.outcomes import UpsertOutcome
from backend.app.repositories.products import hide_products_missing_from, upsert_product
from backend.app.repositories.sync_runs import (
    SyncCounts,
    catalogue_sync_lock,
    fail_stale_runs,
    finish_run,
    start_run,
)

BATCH_SIZE = 100
MAX_DETAIL_LINES = 50

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class SyncReport:
    run_id: int
    status: SyncRunStatus
    counts: SyncCounts
    hidden_source_ids: list[str]
    error_detail: str | None


@dataclass
class _Tally:
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    errors: int = 0
    lines: list[str] = field(default_factory=list)

    def outcome(self, outcome: UpsertOutcome) -> None:
        match outcome:
            case UpsertOutcome.CREATED:
                self.created += 1
            case UpsertOutcome.UPDATED:
                self.updated += 1
            case UpsertOutcome.UNCHANGED:
                self.unchanged += 1

    def error(self, line: str) -> None:
        self.errors += 1
        self.lines.append(line)

    def note(self, line: str) -> None:
        """Worth recording but not an error (e.g. a reference to an unknown category)."""
        self.lines.append(line)

    @property
    def counts(self) -> SyncCounts:
        return SyncCounts(self.created, self.updated, self.unchanged, self.errors)

    @property
    def detail(self) -> str | None:
        if not self.lines:
            return None
        shown = self.lines[:MAX_DETAIL_LINES]
        extra = len(self.lines) - len(shown)
        if extra:
            shown.append(f"... and {extra} more")
        return "\n".join(shown)


class CatalogueSyncService:
    def __init__(
        self,
        engine: Engine,
        session_factory: sessionmaker[Session],
        *,
        batch_size: int = BATCH_SIZE,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._engine = engine
        self._sessions = session_factory
        self._batch_size = batch_size
        self._clock = clock

    def run(self, source: CatalogueSource) -> SyncReport:
        """Sync once. Raises SyncAlreadyRunningError if another sync holds the lock."""
        with catalogue_sync_lock(self._engine), self._session() as session:
            return self._run_locked(session, source)

    @contextmanager
    def _session(self) -> Iterator[Session]:
        session = self._sessions()
        try:
            yield session
        finally:
            session.close()

    def _run_locked(self, session: Session, source: CatalogueSource) -> SyncReport:
        # We hold the lock, so any run still marked running belongs to a dead process.
        recovered = fail_stale_runs(session)
        run_id = start_run(session, source.name).id
        session.commit()
        log = logger.bind(run_id=run_id, source=source.name)
        log.info("catalogue_sync_started", recovered_stale_runs=recovered)

        tally = _Tally()
        try:
            status, hidden = self._sync(session, source, tally, log)
            return self._finish(session, run_id, status, tally, hidden, log)
        except SourceError as exc:
            session.rollback()
            tally.error(f"Source failed: {exc}")
            return self._finish(session, run_id, SyncRunStatus.FAILED, tally, [], log)
        except SQLAlchemyError as exc:
            session.rollback()
            tally.error(f"Database error ({type(exc).__name__}); see server logs")
            self._finish(session, run_id, SyncRunStatus.FAILED, tally, [], log)
            raise

    def _sync(
        self, session: Session, source: CatalogueSource, tally: _Tally, log: Any
    ) -> tuple[SyncRunStatus, list[str]]:
        self._sync_categories(session, source, tally)
        session.commit()
        seen, complete = self._sync_products(session, source, tally, self._clock())
        if not seen:
            tally.error("Source listed no valid products; refusing to hide the catalogue")
            return SyncRunStatus.FAILED, []

        hidden: list[str] = []
        if complete:
            hidden = hide_products_missing_from(session, seen)
            if hidden:
                log.info("catalogue_products_hidden", count=len(hidden), source_ids=hidden[:20])
                tally.note(f"Hidden (no longer listed by the source): {len(hidden)}")
        if tally.errors or not complete:
            return SyncRunStatus.PARTIAL, hidden
        return SyncRunStatus.SUCCESS, hidden

    def _sync_categories(self, session: Session, source: CatalogueSource, tally: _Tally) -> None:
        valid: list[SourceCategory] = []
        for item in source.iter_categories():
            if isinstance(item, InvalidRecord):
                tally.error(f"category {item.source_id or '(no source_id)'}: {item.problems}")
            else:
                valid.append(item)
        result = upsert_categories(session, valid)
        for child, parent in result.missing_parents.items():
            tally.note(f"category {child}: unknown parent {parent}")

    def _sync_products(
        self, session: Session, source: CatalogueSource, tally: _Tally, synced_at: datetime
    ) -> tuple[set[str], bool]:
        """Upsert products in committed batches. Returns (seen source ids, complete)."""
        seen: set[str] = set()
        pending = 0
        try:
            for item in source.iter_products():
                if isinstance(item, InvalidRecord):
                    tally.error(f"product {item.source_id or '(no source_id)'}: {item.problems}")
                    continue
                seen.add(item.source_id)
                try:
                    result = upsert_product(session, item, synced_at=synced_at)
                except (IntegrityError, DataError) as exc:
                    tally.error(
                        f"product {item.source_id}: database rejected it ({type(exc).__name__})"
                    )
                    continue
                tally.outcome(result.outcome)
                if result.missing_categories:
                    missing = ", ".join(result.missing_categories)
                    tally.note(f"product {item.source_id}: unknown categories {missing}")
                pending += 1
                if pending >= self._batch_size:
                    session.commit()
                    pending = 0
        except SourcePageError as exc:
            session.commit()  # keep what earlier pages delivered
            tally.error(f"Source failed part-way: {exc}")
            return seen, False
        session.commit()
        return seen, True

    def _finish(
        self,
        session: Session,
        run_id: int,
        status: SyncRunStatus,
        tally: _Tally,
        hidden: list[str],
        log: Any,
    ) -> SyncReport:
        run = session.get_one(CatalogueSyncRun, run_id)
        finish_run(session, run, status=status, counts=tally.counts, error_detail=tally.detail)
        session.commit()
        failed = status is SyncRunStatus.FAILED
        (log.warning if failed else log.info)(
            "catalogue_sync_failed" if failed else "catalogue_sync_finished",
            status=status.value,
            created=tally.created,
            updated=tally.updated,
            unchanged=tally.unchanged,
            errors=tally.errors,
            hidden=len(hidden),
        )
        return SyncReport(run_id, status, tally.counts, hidden, run.error_detail)
