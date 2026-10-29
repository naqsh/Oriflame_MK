"""Oriflame catalogue integration. The only module that knows about catalogue sources."""

from pathlib import Path

from backend.app.core.config import Settings
from backend.app.integrations.oriflame.client import CatalogueSource, SourceError
from backend.app.integrations.oriflame.csv_source import CsvCatalogueSource
from backend.app.integrations.oriflame.fixtures import (
    BACKEND_DIR,
    DEFAULT_FIXTURE_PATH,
    FixtureCatalogueSource,
)

REPO_ROOT = BACKEND_DIR.parent


def resolve_csv_path(path: Path) -> Path:
    """Relative CATALOGUE_CSV_PATH values are from the repository root, not the cwd."""
    return path if path.is_absolute() else REPO_ROOT / path


def get_catalogue_source(settings: Settings) -> CatalogueSource:
    """The source named by CATALOGUE_SOURCE (validated at startup)."""
    match settings.catalogue_source:
        case "fixture":
            return FixtureCatalogueSource(DEFAULT_FIXTURE_PATH, app_env=settings.app_env)
        case "csv":
            # Settings validation requires the path for this source; kept as a guard.
            if settings.catalogue_csv_path is None:
                raise SourceError("CATALOGUE_CSV_PATH is not set")
            return CsvCatalogueSource(resolve_csv_path(settings.catalogue_csv_path))
