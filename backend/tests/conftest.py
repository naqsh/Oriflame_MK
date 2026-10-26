"""Shared fixtures: every test runs isolated from the real environment and .env file."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.core.config import get_config_provider, get_settings
from backend.app.db.session import get_engine
from backend.app.main import create_app

CONFIG_ENV_VARS = (
    "POSTGRES_URL",
    "APP_ENV",
    "CORS_ORIGINS",
    "ORIFLAME_COUNTRY",
    "ORIFLAME_CONSULTANT_CODE",
    "ORIFLAME_REFERRAL_URL",
    "ORIFLAME_REFERRAL_METHOD",
)
TEST_DB_URL = "postgresql://localhost:5432/app"
ALLOWED_ORIGIN = "http://localhost:3000"


def _clear_caches() -> None:
    get_settings.cache_clear()
    get_config_provider.cache_clear()
    get_engine.cache_clear()


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[None]:
    """Remove config variables, run from an empty directory (no .env), reset caches."""
    for name in CONFIG_ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("POSTGRES_URL", TEST_DB_URL)
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
