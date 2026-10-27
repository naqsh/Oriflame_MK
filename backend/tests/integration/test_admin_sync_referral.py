"""Admin sync status/trigger (OR-047) and referral status/clicks (OR-049) on PostgreSQL."""

from collections.abc import Iterator
from datetime import UTC, date, datetime

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session
from structlog.testing import capture_logs

from backend.app.core.config import ReferralConfig, get_config_provider
from backend.app.core.passwords import hash_password
from backend.app.core.security import require_admin
from backend.app.db.session import get_engine
from backend.app.integrations.oriflame.client import CatalogueSource
from backend.app.integrations.oriflame.fixtures import FixturesForbiddenError
from backend.app.models import (
    AdminUser,
    AuditLog,
    CatalogueSyncRun,
    Product,
    ReferralClick,
    SyncRunStatus,
)
from backend.app.repositories import admin_users
from backend.app.repositories.sync_runs import SyncAlreadyRunningError, catalogue_sync_lock
from backend.app.services import admin_sync, audit
from backend.app.services.admin_referral import mask_code
from backend.app.services.admin_sync import get_sync_runner

pytestmark = pytest.mark.db


@pytest.fixture
def admin(db_session: Session) -> AdminUser:
    user = admin_users.create(
        db_session, email="owner@example.pk", password_hash=hash_password("x" * 12)
    )
    db_session.commit()
    return user


class Recorder:
    def __init__(self) -> None:
        self.sources: list[str] = []

    def __call__(self, source: CatalogueSource) -> None:
        self.sources.append(source.name)


@pytest.fixture
def runner() -> Recorder:
    return Recorder()


@pytest.fixture
def api(
    db_app: FastAPI, admin: AdminUser, migrated_engine: Engine, runner: Recorder
) -> Iterator[TestClient]:
    db_app.dependency_overrides[require_admin] = lambda: admin
    db_app.dependency_overrides[get_engine] = lambda: migrated_engine
    db_app.dependency_overrides[get_sync_runner] = lambda: runner
    with TestClient(db_app, raise_server_exceptions=False) as client:
        yield client


def run_row(
    source: str, status_: SyncRunStatus, started: datetime, **kw: object
) -> CatalogueSyncRun:
    return CatalogueSyncRun(source=source, status=status_, started_at=started, **kw)


class TestSync:
    def test_lists_runs_newest_first_with_last_success(
        self, api: TestClient, db_session: Session
    ) -> None:
        finished = datetime(2026, 10, 26, 9, 5, tzinfo=UTC)
        db_session.add_all(
            [
                run_row(
                    "dev_fixture",
                    SyncRunStatus.SUCCESS,
                    datetime(2026, 10, 26, 9, tzinfo=UTC),
                    finished_at=finished,
                    created_count=12,
                ),
                run_row(
                    "dev_fixture",
                    SyncRunStatus.FAILED,
                    datetime(2026, 10, 27, 9, tzinfo=UTC),
                    error_detail="Source unreachable",
                ),
            ]
        )
        db_session.commit()

        body = api.get("/api/v1/admin/sync-runs").json()

        assert [item["status"] for item in body["items"]] == ["failed", "success"]
        assert body["items"][0]["error_detail"] == "Source unreachable"
        assert body["items"][1]["created_count"] == 12
        assert datetime.fromisoformat(body["last_success_at"]) == finished
        assert body["total"] == 2

    def test_trigger_starts_a_background_sync_and_audits_it(
        self, api: TestClient, runner: Recorder, admin: AdminUser, db_session: Session
    ) -> None:
        response = api.post("/api/v1/admin/sync")

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.json() == {"status": "started", "source": "dev_fixture"}
        assert runner.sources == ["dev_fixture"]
        rows = db_session.scalars(select(AuditLog)).all()
        assert [(r.action, r.admin_user_id, r.target_id) for r in rows] == [
            (audit.CATALOGUE_SYNC_STARTED, admin.id, "dev_fixture")
        ]

    def test_trigger_while_a_sync_runs_is_refused(
        self, api: TestClient, runner: Recorder, migrated_engine: Engine, db_session: Session
    ) -> None:
        with catalogue_sync_lock(migrated_engine):
            response = api.post("/api/v1/admin/sync")

        assert response.status_code == status.HTTP_409_CONFLICT
        assert "already running" in response.json()["detail"]
        assert runner.sources == []
        assert db_session.scalars(select(AuditLog)).all() == []

    def test_fixture_source_in_production_is_refused(
        self, api: TestClient, runner: Recorder, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def forbidden(settings: object) -> CatalogueSource:
            raise FixturesForbiddenError

        monkeypatch.setattr(admin_sync, "get_catalogue_source", forbidden)
        response = api.post("/api/v1/admin/sync")

        assert response.status_code == status.HTTP_409_CONFLICT
        assert "cannot be loaded when APP_ENV=production" in response.json()["detail"]
        assert runner.sources == []

    def test_mixed_sources_are_refused(
        self, api: TestClient, runner: Recorder, db_session: Session
    ) -> None:
        db_session.add(
            Product(
                source_id="real-1",
                source="official_feed",
                slug="real-product",
                name="Real Product",
                source_url="https://pk.oriflame.com/p/1",
                last_synced_at=datetime(2026, 10, 26, tzinfo=UTC),
            )
        )
        db_session.commit()

        response = api.post("/api/v1/admin/sync")

        assert response.status_code == status.HTTP_409_CONFLICT
        assert "official_feed" in response.json()["detail"]
        assert runner.sources == []


class FakeConfig:
    def __init__(self, referral: ReferralConfig) -> None:
        self.referral = referral

    def get_referral_config(self) -> ReferralConfig:
        return self.referral

    def get_settings(self) -> object:  # unused by these endpoints
        raise NotImplementedError


def use_referral(app: FastAPI, **values: object) -> None:
    referral = ReferralConfig(country="PK", **values)  # type: ignore[arg-type]
    app.dependency_overrides[get_config_provider] = lambda: FakeConfig(referral)


class TestReferral:
    def test_mask_code(self) -> None:
        assert mask_code("TESTCODE-0042") == "•••••••••••42"
        assert mask_code("ABCD") == "••••"

    def test_manual_code_is_masked(self, api: TestClient, db_app: FastAPI) -> None:
        use_referral(
            db_app,
            method="manual_code",
            consultant_code=SecretStr("TESTCODE-0042"),
            referral_url=None,
        )
        response = api.get("/api/v1/admin/referral-status")

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "configured"
        assert body["masked_code"].endswith("42")
        assert "TESTCODE" not in response.text
        assert body["managed_by"] == "Deployment environment settings"

    def test_official_url_shows_only_the_host(self, api: TestClient, db_app: FastAPI) -> None:
        use_referral(
            db_app,
            method="official_url",
            consultant_code=None,
            referral_url="https://pk.oriflame.com/join?ref=abc",
        )
        body = api.get("/api/v1/admin/referral-status").json()
        assert body == {
            "method": "official_url",
            "status": "configured",
            "referral_host": "pk.oriflame.com",
            "masked_code": None,
            "managed_by": "Deployment environment settings",
        }

    def test_missing_settings_report_not_configured(self, api: TestClient, db_app: FastAPI) -> None:
        use_referral(db_app, method="official_url", consultant_code=None, referral_url=None)
        assert api.get("/api/v1/admin/referral-status").json()["status"] == "not_configured"

    def test_click_totals_match_stored_clicks(self, api: TestClient, db_session: Session) -> None:
        # 2026-10-26 20:00 UTC is 2026-10-27 01:00 in Pakistan.
        for when, method, origin in [
            (datetime(2026, 10, 26, 10, tzinfo=UTC), "official_url", "pdp"),
            (datetime(2026, 10, 26, 20, tzinfo=UTC), "official_url", "list"),
            (datetime(2026, 10, 27, 5, tzinfo=UTC), "manual_code", "pdp"),
        ]:
            db_session.add(ReferralClick(occurred_at=when, method=method, origin=origin))
        db_session.commit()

        body = api.get(
            "/api/v1/admin/referral-clicks", params={"from": "2026-10-26", "to": "2026-10-27"}
        ).json()

        assert body["total"] == 3
        assert body["by_origin"] == {"pdp": 2, "list": 1}
        assert body["days"] == [
            {"day": "2026-10-26", "total": 1, "by_method": {"official_url": 1}},
            {"day": "2026-10-27", "total": 2, "by_method": {"official_url": 1, "manual_code": 1}},
        ]

    @pytest.mark.parametrize(
        "params",
        [{"from": "2026-10-27", "to": "2026-10-01"}, {"from": "2025-01-01", "to": "2026-10-27"}],
    )
    def test_bad_ranges_are_rejected(self, api: TestClient, params: dict[str, str]) -> None:
        response = api.get("/api/v1/admin/referral-clicks", params=params)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    def test_default_range_is_the_last_30_days(self, api: TestClient) -> None:
        body = api.get("/api/v1/admin/referral-clicks").json()
        assert len(body["days"]) == 30
        assert date.fromisoformat(body["end"]) >= date(2026, 1, 1)


class TestBackgroundRunner:
    """The real runner, with the sync service replaced: outcomes are logged, never raised."""

    class FakeService:
        outcome: Exception | None = None

        def __init__(self, *args: object) -> None:
            pass

        def run(self, source: CatalogueSource) -> object:
            if self.outcome is not None:
                raise self.outcome

            class Report:
                run_id = 7
                status = SyncRunStatus.SUCCESS

            return Report()

    def test_logs_success(self, monkeypatch: pytest.MonkeyPatch, migrated_engine: Engine) -> None:
        monkeypatch.setattr(admin_sync, "CatalogueSyncService", self.FakeService)
        with capture_logs() as logs:
            admin_sync.run_sync_in_background(migrated_engine)(FakeSource())  # type: ignore[arg-type]
        assert {"event": "admin_sync_finished", "run_id": 7, "status": "success"}.items() <= logs[
            -1
        ].items()

    def test_logs_a_sync_that_could_not_run(
        self, monkeypatch: pytest.MonkeyPatch, migrated_engine: Engine
    ) -> None:
        service = self.FakeService
        monkeypatch.setattr(service, "outcome", SyncAlreadyRunningError())
        monkeypatch.setattr(admin_sync, "CatalogueSyncService", service)
        with capture_logs() as logs:
            admin_sync.run_sync_in_background(migrated_engine)(FakeSource())  # type: ignore[arg-type]
        assert logs[-1]["event"] == "admin_sync_not_run"
        assert logs[-1]["error"] == "SyncAlreadyRunningError"


class FakeSource:
    name = "dev_fixture"
