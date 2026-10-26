"""Shared fixtures: every test runs isolated from the real environment and .env file.

Database tests (marked ``db``) use a real, throwaway PostgreSQL from TEST_POSTGRES_URL,
migrated once per session; each test runs inside a transaction that is rolled back.
"""

import os
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import httpx
import pytest
from alembic import command
from alembic.config import Config
from dotenv import dotenv_values
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, make_url, pool
from sqlalchemy.orm import Session

from backend.app.core.config import (
    SUPABASE_HOST_SUFFIXES,
    get_config_provider,
    get_settings,
    normalise_postgres_url,
)
from backend.app.db.session import get_db, get_engine, get_session_factory
from backend.app.main import create_app

REPO_ROOT = Path(__file__).resolve().parents[2]
TEST_DB_ENV = "TEST_POSTGRES_URL"
CONFIG_ENV_VARS = (
    "POSTGRES_URL",
    "APP_ENV",
    "CORS_ORIGINS",
    "ORIFLAME_COUNTRY",
    "ORIFLAME_CONSULTANT_CODE",
    "ORIFLAME_REFERRAL_URL",
    "ORIFLAME_REFERRAL_METHOD",
    "CATALOGUE_SOURCE",
    "AVAILABILITY_MAX_AGE_HOURS",
)
TEST_DB_URL = "postgresql://localhost:5432/app"
ALLOWED_ORIGIN = "http://localhost:3000"
DB_SETUP_MESSAGE = (
    f"{TEST_DB_ENV} is not set. Database tests need a throwaway PostgreSQL, e.g.\n"
    "  docker run -d --name oriflame-test-db -e POSTGRES_PASSWORD=postgres "
    "-p 54329:5432 postgres:17\n"
    f"  {TEST_DB_ENV}=postgresql://postgres:postgres@localhost:54329/postgres\n"
    "See docs/guidence/try-it-locally.md. Never use the hosted Supabase project."
)


def _clear_caches() -> None:
    get_settings.cache_clear()
    get_config_provider.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[None]:
    """Remove config variables, run from an empty directory (no .env), reset caches."""
    for name in CONFIG_ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("POSTGRES_URL", TEST_DB_URL)
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("CORS_ORIGINS", ALLOWED_ORIGIN)
    _clear_caches()
    yield
    _clear_caches()


@pytest.fixture
def app() -> FastAPI:
    return create_app()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    # raise_server_exceptions=False so 500 responses can be asserted like a real server.
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http:
        yield http


# --- Real PostgreSQL ---------------------------------------------------------------


def _env_or_dotenv(name: str) -> str | None:
    """Value from the environment, else from the repo .env file."""
    return os.environ.get(name) or dotenv_values(REPO_ROOT / ".env").get(name)


def _developer_postgres_url() -> str | None:
    """POSTGRES_URL from the environment or the repo .env (read only to compare)."""
    raw = _env_or_dotenv("POSTGRES_URL")
    if not raw:
        return None
    try:
        return normalise_postgres_url(raw)
    except ValueError:
        return None


@pytest.fixture(scope="session")
def test_database_url() -> str:
    """Normalised TEST_POSTGRES_URL; fails loudly (never skips) when unusable."""
    raw = (_env_or_dotenv(TEST_DB_ENV) or "").strip()
    if not raw:
        pytest.fail(DB_SETUP_MESSAGE, pytrace=False)
    try:
        url = normalise_postgres_url(raw)
    except ValueError as exc:
        pytest.fail(f"{TEST_DB_ENV} is invalid: {exc}", pytrace=False)
    if url == _developer_postgres_url():
        pytest.fail(
            f"{TEST_DB_ENV} equals POSTGRES_URL. Refusing to run: tests drop and recreate "
            "the schema. Point it at a throwaway database.",
            pytrace=False,
        )
    host = (make_url(url).host or "").lower()
    if host.endswith(SUPABASE_HOST_SUFFIXES):
        pytest.fail(
            f"{TEST_DB_ENV} points at a hosted Supabase project. Use a local or "
            "container PostgreSQL instead.",
            pytrace=False,
        )
    return url


def alembic_config() -> Config:
    """Repo Alembic config; env.py reads the URL from POSTGRES_URL via Settings."""
    return Config(str(REPO_ROOT / "alembic.ini"))


@pytest.fixture(scope="session")
def migrated_engine(test_database_url: str) -> Iterator[Engine]:
    """Fresh schema at head once per session."""
    previous = os.environ.get("POSTGRES_URL")
    os.environ["POSTGRES_URL"] = test_database_url
    try:
        config = alembic_config()
        command.downgrade(config, "base")
        command.upgrade(config, "head")
    finally:
        if previous is None:
            os.environ.pop("POSTGRES_URL", None)
        else:
            os.environ["POSTGRES_URL"] = previous
        _clear_caches()
    engine = create_engine(test_database_url, poolclass=pool.NullPool)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(migrated_engine: Engine) -> Iterator[Session]:
    """Session inside an outer transaction that is always rolled back."""
    connection = migrated_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def db_app(app: FastAPI, db_session: Session) -> FastAPI:
    """App whose get_db yields the rolled-back test session."""
    app.dependency_overrides[get_db] = lambda: db_session
    return app
