"""Catalogue sync status and the manual trigger for the admin area (OR-047).

The trigger checks everything it can before answering, so the admin gets a clear
refusal instead of a background failure: the source must be usable in this environment
(fixtures are refused in production), no sync may be running, and the database must
not hold another source's products. The sync then runs in the background with the same
CatalogueSyncService the CLI uses; its progress is read from catalogue_sync_runs.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated

import structlog
from fastapi import Depends
from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from backend.app.core.config import ConfigProvider, get_config_provider
from backend.app.db.session import get_db, get_engine
from backend.app.integrations.oriflame import get_catalogue_source
from backend.app.integrations.oriflame.catalogue import CatalogueSyncService, MixedSourcesError
from backend.app.integrations.oriflame.client import CatalogueSource, SourceError
from backend.app.models import AdminUser, CatalogueSyncRun
from backend.app.repositories import sync_runs
from backend.app.repositories.products import other_sources_present
from backend.app.repositories.sync_runs import SyncAlreadyRunningError
from backend.app.services import audit

logger = structlog.get_logger(__name__)

SyncRunner = Callable[[CatalogueSource], None]


class SyncRefusedError(Exception):
    """The sync cannot start; the message is safe to show the admin."""


@dataclass(frozen=True)
class StartedSync:
    source: str


def run_sync_in_background(engine: Engine) -> SyncRunner:
    """The real runner: one CatalogueSyncService run; failures are recorded and logged."""

    def run(source: CatalogueSource) -> None:
        service = CatalogueSyncService(
            engine, sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
        )
        try:
            report = service.run(source)
            logger.info("admin_sync_finished", run_id=report.run_id, status=report.status.value)
        except (SyncAlreadyRunningError, MixedSourcesError, SQLAlchemyError) as exc:
            logger.error("admin_sync_not_run", error=type(exc).__name__)

    return run


class AdminSyncService:
    def __init__(self, session: Session, engine: Engine, config: ConfigProvider) -> None:
        self._session = session
        self._engine = engine
        self._config = config

    def runs(self, *, page: int, page_size: int) -> tuple[list[CatalogueSyncRun], int]:
        return sync_runs.page_runs(self._session, page=page, page_size=page_size)

    def last_success_at(self) -> datetime | None:
        return sync_runs.last_success_at(self._session)

    def prepare(self, admin: AdminUser) -> CatalogueSource:
        """Check the sync can start and audit the request; raises SyncRefusedError."""
        try:
            source = get_catalogue_source(self._config.get_settings())
        except SourceError as exc:
            raise SyncRefusedError(str(exc)) from exc
        if not sync_runs.sync_lock_available(self._engine):
            raise SyncRefusedError("A catalogue sync is already running. Wait for it to finish.")
        others = other_sources_present(self._session, source.name)
        if others:
            raise SyncRefusedError(str(MixedSourcesError(source.name, others)))
        audit.record(
            self._session,
            audit.CATALOGUE_SYNC_STARTED,
            admin_user_id=admin.id,
            target_type="catalogue_source",
            target_id=source.name,
        )
        self._session.commit()
        return source


def get_admin_sync_service(
    db: Annotated[Session, Depends(get_db)],
    engine: Annotated[Engine, Depends(get_engine)],
    config: Annotated[ConfigProvider, Depends(get_config_provider)],
) -> AdminSyncService:
    return AdminSyncService(db, engine, config)


def get_sync_runner(engine: Annotated[Engine, Depends(get_engine)]) -> SyncRunner:
    return run_sync_in_background(engine)
