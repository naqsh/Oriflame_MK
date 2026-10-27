"""POST /api/v1/referral/handoff against real PostgreSQL (OR-032)."""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from structlog.testing import capture_logs

from backend.app.api.v1.endpoints import referral as referral_endpoint
from backend.app.core.config import EnvConfigProvider, get_config_provider, load_settings
from backend.app.models import Product, ReferralClick
from backend.app.services import referral as referral_service

pytestmark = pytest.mark.db

URL = "/api/v1/referral/handoff"
REFERRAL_URL = "https://pk.oriflame.com/join?ref=abc"
FAKE_CODE = "TESTCODE-0000"


@pytest.fixture(autouse=True)
def fresh_limiter() -> Iterator[None]:
    referral_endpoint.handoff_limiter.reset()
    yield
    referral_endpoint.handoff_limiter.reset()


@pytest.fixture
def api(db_app: FastAPI) -> Iterator[TestClient]:
    # Read the referral settings at request time, after each test sets its environment.
    db_app.dependency_overrides[get_config_provider] = lambda: EnvConfigProvider(load_settings())
    with TestClient(db_app, raise_server_exceptions=False) as client:
        yield client


@pytest.fixture
def product(db_session: Session) -> Product:
    item = Product(
        source_id="src-1",
        source="dev_fixture",
        slug="sample-product-01",
        name="Sample Product 01",
        source_url="http://localhost:3000/dev-fixture/products/src-1",
        last_synced_at=datetime(2026, 10, 26, tzinfo=UTC),
    )
    db_session.add(item)
    db_session.flush()
    return item


def _clicks(session: Session) -> list[ReferralClick]:
    session.expire_all()
    return list(session.scalars(select(ReferralClick).order_by(ReferralClick.id)))


def _post(api: TestClient, body: dict[str, Any], **headers: str) -> Any:
    return api.post(URL, json=body, headers=headers or None)


def test_not_configured_returns_restricted_mode_and_records_the_click(
    api: TestClient, db_session: Session, product: Product
) -> None:
    response = _post(api, {"origin": "pdp", "product_slug": "sample-product-01", "item_count": 1})

    assert response.status_code == status.HTTP_200_OK
    assert response.headers["Cache-Control"] == "no-store"
    body = response.json()
    assert body["method"] == "unavailable"
    assert body["reason"] == "not_configured"
    assert body["fallback_url"] == "https://pk.oriflame.com/"
    [click] = _clicks(db_session)
    assert (click.method, click.origin, click.product_slug, click.item_count) == (
        "unavailable",
        "pdp",
        "sample-product-01",
        1,
    )


def test_official_url_variant(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORIFLAME_REFERRAL_URL", REFERRAL_URL)

    body = _post(api, {"origin": "referral_page"}).json()

    assert body["method"] == "official_url"
    assert body["url"] == REFERRAL_URL
    assert "Oriflame" in body["note"]


def test_manual_code_variant(
    api: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ORIFLAME_REFERRAL_METHOD", "manual_code")
    monkeypatch.setenv("ORIFLAME_CONSULTANT_CODE", FAKE_CODE)

    body = _post(api, {"origin": "list", "item_count": 4}).json()

    assert body["method"] == "manual_code"
    assert body["code"] == FAKE_CODE
    assert body["checkout_url"] == "https://pk.oriflame.com/"
    assert len(body["instructions"]) == 3
    [click] = _clicks(db_session)
    assert (click.method, click.origin, click.item_count) == ("manual_code", "list", 4)


@pytest.mark.parametrize(
    "body",
    [
        {"origin": "pdp", "url": "https://evil.example.com"},
        {"origin": "pdp", "destination": "https://evil.example.com"},
        {"origin": "pdp", "item_count": 201},
        {"origin": "pdp", "item_count": -1},
        {"origin": "newsletter"},
        {},
        {"origin": "pdp", "product_slug": "x" * 201},
    ],
    ids=["url", "destination", "too-many", "negative", "bad-origin", "empty", "long-slug"],
)
def test_invalid_bodies_are_rejected_and_not_recorded(
    api: TestClient, db_session: Session, body: dict[str, Any]
) -> None:
    assert _post(api, body).status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert _clicks(db_session) == []


@pytest.mark.parametrize("slug", ["no-such-product", "Bad_Slug!", "../etc"])
def test_unknown_or_malformed_slug_is_stored_as_null(
    api: TestClient, db_session: Session, slug: str
) -> None:
    response = _post(api, {"origin": "pdp", "product_slug": slug})

    assert response.status_code == status.HTTP_200_OK
    assert [click.product_slug for click in _clicks(db_session)] == [None]


def test_failure_to_record_still_returns_the_handoff(
    api: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken(*_: object, **__: object) -> None:
        raise OperationalError("INSERT ...", {}, Exception("connection lost"))

    monkeypatch.setattr(referral_service, "record", broken)
    with capture_logs() as logs:
        response = _post(api, {"origin": "pdp"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["method"] == "unavailable"
    warnings = [log for log in logs if log["event"] == "referral_click_not_recorded"]
    assert [(log["error_type"], log["log_level"]) for log in warnings] == [
        ("OperationalError", "warning")
    ]


@pytest.mark.parametrize(
    "agent",
    ["Googlebot/2.1", "Mozilla/5.0 (compatible; bingbot/2.0)", "curl/8.4", "HeadlessChrome"],
)
def test_bots_get_the_handoff_but_are_not_counted(
    api: TestClient, db_session: Session, agent: str
) -> None:
    response = _post(api, {"origin": "pdp"}, **{"User-Agent": agent})

    assert response.status_code == status.HTTP_200_OK
    assert _clicks(db_session) == []


def test_each_call_records_one_click(api: TestClient, db_session: Session) -> None:
    for _ in range(3):
        _post(api, {"origin": "referral_page"})
    count = db_session.scalar(select(func.count()).select_from(ReferralClick))
    assert count == 3


def test_rate_limit_answers_429_with_retry_after(
    api: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(referral_endpoint.handoff_limiter, "limit", 2)

    statuses = [_post(api, {"origin": "pdp"}).status_code for _ in range(3)]

    assert statuses == [200, 200, 429]
    limited = _post(api, {"origin": "pdp"})
    assert limited.json() == {"detail": "Too many requests. Please try again shortly."}
    assert int(limited.headers["Retry-After"]) >= 1


def test_get_is_not_allowed(api: TestClient) -> None:
    assert api.get(URL).status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.parametrize(
    "env, method",
    [
        ({}, "unavailable"),
        ({"ORIFLAME_REFERRAL_URL": REFERRAL_URL}, "official_url"),
        (
            {"ORIFLAME_REFERRAL_METHOD": "manual_code", "ORIFLAME_CONSULTANT_CODE": FAKE_CODE},
            "manual_code",
        ),
    ],
)
def test_mode_reveals_only_the_method_and_records_nothing(
    api: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    env: dict[str, str],
    method: str,
) -> None:
    for name, value in env.items():
        monkeypatch.setenv(name, value)

    response = api.get("/api/v1/referral/mode")

    assert response.json() == {"method": method}
    assert response.headers["Cache-Control"] == "no-store"
    assert FAKE_CODE not in response.text
    assert "join?ref" not in response.text
    assert _clicks(db_session) == []
