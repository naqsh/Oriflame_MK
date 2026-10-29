"""Development fixture source (ADR-001: the only source until one is permitted).

The whole file is read and checked before anything is yielded, so a missing or
malformed file fails cleanly with no partial load. Refuses to load in production.
"""

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from pydantic import BaseModel

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
# Every category in the fixture file uses this prefix (remove-fixtures relies on it).
FIXTURE_CATEGORY_PREFIX = "dev-cat-"
FIXTURE_NOTICE_PREFIX = "Development fixture"
# Explicitly named development fixture (OR-015 provides the file).
BACKEND_DIR = Path(__file__).resolve().parents[3]
DEFAULT_FIXTURE_PATH = BACKEND_DIR / "fixtures" / "dev_catalogue_sample.json"


class FixturesForbiddenError(SourceError):
    def __init__(self) -> None:
        super().__init__("Development fixtures cannot be loaded when APP_ENV=production.")


class FixtureCatalogueSource:
    """Reads a development fixture file: ``fixture_notice``, ``categories``, ``products``.

    Strict, unlike a live source: one invalid record rejects the whole file, so a
    fixture is either loaded completely or not at all.
    """

    def __init__(self, path: Path, *, app_env: AppEnv) -> None:
        if app_env == "production":
            raise FixturesForbiddenError
        categories, products = _load(path)
        self._categories = _all_valid(path, SourceCategory, categories)
        self._products = _all_valid(path, SourceProduct, products)

    @property
    def name(self) -> str:
        return FIXTURE_SOURCE_NAME

    def iter_categories(self) -> Iterator[SourceCategory | InvalidRecord]:
        yield from self._categories

    def iter_products(self) -> Iterator[SourceProduct | InvalidRecord]:
        yield from self._products


def _all_valid[RecordT: BaseModel](
    path: Path, model: type[RecordT], payloads: list[Any]
) -> list[RecordT]:
    valid: list[RecordT] = []
    problems: list[str] = []
    for item in parse_records(model, payloads):
        if isinstance(item, InvalidRecord):
            problems.append(f"{item.source_id or '(no source_id)'}: {item.problems}")
        else:
            valid.append(item)
    if problems:
        shown = "; ".join(problems[:5])
        raise SourceMalformedError(
            f"Fixture file {path.name} has {len(problems)} invalid record(s): {shown}"
        )
    return valid


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
    notice = document.get("fixture_notice")
    if not isinstance(notice, str) or not notice.startswith(FIXTURE_NOTICE_PREFIX):
        raise SourceMalformedError(
            f"Fixture file {path.name} lacks a 'fixture_notice' starting with "
            f"'{FIXTURE_NOTICE_PREFIX}'; refusing to load it as development data"
        )
    return sections[0], sections[1]
