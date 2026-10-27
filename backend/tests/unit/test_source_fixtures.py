"""Fixture catalogue source, record parsing and source selection (OR-013, OR-015)."""

import json
import re
from pathlib import Path

import pytest

import backend.app.integrations.oriflame as integration
from backend.app.core.config import load_settings
from backend.app.integrations.oriflame import get_catalogue_source
from backend.app.integrations.oriflame.client import (
    InvalidRecord,
    SourceError,
    SourceMalformedError,
    SourceProduct,
    parse_records,
)
from backend.app.integrations.oriflame.fixtures import (
    DEFAULT_FIXTURE_PATH,
    FIXTURE_SOURCE_NAME,
    FixtureCatalogueSource,
    FixturesForbiddenError,
)

INTEGRATION_DIR = Path(integration.__file__).parent

VALID_PRODUCT = {
    "source_id": "dev-001",
    "name": "Sample Product 01",
    "source_url": "http://localhost:3000/dev-fixture/dev-001",
    "category_source_ids": ["dev-cat-1"],
}


NOTICE = "Development fixture - test data"
SAMPLE = json.loads(DEFAULT_FIXTURE_PATH.read_text(encoding="utf-8"))


def _write(tmp_path: Path, document: object) -> Path:
    """Write a fixture file; dicts get the required fixture_notice unless they set one."""
    if isinstance(document, dict):
        document = {"fixture_notice": NOTICE, **document}
    path = tmp_path / "dev_catalogue_test.json"
    path.write_text(json.dumps(document), encoding="utf-8")
    return path


def test_fixture_source_yields_validated_records(tmp_path: Path) -> None:
    path = _write(
        tmp_path,
        {
            "categories": [{"source_id": "dev-cat-1", "name": "Sample Category"}],
            "products": [VALID_PRODUCT],
        },
    )
    source = FixtureCatalogueSource(path, app_env="development")

    assert source.name == FIXTURE_SOURCE_NAME
    [category] = list(source.iter_categories())
    [product] = list(source.iter_products())
    assert not isinstance(category, InvalidRecord)
    assert isinstance(product, SourceProduct)
    assert product.price_pkr is None  # nothing invented for missing fields
    assert product.images == ()


def test_invalid_payloads_are_reported_without_input_values() -> None:
    secretish = "do-not-echo-this-value"
    payloads = [
        {"name": "No id", "source_url": "http://localhost:3000/x"},
        {**VALID_PRODUCT, "source_id": "dev-002", "source_url": secretish},
        VALID_PRODUCT,
    ]

    missing_id, bad_url, valid = list(parse_records(SourceProduct, payloads))

    assert isinstance(missing_id, InvalidRecord)
    assert missing_id.source_id is None
    assert "source_id" in missing_id.problems
    assert isinstance(bad_url, InvalidRecord)
    assert bad_url.source_id == "dev-002"
    assert secretish not in bad_url.problems
    assert isinstance(valid, SourceProduct)


def test_one_invalid_fixture_record_rejects_the_whole_file(tmp_path: Path) -> None:
    secretish = "do-not-echo-this-value"
    path = _write(
        tmp_path,
        {"products": [VALID_PRODUCT, {**VALID_PRODUCT, "source_id": "dev-2", "x": secretish}]},
    )
    with pytest.raises(SourceMalformedError, match=r"1 invalid record\(s\): dev-2") as caught:
        FixtureCatalogueSource(path, app_env="development")
    assert secretish not in str(caught.value)


@pytest.mark.parametrize(
    "notice", [None, "", "Live catalogue"], ids=["missing", "empty", "wrong-prefix"]
)
def test_file_without_a_fixture_notice_is_refused(tmp_path: Path, notice: str | None) -> None:
    document: dict[str, object] = {"products": [VALID_PRODUCT]}
    if notice is not None:
        document["fixture_notice"] = notice
    path = tmp_path / "dev_catalogue_unmarked.json"
    path.write_text(json.dumps(document), encoding="utf-8")
    with pytest.raises(SourceMalformedError, match="fixture_notice"):
        FixtureCatalogueSource(path, app_env="development")


def test_production_refuses_fixtures(tmp_path: Path) -> None:
    path = _write(tmp_path, {"products": [VALID_PRODUCT]})
    with pytest.raises(FixturesForbiddenError, match="APP_ENV=production"):
        FixtureCatalogueSource(path, app_env="production")


def test_missing_fixture_file_is_a_clear_error(tmp_path: Path) -> None:
    with pytest.raises(SourceError, match=r"not found: missing.json"):
        FixtureCatalogueSource(tmp_path / "missing.json", app_env="development")


@pytest.mark.parametrize(
    "content, message",
    [
        ("{not json", "not valid JSON"),
        ("[]", "JSON object"),
        ('{"products": {"a": 1}}', "'products' must be a list"),
        ('{"categories": "x"}', "'categories' must be a list"),
    ],
)
def test_malformed_fixture_file_fails_before_any_record(
    tmp_path: Path, content: str, message: str
) -> None:
    path = tmp_path / "dev_catalogue_bad.json"
    path.write_text(content, encoding="utf-8")
    with pytest.raises(SourceMalformedError, match=message):
        FixtureCatalogueSource(path, app_env="development")


def test_parse_records_handles_non_mapping_payloads() -> None:
    [result] = list(parse_records(SourceProduct, ["just a string"]))
    assert isinstance(result, InvalidRecord)
    assert result.source_id is None


def test_get_catalogue_source_uses_the_configured_fixture(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(integration, "DEFAULT_FIXTURE_PATH", _write(tmp_path, {}))
    source = get_catalogue_source(load_settings())
    assert source.name == FIXTURE_SOURCE_NAME


def test_get_catalogue_source_refuses_fixtures_in_production(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(integration, "DEFAULT_FIXTURE_PATH", _write(tmp_path, {}))
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://store.example.pk")  # required in production
    with pytest.raises(FixturesForbiddenError):
        get_catalogue_source(load_settings())


def test_integration_code_never_targets_oriflame_hosts() -> None:
    """ADR-001: no ingestion from pk.oriflame.com until written permission exists."""
    offenders = [
        path.name
        for path in INTEGRATION_DIR.glob("*.py")
        if "oriflame.com" in path.read_text(encoding="utf-8").lower()
    ]
    assert offenders == []


# --- The shipped sample fixture (OR-015) -------------------------------------------


def test_sample_fixture_is_named_and_marked_as_development_data() -> None:
    assert "dev" in DEFAULT_FIXTURE_PATH.name
    assert "sample" in DEFAULT_FIXTURE_PATH.name
    assert SAMPLE["fixture_notice"].startswith("Development fixture")
    assert "not live Oriflame data" in SAMPLE["fixture_notice"]


def test_sample_fixture_loads_completely() -> None:
    source = FixtureCatalogueSource(DEFAULT_FIXTURE_PATH, app_env="development")
    assert source.name == "dev_fixture"
    assert len(list(source.iter_products())) == len(SAMPLE["products"]) == 12
    assert len(list(source.iter_categories())) == len(SAMPLE["categories"]) == 3


def test_sample_fixture_refuses_production() -> None:
    with pytest.raises(FixturesForbiddenError):
        FixtureCatalogueSource(DEFAULT_FIXTURE_PATH, app_env="production")


def test_sample_fixture_contains_only_placeholders() -> None:
    """Grep-style guard: no real Oriflame names, SKUs, hosts or image URLs."""
    raw = DEFAULT_FIXTURE_PATH.read_text(encoding="utf-8").lower()
    for forbidden in ("oriflame.com", "media-cdn", "productimage", "https://"):
        assert forbidden not in raw
    for product in SAMPLE["products"]:
        assert re.fullmatch(r"Sample Product \d{2}", product["name"])
        assert re.fullmatch(r"DEV-\d{4}", product["sku"])
        assert re.fullmatch(r"dev-sample-\d{2}", product["source_id"])
        urls = [product["source_url"]] + [
            url for image in product["images"] for url in (image["url"], image["source_url"])
        ]
        assert all(url.startswith("http://localhost:3000/dev-fixture/") for url in urls)
    for category in SAMPLE["categories"]:
        assert category["name"].startswith("Sample Category")
