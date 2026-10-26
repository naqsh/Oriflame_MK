"""Development fixture source (ADR-001: the only source until one is permitted).

The whole file is read and checked before anything is yielded, so a missing or
malformed file fails cleanly with no partial load. Refuses to load in production.
"""

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from backend.app.core.config import AppEnv
from backend.app.integrations.oriflame.client import (
    InvalidRecord,
    SourceCategory,
    SourceError,
    SourceMalformedError,
    SourceProduct,
    parse_records,
)

FIXTURE_SOURCE_NAME = "dev_fixture"
# Explicitly named development fixture (OR-015 provides the file).
BACKEND_DIR = Path(__file__).resolve().parents[3]
DEFAULT_FIXTURE_PATH = BACKEND_DIR / "fixtures" / "dev_catalogue_sample.json"


class FixturesForbiddenError(SourceError):
    def __init__(self) -> None:
        super().__init__("Development fixtures cannot be loaded when APP_ENV=production.")


class FixtureCatalogueSource:
    """Reads ``{"categories": [...], "products": [...]}`` from a development fixture file."""

    def __init__(self, path: Path, *, app_env: AppEnv) -> None:
        if app_env == "production":
            raise FixturesForbiddenError
        self._categories, self._products = _load(path)

    @property
    def name(self) -> str:
        return FIXTURE_SOURCE_NAME

    def iter_categories(self) -> Iterator[SourceCategory | InvalidRecord]:
        return parse_records(SourceCategory, self._categories)

    def iter_products(self) -> Iterator[SourceProduct | InvalidRecord]:
        return parse_records(SourceProduct, self._products)


def _load(path: Path) -> tuple[list[Any], list[Any]]:
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SourceError(f"Fixture file not found: {path.name}") from None
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SourceMalformedError(f"Fixture file {path.name} is not valid JSON: {exc}") from None
    if not isinstance(document, dict):
        raise SourceMalformedError(f"Fixture file {path.name} must contain a JSON object")
    sections = []
    for key in ("categories", "products"):
        section = document.get(key, [])
        if not isinstance(section, list):
            raise SourceMalformedError(f"Fixture file {path.name}: '{key}' must be a list")
        sections.append(section)
    return sections[0], sections[1]
