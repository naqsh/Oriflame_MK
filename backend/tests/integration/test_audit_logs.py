"""Audit logging of admin actions (OR-046) on real PostgreSQL."""

from collections.abc import Iterator

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.api.v1.endpoints import admin_auth as admin_auth_endpoint
from backend.app.core.passwords import hash_password
from backend.app.models import AdminSession, AdminUser, AuditLog
from backend.app.repositories import admin_users, audit_logs
from backend.app.services import audit
from backend.app.services.admin_auth import MAX_FAILED_ATTEMPTS, AdminAuthService

pytestmark = pytest.mark.db

EMAIL = "owner@example.pk"
PASSWORD = "correct horse battery staple"  # noqa: S105 - test-only credential
WRONG = "wrong password one"


@pytest.fixture(autouse=True)
def fresh_limiter() -> Iterator[None]:
    admin_auth_endpoint.login_limiter.reset()
    yield
    admin_auth_endpoint.login_limiter.reset()


@pytest.fixture
def admin(db_session: Session) -> AdminUser:
    user = admin_users.create(db_session, email=EMAIL, password_hash=hash_password(PASSWORD))
    db_session.commit()
    return user


@pytest.fixture
def api(db_app: FastAPI) -> Iterator[TestClient]:
    with TestClient(db_app, raise_server_exceptions=False) as client:
        yield client


def entries(db_session: Session) -> list[AuditLog]:
    return list(db_session.scalars(select(AuditLog).order_by(AuditLog.id)))


def login(api: TestClient, password: str = PASSWORD) -> TestClient:
    return api.post("/api/v1/admin/login", json={"email": EMAIL, "password": password})  # type: ignore[return-value]


def test_each_admin_action_writes_exactly_one_row(
    api: TestClient, admin: AdminUser, db_session: Session
) -> None:
    token = login(api).json()["token"]  # type: ignore[attr-defined]
    assert [(e.action, e.admin_user_id) for e in entries(db_session)] == [
        (audit.ADMIN_LOGIN, admin.id)
    ]

    api.post("/api/v1/admin/logout", headers={"Authorization": f"Bearer {token}"})
    assert [e.action for e in entries(db_session)] == [audit.ADMIN_LOGIN, audit.ADMIN_LOGOUT]


def test_failed_logins_are_audited_without_the_password(
    api: TestClient, admin: AdminUser, db_session: Session
) -> None:
    login(api, password=WRONG)
    api.post("/api/v1/admin/login", json={"email": "nobody@example.pk", "password": "guess-two"})

    rows = entries(db_session)
    assert [(e.action, e.admin_user_id, e.details) for e in rows] == [
        (audit.ADMIN_LOGIN_FAILED, admin.id, {"reason": "bad_password", "locked": False}),
        (audit.ADMIN_LOGIN_FAILED, None, {"reason": "unknown_email"}),
    ]
    stored = str([(e.details, e.target_id, e.target_type) for e in rows])
    assert WRONG not in stored and "guess-two" not in stored


def test_the_failure_that_locks_the_account_is_marked(
    api: TestClient, admin: AdminUser, db_session: Session
) -> None:
    for _ in range(MAX_FAILED_ATTEMPTS):
        login(api, password=WRONG)
    login(api)  # refused while locked

    details = [e.details for e in entries(db_session)]
    assert [d["locked"] for d in details[:MAX_FAILED_ATTEMPTS]] == [False] * (
        MAX_FAILED_ATTEMPTS - 1
    ) + [True]
    assert details[-1] == {"reason": "locked"}


@pytest.mark.parametrize(
    "details",
    [
        {"password": "x"},
        {"session_token": "x"},
        {"nested": {"consultant_code": "x"}},
        {"Authorization": "Bearer x"},
    ],
)
def test_secret_looking_details_are_refused(
    db_session: Session, details: dict[str, object]
) -> None:
    with pytest.raises(audit.UnsafeAuditDetailsError):
        audit.record(db_session, "test.action", admin_user_id=None, details=details)
    assert entries(db_session) == []


def test_an_audit_failure_rolls_the_action_back(
    admin: AdminUser, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken(*args: object, **kwargs: object) -> None:
        raise SQLAlchemyError("audit insert failed")

    monkeypatch.setattr(audit_logs, "add", broken)
    with pytest.raises(SQLAlchemyError):
        AdminAuthService(db_session).login(EMAIL, PASSWORD)
    db_session.rollback()

    # No unaudited session survives, and the login was not recorded as successful.
    assert db_session.scalars(select(AdminSession)).all() == []
    assert db_session.get(AdminUser, admin.id).last_login_at is None  # type: ignore[union-attr]


def test_audit_log_endpoint_lists_newest_first_with_pagination(
    api: TestClient, admin: AdminUser, db_session: Session
) -> None:
    for n in range(3):
        audit.record(db_session, f"test.action_{n}", admin_user_id=admin.id, target_id=str(n))
    db_session.commit()
    token = login(api).json()["token"]  # type: ignore[attr-defined]

    response = api.get(
        "/api/v1/admin/audit-logs",
        params={"page": 1, "page_size": 2},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["total"] == 4  # three test rows + this login
    assert [item["action"] for item in body["items"]] == [audit.ADMIN_LOGIN, "test.action_2"]

    bad = api.get(
        "/api/v1/admin/audit-logs",
        params={"page_size": 500},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bad.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
