"""Catalogue source interface (OR-013). Replaceable: the sync only sees this Protocol.

A source yields validated records, or an ``InvalidRecord`` for a payload that failed
validation, so the sync can count per-record errors and carry on. Problems with the
source as a whole raise a ``SourceError`` subclass. Missing source fields are never
filled with invented values: they stay absent and validation decides.
"""

from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass
from typing import Any, Protocol

from pydantic import BaseModel, ValidationError

from backend.app.schemas.catalogue import CategoryRecord, ProductRecord

# Re-exported under the names the integration uses.
SourceProduct = ProductRecord
SourceCategory = CategoryRecord


class SourceError(RuntimeError):
    """The source as a whole failed. Messages never include credentials or query strings."""


class SourceAuthError(SourceError):
    """401/403: stop the run. Never retried, never worked around."""


class SourceRateLimitedError(SourceError):
    """429 beyond the Retry-After budget."""


class SourceUnavailableError(SourceError):
    """Timeouts, connection failures or 5xx after bounded retries."""


class SourceMalformedError(SourceError):
    """The source answered, but not with the expected structure."""


class SourcePageError(SourceError):
    """A later page failed after earlier pages were yielded (the run is partial)."""

    def __init__(self, page: int, cause: SourceError) -> None:
        super().__init__(f"Page {page} failed: {cause}")
        self.page = page
        self.cause = cause


@dataclass(frozen=True)
class InvalidRecord:
    """A payload that failed validation. ``problems`` never contains the input values."""

    source_id: str | None
    problems: str


class CatalogueSource(Protocol):
    """A permitted catalogue source (ADR-001)."""

    @property
    def name(self) -> str:
        """Stored on sync runs, e.g. ``dev_fixture``."""
        ...

    def iter_categories(self) -> Iterator[SourceCategory | InvalidRecord]: ...

    def iter_products(self) -> Iterator[SourceProduct | InvalidRecord]: ...


def describe_validation_error(error: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(part) for part in item['loc']) or 'record'}: {item['msg']}"
        for item in error.errors(include_input=False, include_url=False)
    )


def parse_records[RecordT: BaseModel](
    model: type[RecordT], payloads: Iterable[object]
) -> Iterator[RecordT | InvalidRecord]:
    """Validate each payload; invalid ones become InvalidRecord instead of stopping."""
    for payload in payloads:
        try:
            yield model.model_validate(payload)
        except ValidationError as exc:
            yield InvalidRecord(_source_id_of(payload), describe_validation_error(exc))


def _source_id_of(payload: object) -> str | None:
    if isinstance(payload, Mapping):
        value: Any = payload.get("source_id")
        if isinstance(value, str) and value.strip():
            return value.strip()[:100]
    return None
