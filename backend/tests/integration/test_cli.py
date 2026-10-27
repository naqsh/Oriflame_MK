"""Catalogue sync CLI (OR-016). Database cases use the throwaway TEST_POSTGRES_URL."""

import io
import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import Engine, text

import backend.app.cli as cli
from backend.app.cli import (
    EXIT_ALREADY_RUNNING,
    EXIT_FAILED,
    EXIT_MIXED_SOURCES,
    EXIT_OK,
    EXIT_USAGE,
    main,
)
from backend.app.repositories.sync_runs import catalogue_sync_lock

TABLES = "product_images, product_categories, products, categories, catalogue_sync_runs"
DECOY_CREDENTIAL = "decoy-credential-1234"


def _run(*argv: str) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    code = main(list(argv), out=out, err=err)
    return code, out.getvalue(), err.getvalue()


# --- No database needed ---------------------------------------------------------------


def test_invalid_configuration_exits_2_without_values(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CATALOGUE_SOURCE", "scraper")
    code, _, err = _run("sync")
    assert code == EXIT_USAGE
    assert "CATALOGUE_SOURCE" in err
    assert "scraper" not in err


def test_fixtures_rejected_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://store.example.pk")  # required in production
    code, out, err = _run("sync", "--fixtures")
    assert code == EXIT_USAGE
    assert "--fixtures is not allowed when APP_ENV=production" in err
    assert out == ""


@pytest.mark.parametrize("app_env", ["test", "production"])
def test_force_dev_only_in_development(monkeypatch: pytest.MonkeyPatch, app_env: str) -> None:
    monkeypatch.setenv("APP_ENV", app_env)
    monkeypatch.setenv("CORS_ORIGINS", "https://store.example.pk")  # valid in every env
    code, _, err = _run("sync", "--fixtures", "--force-dev")
    assert code == EXIT_USAGE
    assert "--force-dev is only allowed when APP_ENV=development" in err


def test_configured_fixture_source_refuses_production(monkeypatch: pytest.MonkeyPatch) -> None:
    """Plain `sync` in production with CATALOGUE_SOURCE=fixture fails cleanly."""
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://store.example.pk")  # required in production
    code, _, err = _run("sync")
    assert code == EXIT_FAILED
    assert "Catalogue source unusable" in err
    assert "APP_ENV=production" in err


def test_missing_command_is_a_usage_error() -> None:
    with pytest.raises(SystemExit) as caught:
        main([])
    assert caught.value.code == EXIT_USAGE


# --- Real PostgreSQL ------------------------------------------------------------------


@pytest.fixture
def database(
    migrated_engine: Engine, test_database_url: str, monkeypatch: pytest.MonkeyPatch
) -> Iterator[Engine]:
    def empty() -> None:
        with migrated_engine.begin() as connection:
            connection.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))

    monkeypatch.setenv("POSTGRES_URL", test_database_url)
    empty()
    yield migrated_engine
    empty()


@pytest.mark.db
def test_fixture_sync_succeeds_and_prints_counts(database: Engine) -> None:
    code, out, err = _run("sync", "--fixtures")

    assert code == EXIT_OK, err
    assert "Catalogue sync run 1: success" in out
    assert "created=12 updated=0 unchanged=0 errors=0 hidden=0" in out

    code, out, _ = _run("sync")  # CATALOGUE_SOURCE defaults to fixture
    assert code == EXIT_OK
    assert "Catalogue sync run 2: success" in out
    assert "unchanged=12" in out


@pytest.mark.db
def test_failed_run_exits_non_zero(
    database: Engine, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    empty_fixture = tmp_path / "dev_catalogue_empty.json"
    empty_fixture.write_text(
        json.dumps({"fixture_notice": "Development fixture - empty", "products": []}),
        encoding="utf-8",
    )
    monkeypatch.setattr(cli, "DEFAULT_FIXTURE_PATH", empty_fixture)

    code, out, _ = _run("sync", "--fixtures")

    assert code == EXIT_FAILED
    assert ": failed" in out
    assert "refusing to hide the catalogue" in out


@pytest.mark.db
def test_run_already_in_progress_exits_3(database: Engine) -> None:
    with catalogue_sync_lock(database):
        code, out, err = _run("sync", "--fixtures")
    assert code == EXIT_ALREADY_RUNNING
    assert "sync already running" in err
    assert out == ""


@pytest.mark.db
def test_mixed_sources_exit_4_unless_forced_in_development(
    database: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    with database.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO products (source_id, source, slug, name, source_url, "
                "last_synced_at) VALUES ('real-1', 'permitted_feed', 'real-1', 'Real', "
                "'https://feed.example.test/real-1', now())"
            )
        )

    code, _, err = _run("sync", "--fixtures")
    assert code == EXIT_MIXED_SOURCES
    assert "permitted_feed" in err
    assert "--force-dev" in err

    monkeypatch.setenv("APP_ENV", "development")
    code, out, _ = _run("sync", "--fixtures", "--force-dev")
    assert code == EXIT_OK
    assert "created=12" in out


@pytest.mark.db
def test_bad_credentials_exit_cleanly_without_secrets(
    database: Engine, test_database_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    url = test_database_url.replace("postgres:postgres@", f"postgres:{DECOY_CREDENTIAL}@")
    if url == test_database_url:
        pytest.fail("TEST_POSTGRES_URL must use user:password credentials for this test")
    monkeypatch.setenv("POSTGRES_URL", url)

    code, out, err = _run("sync", "--fixtures")

    assert code == EXIT_FAILED
    assert "Database authentication failed" in err
    assert DECOY_CREDENTIAL not in err + out
    assert "Traceback" not in err


@pytest.mark.db
def test_unreachable_database_exits_cleanly(
    database: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(
        "POSTGRES_URL", f"postgresql://postgres:{DECOY_CREDENTIAL}@localhost:1/postgres"
    )

    code, out, err = _run("sync", "--fixtures")

    assert code == EXIT_FAILED
    assert "Could not connect to the database in POSTGRES_URL" in err
    assert DECOY_CREDENTIAL not in err + out
