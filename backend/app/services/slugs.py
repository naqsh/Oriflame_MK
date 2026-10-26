"""Deterministic slugs for catalogue rows (OR-011).

Strategy: the slug is ``slugify(name)``. If another source row already holds that
slug, the row gets ``{base}-{slugify(source_id)}``. Because source ids are unique,
the suffixed slug depends only on the row itself, never on sync order. A numeric
suffix is a last resort for pathological names that already end in another row's
source id.
"""

import re
import unicodedata
from collections.abc import Container

from backend.app.models.catalogue import SLUG_MAX_LENGTH

FALLBACK_BASE = "item"
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    """Lowercase ASCII words joined by hyphens; empty when nothing usable remains."""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return _NON_ALNUM.sub("-", ascii_text.lower()).strip("-")


def _fit(base: str, suffix: str = "") -> str:
    tail = f"-{suffix}" if suffix else ""
    return base[: SLUG_MAX_LENGTH - len(tail)].rstrip("-") + tail


def resolve_slug(name: str, source_id: str, taken: Container[str]) -> str:
    """Slug for a row, given the slugs already held by *other* source rows."""
    base = slugify(name) or FALLBACK_BASE
    candidate = _fit(base)
    if candidate not in taken:
        return candidate
    source_suffix = slugify(source_id) or FALLBACK_BASE
    candidate = _fit(base, source_suffix)
    counter = 2
    while candidate in taken:
        candidate = _fit(base, f"{source_suffix}-{counter}")
        counter += 1
    return candidate
