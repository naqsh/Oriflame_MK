"""Oriflame catalogue integration. The only module that knows about catalogue sources."""

from backend.app.core.config import Settings
from backend.app.integrations.oriflame.client import CatalogueSource
from backend.app.integrations.oriflame.fixtures import DEFAULT_FIXTURE_PATH, FixtureCatalogueSource


def get_catalogue_source(settings: Settings) -> CatalogueSource:
    """The source named by CATALOGUE_SOURCE (validated at startup)."""
    match settings.catalogue_source:
        case "fixture":
            return FixtureCatalogueSource(DEFAULT_FIXTURE_PATH, app_env=settings.app_env)
