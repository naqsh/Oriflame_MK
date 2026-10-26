"""Honest availability labels (OR-021)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from backend.app.core.config import ConfigurationError, EnvConfigProvider, load_settings
from backend.app.models import Product
from backend.app.services.availability import (
    CHECK_AT_ORIFLAME_LABEL,
    IN_STOCK_LABEL,
    NOT_CONFIRMED_LABEL,
    OUT_OF_STOCK_LABEL,
    AvailabilityPolicy,
    AvailabilitySnapshot,
    availability_for,
    describe,
)
from backend.app.services.products import get_product_service

NOW = datetime(2026, 10, 27, 12, 0, tzinfo=UTC)
POLICY = AvailabilityPolicy(max_age=timedelta(hours=24))


def _describe(snapshot: AvailabilitySnapshot | None, context: str = "list") -> dict[str, object]:
    result = describe(snapshot, context=context, policy=POLICY, now=NOW)  # type: ignore[arg-type]
    return result.model_dump()


def test_no_data_is_not_confirmed_with_context_label() -> None:
    assert _describe(None) == {
        "status": "not_confirmed",
        "label": NOT_CONFIRMED_LABEL,
        "checked_at": None,
    }
    assert _describe(None, "detail")["label"] == CHECK_AT_ORIFLAME_LABEL


@pytest.mark.parametrize(
    "in_stock, status, label",
    [
        (True, "verified_in_stock", IN_STOCK_LABEL),
        (False, "verified_out_of_stock", OUT_OF_STOCK_LABEL),
    ],
)
def test_fresh_snapshot_is_verified_with_checked_at(
    in_stock: bool, status: str, label: str
) -> None:
    checked = NOW - timedelta(hours=3)
    for context in ("list", "detail"):
        assert _describe(AvailabilitySnapshot(in_stock, checked), context) == {
            "status": status,
            "label": label,
            "checked_at": checked,
        }


@pytest.mark.parametrize(
    "checked_at",
    [
        NOW - timedelta(hours=24, seconds=1),  # just past the window
        NOW - timedelta(days=30),
        NOW + timedelta(minutes=5),  # future-dated: not trusted
        datetime(2026, 10, 27, 11, 0),  # naive: not trusted
    ],
    ids=["just-stale", "very-stale", "future", "naive"],
)
def test_untrustworthy_snapshots_are_not_confirmed(checked_at: datetime) -> None:
    result = _describe(AvailabilitySnapshot(in_stock=True, checked_at=checked_at))
    assert result["status"] == "not_confirmed"
    assert result["label"] == NOT_CONFIRMED_LABEL
    assert result["checked_at"] is None


def test_snapshot_exactly_at_the_window_edge_is_fresh() -> None:
    edge = NOW - timedelta(hours=24)
    assert _describe(AvailabilitySnapshot(True, edge))["status"] == "verified_in_stock"


def test_policy_window_is_respected() -> None:
    snapshot = AvailabilitySnapshot(True, NOW - timedelta(hours=2))
    short = AvailabilityPolicy(max_age=timedelta(hours=1))
    assert describe(snapshot, context="list", policy=short, now=NOW).status == "not_confirmed"


def test_quantities_are_never_returned() -> None:
    snapshot = AvailabilitySnapshot(True, NOW - timedelta(hours=1), quantity=4187)
    result = describe(snapshot, context="detail", policy=POLICY, now=NOW)
    assert set(result.model_dump()) == {"status", "label", "checked_at"}
    assert "4187" not in result.model_dump_json()


@pytest.mark.parametrize(
    "label", [NOT_CONFIRMED_LABEL, CHECK_AT_ORIFLAME_LABEL, IN_STOCK_LABEL, OUT_OF_STOCK_LABEL]
)
def test_labels_never_imply_real_time_stock(label: str) -> None:
    lowered = label.lower()
    for word in ("now", "live", "real-time", "realtime", "currently", "guaranteed", "left"):
        assert word not in lowered.split()


def test_products_are_not_confirmed_while_no_source_provides_availability() -> None:
    product = Product(source_id="p1", name="Sample", slug="sample")
    assert availability_for(product).status == "not_confirmed"
    assert availability_for(product, "detail").label == CHECK_AT_ORIFLAME_LABEL


def test_max_age_setting_defaults_and_bounds(monkeypatch: pytest.MonkeyPatch) -> None:
    assert load_settings().availability_max_age_hours == 24
    for bad in ("0", "721", "abc"):
        monkeypatch.setenv("AVAILABILITY_MAX_AGE_HOURS", bad)
        with pytest.raises(ConfigurationError, match="AVAILABILITY_MAX_AGE_HOURS"):
            load_settings()


def test_product_service_uses_the_configured_window(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AVAILABILITY_MAX_AGE_HOURS", "6")
    service = get_product_service(Session(), EnvConfigProvider(load_settings()))
    assert service._policy.max_age == timedelta(hours=6)
