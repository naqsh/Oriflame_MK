"""Unit tests for typed settings and the ConfigProvider (OR-002)."""

from pathlib import Path

import pytest

from backend.app.core.config import (
    ConfigProvider,
    ConfigurationError,
    EnvConfigProvider,
    ReferralConfig,
    Settings,
    get_config_provider,
    get_settings,
    load_settings,
    normalise_postgres_url,
)

# The autouse clean_env fixture in conftest.py sets POSTGRES_URL to LOCAL_DB.
LOCAL_DB = "postgresql://localhost:5432/app"
SUPABASE_DB = "postgresql://postgres.abcdefgh@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
FAKE_CODE = "TEST-CODE-123456"


def test_valid_config_loads_with_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CORS_ORIGINS")
    monkeypatch.delenv("APP_ENV")

    settings = load_settings()

    assert settings.postgres_url.get_secret_value() == "postgresql+psycopg://localhost:5432/app"
    assert settings.app_env == "development"
    assert settings.cors_origins == []
    assert settings.oriflame_country == "PK"
    assert settings.oriflame_referral_method == "official_url"


def test_empty_referral_values_allowed_in_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORIFLAME_CONSULTANT_CODE", "")
    monkeypatch.setenv("ORIFLAME_REFERRAL_URL", "")

    referral = load_settings().referral

    assert referral.consultant_code is None
    assert referral.referral_url is None
    assert referral.is_configured is False


def test_production_with_empty_referral_config_reports_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")

    settings = load_settings()

    assert settings.app_env == "production"
    assert settings.referral.is_configured is False


def test_dotenv_file_is_read(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("POSTGRES_URL")
    (tmp_path / ".env").write_text(f"POSTGRES_URL={LOCAL_DB}\nAPP_ENV=test\n", encoding="utf-8")

    assert load_settings().app_env == "test"


@pytest.mark.parametrize(
    "raw",
    [
        "http://localhost:3000, https://shop.example.test",
        '["http://localhost:3000", "https://shop.example.test"]',
    ],
)
def test_cors_origins_accepts_csv_and_json(monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
    monkeypatch.setenv("CORS_ORIGINS", raw)

    assert load_settings().cors_origins == ["http://localhost:3000", "https://shop.example.test"]


def test_official_referral_url_on_allowed_host(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORIFLAME_REFERRAL_URL", "https://pk.oriflame.com/")

    referral = load_settings().referral

    assert referral.referral_url is not None
    assert referral.referral_url.host == "pk.oriflame.com"
    assert referral.is_configured is True


@pytest.mark.parametrize(
    "url",
    [
        "http://pk.oriflame.com/",
        "https://www.oriflame.com/",
        "https://evil-oriflame.com/",
        "https://pk.oriflame.com.evil.test/",
        "https://user:secret@pk.oriflame.com/",
    ],
)
def test_referral_url_rejected_unless_https_and_allow_listed(
    monkeypatch: pytest.MonkeyPatch, url: str
) -> None:
    monkeypatch.setenv("ORIFLAME_REFERRAL_URL", url)

    with pytest.raises(ConfigurationError, match="ORIFLAME_REFERRAL_URL"):
        load_settings()


def test_manual_code_requires_consultant_code(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORIFLAME_REFERRAL_METHOD", "manual_code")

    with pytest.raises(ConfigurationError, match="requires ORIFLAME_CONSULTANT_CODE"):
        load_settings()


def test_manual_code_with_consultant_code_is_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORIFLAME_REFERRAL_METHOD", "manual_code")
    monkeypatch.setenv("ORIFLAME_CONSULTANT_CODE", FAKE_CODE)

    referral = load_settings().referral

    assert referral.method == "manual_code"
    assert referral.is_configured is True


def test_unknown_referral_method_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORIFLAME_REFERRAL_METHOD", "append_to_any_url")

    with pytest.raises(ConfigurationError, match="ORIFLAME_REFERRAL_METHOD"):
        load_settings()


def test_consultant_code_never_in_repr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORIFLAME_CONSULTANT_CODE", FAKE_CODE)

    settings = load_settings()

    for text in (
        repr(settings),
        str(settings),
        repr(settings.referral),
        settings.model_dump_json(),
    ):
        assert FAKE_CODE not in text
    assert settings.oriflame_consultant_code is not None
    assert settings.oriflame_consultant_code.get_secret_value() == FAKE_CODE


def test_missing_postgres_url_fails_fast(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("POSTGRES_URL")

    with pytest.raises(ConfigurationError, match="POSTGRES_URL"):
        load_settings()


@pytest.mark.parametrize(
    "url",
    [
        "postgresql://postgres.abc:[s3cr3t-pass]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
        "postgresql://postgres.abc:s3cr3t-pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
        "mysql://root:s3cr3t-pass@localhost/app",
    ],
)
def test_invalid_postgres_url_error_never_contains_secret(
    monkeypatch: pytest.MonkeyPatch, url: str
) -> None:
    monkeypatch.setenv("POSTGRES_URL", url)

    with pytest.raises(ConfigurationError) as excinfo:
        load_settings()

    message = str(excinfo.value)
    assert "POSTGRES_URL" in message
    assert "s3cr3t-pass" not in message
    assert excinfo.value.__cause__ is None


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+psycopg"])
def test_postgres_scheme_normalised(scheme: str) -> None:
    assert normalise_postgres_url(f"{scheme}://localhost:5432/app") == (
        "postgresql+psycopg://localhost:5432/app"
    )


def test_supabase_host_gets_sslmode_require() -> None:
    url = normalise_postgres_url(SUPABASE_DB + "?sslmode=disable&application_name=store")

    assert url.startswith("postgresql+psycopg://")
    assert "sslmode=require" in url
    assert "sslmode=disable" not in url
    assert "application_name=store" in url


def test_non_supabase_host_keeps_query() -> None:
    assert normalise_postgres_url(LOCAL_DB) == "postgresql+psycopg://localhost:5432/app"


def test_settings_are_cached_once() -> None:
    assert get_settings() is get_settings()


def test_services_resolve_config_through_provider() -> None:
    """Single-vendor config flows only through the ConfigProvider interface."""
    provider: ConfigProvider = get_config_provider()

    assert isinstance(provider, EnvConfigProvider)
    assert provider.get_settings() is get_settings()
    assert isinstance(provider.get_referral_config(), ReferralConfig)


def test_provider_can_be_replaced_with_explicit_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORIFLAME_REFERRAL_URL", "https://pk.oriflame.com/join")
    custom = Settings()

    provider: ConfigProvider = EnvConfigProvider(custom)

    assert provider.get_settings() is custom
    assert provider.get_referral_config().is_configured is True
