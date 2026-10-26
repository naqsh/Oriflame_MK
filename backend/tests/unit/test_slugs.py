"""Deterministic slug strategy (OR-011)."""

import pytest

from backend.app.models.catalogue import SLUG_MAX_LENGTH
from backend.app.services.slugs import FALLBACK_BASE, resolve_slug, slugify


@pytest.mark.parametrize(
    "text, expected",
    [
        ("Peach Glow Perfector", "peach-glow-perfector"),
        ("  Crème   Brûlée!! ", "creme-brulee"),
        ("Hand & Body -- Lotion", "hand-body-lotion"),
        ("اوریفلیم", ""),
        ("", ""),
    ],
)
def test_slugify(text: str, expected: str) -> None:
    assert slugify(text) == expected


def test_free_slug_is_used_as_is() -> None:
    assert resolve_slug("Peach Glow", "39292", taken=set()) == "peach-glow"


def test_collision_gets_source_id_suffix() -> None:
    assert resolve_slug("Peach Glow", "39292", taken={"peach-glow"}) == "peach-glow-39292"


def test_suffix_is_independent_of_sync_order() -> None:
    """Whichever product arrives second, each colliding row gets its own source suffix."""
    first_then_second = resolve_slug("Lip Balm", "B-2", taken={"lip-balm"})
    other_order = resolve_slug("Lip Balm", "B-2", taken={"lip-balm", "lip-balm-a-1"})
    assert first_then_second == other_order == "lip-balm-b-2"


def test_numeric_fallback_when_suffixed_slug_is_also_taken() -> None:
    taken = {"lip-balm", "lip-balm-7", "lip-balm-7-2"}
    assert resolve_slug("Lip Balm", "7", taken=taken) == "lip-balm-7-3"


def test_unusable_name_and_source_id_fall_back() -> None:
    assert resolve_slug("!!!", "###", taken=set()) == FALLBACK_BASE
    assert resolve_slug("!!!", "###", taken={FALLBACK_BASE}) == f"{FALLBACK_BASE}-{FALLBACK_BASE}"


def test_long_names_are_truncated_and_keep_the_suffix() -> None:
    name = "word " * 100
    plain = resolve_slug(name, "39292", taken=set())
    suffixed = resolve_slug(name, "39292", taken={plain})
    assert len(plain) <= SLUG_MAX_LENGTH
    assert len(suffixed) <= SLUG_MAX_LENGTH
    assert suffixed.endswith("-39292")
    assert not plain.endswith("-")
