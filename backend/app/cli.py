"""Command-line entry point for one-off admin processes (OR-016).

    uv run python -m backend.app.cli sync               # the CATALOGUE_SOURCE source
    uv run python -m backend.app.cli sync --fixtures    # development fixtures (never production)
    uv run python -m backend.app.cli sync --fixtures --force-dev   # allow mixing (development)

Exit codes: 0 success or partial, 1 failed (run failed, source unusable or database
error), 2 usage or configuration error, 3 a sync is already running, 4 refused because
products from another source exist. Messages never include POSTGRES_URL or other
secrets, and no traceback is printed.
"""

import argparse
import sys
from collections.abc import Sequence
from typing import TextIO

from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from backend.app.core.config import ConfigurationError, Settings, load_settings
from backend.app.core.logging import configure_logging
from backend.app.db.session import create_db_engine, describe_connection_error
from backend.app.integrations.oriflame import get_catalogue_source
from backend.app.integrations.oriflame.catalogue import (
    CatalogueSyncService,
    MixedSourcesError,
    SyncReport,
)
from backend.app.integrations.oriflame.client import CatalogueSource, SourceError
from backend.app.integrations.oriflame.fixtures import DEFAULT_FIXTURE_PATH, FixtureCatalogueSource
from backend.app.models import SyncRunStatus
from backend.app.repositories.sync_runs import SyncAlreadyRunningError

EXIT_OK = 0
EXIT_FAILED = 1
EXIT_USAGE = 2
EXIT_ALREADY_RUNNING = 3
EXIT_MIXED_SOURCES = 4


class _UsageError(Exception):
    """Bad arguments for this environment; reported with EXIT_USAGE."""


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m backend.app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    sync = commands.add_parser("sync", help="Run one catalogue sync and print the outcome")
    sync.add_argument(
        "--fixtures",
        action="store_true",
        help="Load the development fixture file (refused when APP_ENV=production)",
    )
    sync.add_argument(
        "--force-dev",
        action="store_true",
        help="Allow syncing while another source's products exist (APP_ENV=development only)",
    )
    return parser


def _source(settings: Settings, *, fixtures: bool) -> CatalogueSource:
    if fixtures:
        if settings.app_env == "production":
            raise _UsageError("--fixtures is not allowed when APP_ENV=production.")
        return FixtureCatalogueSource(DEFAULT_FIXTURE_PATH, app_env=settings.app_env)
    return get_catalogue_source(settings)


def _print_report(report: SyncReport, out: TextIO) -> None:
    counts = report.counts
    print(f"Catalogue sync run {report.run_id}: {report.status.value}", file=out)
    print(
        f"created={counts.created} updated={counts.updated} unchanged={counts.unchanged} "
        f"errors={counts.errors} hidden={len(report.hidden_source_ids)}",
        file=out,
    )
    if report.error_detail:
        print(report.error_detail, file=out)


def _sync(args: argparse.Namespace, settings: Settings, out: TextIO, err: TextIO) -> int:
    if args.force_dev and settings.app_env != "development":
        raise _UsageError("--force-dev is only allowed when APP_ENV=development.")
    try:
        source = _source(settings, fixtures=args.fixtures)
    except SourceError as exc:
        print(f"Catalogue source unusable: {exc}", file=err)
        return EXIT_FAILED

    engine = create_db_engine(settings)
    service = CatalogueSyncService(engine, sessionmaker(bind=engine, expire_on_commit=False))
    try:
        report = service.run(source, allow_mixed_sources=args.force_dev)
    except SyncAlreadyRunningError:
        print("Catalogue sync already running; try again when it finishes.", file=err)
        return EXIT_ALREADY_RUNNING
    except MixedSourcesError as exc:
        print(f"{exc} Use --force-dev in development to override.", file=err)
        return EXIT_MIXED_SOURCES
    except OperationalError as exc:
        print(describe_connection_error(exc, settings), file=err)
        return EXIT_FAILED
    except SQLAlchemyError as exc:
        print(f"Database error ({type(exc).__name__}); see the server logs.", file=err)
        return EXIT_FAILED
    finally:
        engine.dispose()

    _print_report(report, out)
    return EXIT_FAILED if report.status is SyncRunStatus.FAILED else EXIT_OK


def main(
    argv: Sequence[str] | None = None, *, out: TextIO = sys.stdout, err: TextIO = sys.stderr
) -> int:
    args = _parser().parse_args(argv)
    try:
        settings = load_settings()
    except ConfigurationError as exc:
        print(str(exc), file=err)
        return EXIT_USAGE
    configure_logging()
    try:
        return _sync(args, settings, out, err)
    except _UsageError as exc:
        print(str(exc), file=err)
        return EXIT_USAGE


if __name__ == "__main__":
    sys.exit(main())
