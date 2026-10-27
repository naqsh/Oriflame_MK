"""Admin login, sessions, lockout and the create-admin CLI (OR-044) on real PostgreSQL."""

import io
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from structlog.testing import capture_logs

from backend.app import cli
from backend.app.api.v1.endpoints import admin_auth as admin_auth_endpoint
from backend.app.core.passwords import hash_password, verify_password
from backend.app.models import AdminSession, AdminUser
from backend.app.repositories import admin_users
from backend.app.services.admin_auth import (
    LOCKOUT,
    MAX_FAILED_ATTEMPTS,
    SESSION_LIFETIME,
    AdminAuthService,
    get_admin_auth_service,
    hash_token,
)

pytestmark = pytest.mark.db

EMAIL = "owner@example.pk"
PASSWORD = "correct horse battery staple"  # noqa: S105 - test-only credential
LOGIN = "/api/v1/admin/login"


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


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 10, 27, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def api(db_app: FastAPI, db_session: Session, clock: Clock) -> Iterator[TestClient]:
    db_app.dependency_overrides[get_admin_auth_service] = lambda: AdminAuthService(
        db_session, clock=clock
    )
    with TestClient(db_app, raise_server_exceptions=False) as client:
        yield client


def login(api: TestClient, email: str = EMAIL, password: str = PASSWORD) -> str:
    response = api.post(LOGIN, json={"email": email, "password": password})
    assert response.status_code == status.HTTP_200_OK, response.text
    return str(response.json()["token"])


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_passwords_are_hashed_with_salt() -> None:
    first, second = hash_password(PASSWORD), hash_password(PASSWORD)
    assert first != second
    assert first.startswith("scrypt$") and PASSWORD not in first
    assert verify_password(PASSWORD, first)
    assert not verify_password("wrong", first)
    assert not verify_password(PASSWORD, "not-a-hash")


def test_login_returns_a_session_token_stored_only_as_a_hash(
    api: TestClient, admin: AdminUser, db_session: Session, clock: Clock
) -> None:
    response = api.post(LOGIN, json={"email": "Owner@Example.PK", "password": PASSWORD})

    assert response.status_code == status.HTTP_200_OK
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    token = body["token"]
    assert len(token) >= 40
    stored = db_session.scalars(select(AdminSession)).one()
    assert stored.token_hash == hash_token(token)
    assert token not in stored.token_hash
    assert stored.expires_at == clock.now + SESSION_LIFETIME
    assert datetime.fromisoformat(body["expires_at"]) == clock.now + SESSION_LIFETIME
    assert admin.last_login_at == clock.now


@pytest.mark.parametrize(
    ("email", "password"),
    [(EMAIL, "wrong password"), ("nobody@example.pk", PASSWORD)],
)
def test_failed_login_is_generic_and_never_logs_the_password(
    api: TestClient, admin: AdminUser, email: str, password: str
) -> None:
    with capture_logs() as logs:
        response = api.post(LOGIN, json={"email": email, "password": password})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {"detail": "Invalid email or password."}
    assert password not in str(logs)
    assert any(entry["event"] == "admin_login_failed" for entry in logs)


def test_inactive_admin_cannot_log_in(
    api: TestClient, admin: AdminUser, db_session: Session
) -> None:
    admin.is_active = False
    db_session.commit()
    response = api.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {"detail": "Invalid email or password."}


def test_account_locks_after_repeated_failures_then_unlocks(
    api: TestClient, admin: AdminUser, clock: Clock
) -> None:
    for _ in range(MAX_FAILED_ATTEMPTS):
        api.post(LOGIN, json={"email": EMAIL, "password": "wrong password"})

    # Locked: even the right password is refused, with the same message.
    response = api.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {"detail": "Invalid email or password."}

    clock.now += LOCKOUT + timedelta(seconds=1)
    assert api.post(LOGIN, json={"email": EMAIL, "password": PASSWORD}).status_code == 200


def test_login_is_rate_limited_per_client(api: TestClient, admin: AdminUser) -> None:
    for _ in range(admin_auth_endpoint.LOGIN_LIMIT_PER_MINUTE):
        api.post(LOGIN, json={"email": "nobody@example.pk", "password": "x"})
    response = api.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert int(response.headers["retry-after"]) >= 1


def test_login_rejects_unknown_fields(api: TestClient, admin: AdminUser) -> None:
    response = api.post(LOGIN, json={"email": EMAIL, "password": PASSWORD, "is_active": True})
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_session_gives_access_until_it_expires(
    api: TestClient, admin: AdminUser, clock: Clock
) -> None:
    token = login(api)
    me = api.get("/api/v1/admin/me", headers=bearer(token))
    assert me.status_code == status.HTTP_200_OK
    assert me.json()["email"] == EMAIL

    clock.now += SESSION_LIFETIME
    assert api.get("/api/v1/admin/me", headers=bearer(token)).status_code == 401


def test_logout_revokes_the_session(api: TestClient, admin: AdminUser) -> None:
    token = login(api)
    assert api.post("/api/v1/admin/logout", headers=bearer(token)).status_code == 204
    assert api.get("/api/v1/admin/me", headers=bearer(token)).status_code == 401


def test_deactivating_an_admin_ends_their_sessions(
    api: TestClient, admin: AdminUser, db_session: Session
) -> None:
    token = login(api)
    admin.is_active = False
    db_session.commit()
    assert api.get("/api/v1/admin/me", headers=bearer(token)).status_code == 401


def test_setup_reports_whether_an_admin_exists(api: TestClient, db_session: Session) -> None:
    assert api.get("/api/v1/admin/setup").json() == {"has_admin": False}
    admin_users.create(db_session, email=EMAIL, password_hash=hash_password(PASSWORD))
    db_session.commit()
    assert api.get("/api/v1/admin/setup").json() == {"has_admin": True}


class TestCreateAdminCli:
    def run(self, monkeypatch: pytest.MonkeyPatch, *args: str, stdin: str) -> tuple[int, str, str]:

        monkeypatch.setattr("sys.stdin", io.StringIO(stdin))
        out, err = io.StringIO(), io.StringIO()
        code = cli.main(["create-admin", *args, "--password-stdin"], out=out, err=err)
        return code, out.getvalue(), err.getvalue()

    @pytest.fixture
    def cli_env(self, monkeypatch: pytest.MonkeyPatch, test_database_url: str) -> None:
        monkeypatch.setenv("POSTGRES_URL", test_database_url)

    def test_creates_an_admin_with_a_hashed_password(
        self, monkeypatch: pytest.MonkeyPatch, cli_env: None, migrated_engine: object
    ) -> None:
        email = "cli-owner@example.pk"
        try:
            code, out, err = self.run(monkeypatch, email, stdin=PASSWORD + "\n")
            assert (code, err) == (0, "")
            assert email in out and PASSWORD not in out

            with Session(migrated_engine) as session:  # type: ignore[arg-type]
                user = admin_users.get_by_email(session, email)
                assert user is not None
                assert verify_password(PASSWORD, user.password_hash)

            code, _, err = self.run(monkeypatch, email, stdin=PASSWORD + "\n")
            assert code == 5
            assert "already exists" in err
        finally:
            with Session(migrated_engine) as session:  # type: ignore[arg-type]
                user = admin_users.get_by_email(session, email)
                if user is not None:
                    session.delete(user)
                    session.commit()

    def test_refuses_a_short_password(self, monkeypatch: pytest.MonkeyPatch, cli_env: None) -> None:
        code, _, err = self.run(monkeypatch, "short@example.pk", stdin="short\n")
        assert code == 2
        assert "at least 12 characters" in err
