"""Typed backend settings and the configuration-provider interface.

All configuration is read here, once, from environment variables (and a local
``.env`` file in development). Nothing else in the backend reads ``os.environ``;
services receive configuration through a ``ConfigProvider``.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal, Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    SecretStr,
    ValidationError,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Official Oriflame hosts a referral URL may point to (confirmed with the owner;
# see docs/REFERRAL.md). Exact host match only - no wildcard subdomains.
ALLOWED_REFERRAL_HOSTS: frozenset[str] = frozenset({"pk.oriflame.com"})

SUPABASE_HOST_SUFFIXES: tuple[str, ...] = (".supabase.co", ".supabase.com")
# Supabase's transaction pooler breaks Alembic and prepared statements.
TRANSACTION_POOLER_PORT = 6543
SQLALCHEMY_POSTGRES_SCHEME = "postgresql+psycopg"
_ACCEPTED_POSTGRES_SCHEMES = frozenset({"postgres", "postgresql", SQLALCHEMY_POSTGRES_SCHEME})

AppEnv = Literal["development", "test", "production"]
ReferralMethod = Literal["official_url", "manual_code"]
# Catalogue sources (ADR-001): development fixtures, or the owner's own CSV list
# (integrations/oriflame/csv_source.py). Adding one means a new name here plus an adapter.
CatalogueSourceName = Literal["fixture", "csv"]


def referral_url_problem(url: str) -> str | None:
    """Why ``url`` is not an acceptable referral destination, or None if it is.

    Shared by startup validation and ReferralService (checked again on every resolve).
    The reason never includes the URL itself.
    """
    parts = urlsplit(url)
    if parts.scheme != "https":
        return "must use https"
    try:
        port = parts.port
    except ValueError:
        return "has an invalid port"
    if parts.username or parts.password:
        return "must not contain credentials"
    if port not in (None, 443):
        return "must not use a non-default port"
    if parts.fragment:
        return "must not contain a fragment"
    if (parts.hostname or "").lower() not in ALLOWED_REFERRAL_HOSTS:
        return "host is not an allowed Oriflame host"
    return None


class ConfigurationError(RuntimeError):
    """Raised when settings are missing or invalid. Messages never include values."""


def normalise_postgres_url(raw: str) -> str:
    """Return ``raw`` with a SQLAlchemy psycopg scheme and, for Supabase, ``sslmode=require``.

    Error messages deliberately never echo the URL, which contains credentials.
    """
    try:
        parts = urlsplit(raw.strip())
        port = parts.port
    except ValueError as exc:
        raise ValueError(
            "POSTGRES_URL is malformed (remove the [ ] around the password and "
            "URL-encode special characters)"
        ) from exc
    if parts.scheme not in _ACCEPTED_POSTGRES_SCHEMES:
        raise ValueError("POSTGRES_URL must be a postgresql:// connection string")
    host = (parts.hostname or "").lower()
    if not host:
        raise ValueError("POSTGRES_URL must include a host")
    if port == TRANSACTION_POOLER_PORT:
        raise ValueError(
            "POSTGRES_URL uses the Supabase transaction pooler (port 6543); "
            "use the session pooler or direct connection on port 5432"
        )

    query = parts.query
    if host.endswith(SUPABASE_HOST_SUFFIXES):
        params = dict(parse_qsl(query, keep_blank_values=True))
        params["sslmode"] = "require"
        query = urlencode(params)
    return urlunsplit((SQLALCHEMY_POSTGRES_SCHEME, parts.netloc, parts.path, query, parts.fragment))


class ReferralConfig(BaseModel):
    """Referral settings as consumed by ReferralService (OR-E4)."""

    model_config = ConfigDict(frozen=True)

    country: str
    method: ReferralMethod
    consultant_code: SecretStr | None
    referral_url: HttpUrl | None

    @property
    def is_configured(self) -> bool:
        """True when the configured method has what it needs to hand off a visitor."""
        if self.method == "official_url":
            return self.referral_url is not None
        return self.consultant_code is not None


class Settings(BaseSettings):
    """Validated backend configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    postgres_url: SecretStr
    app_env: AppEnv = "development"
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    # Addresses of reverse proxies whose X-Forwarded-For is trusted (OR-050), e.g. the
    # Next.js server or a load balancer. Empty: the direct peer address is used.
    trusted_proxies: Annotated[list[str], NoDecode] = Field(default_factory=list)
    oriflame_country: str = Field(default="PK", pattern=r"^[A-Z]{2}$")
    oriflame_consultant_code: SecretStr | None = None
    oriflame_referral_url: HttpUrl | None = None
    oriflame_referral_method: ReferralMethod = "official_url"
    catalogue_source: CatalogueSourceName = "fixture"
    # Required when CATALOGUE_SOURCE=csv; relative paths are from the repository root.
    catalogue_csv_path: Path | None = None
    # Source availability older than this is shown as "not confirmed" (OR-021).
    availability_max_age_hours: int = Field(default=24, ge=1, le=720)

    @field_validator("postgres_url", mode="before")
    @classmethod
    def _normalise_postgres_url(cls, value: object) -> object:
        raw = value.get_secret_value() if isinstance(value, SecretStr) else value
        if isinstance(raw, str):
            return normalise_postgres_url(raw)
        return value

    @field_validator("cors_origins", "trusted_proxies", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: object) -> object:
        """Accept a JSON list or a comma-separated string."""
        if not isinstance(value, str):
            return value
        text = value.strip()
        if not text:
            return []
        if text.startswith("["):
            return json.loads(text)
        return [origin.strip() for origin in text.split(",") if origin.strip()]

    @field_validator(
        "oriflame_consultant_code", "oriflame_referral_url", "catalogue_csv_path", mode="before"
    )
    @classmethod
    def _blank_as_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("oriflame_referral_url")
    @classmethod
    def _check_referral_host(cls, value: HttpUrl | None) -> HttpUrl | None:
        if value is None:
            return None
        problem = referral_url_problem(str(value))
        if problem:
            raise ValueError(f"ORIFLAME_REFERRAL_URL {problem}")
        return value

    @model_validator(mode="after")
    def _check_catalogue_csv(self) -> "Settings":
        if self.catalogue_source == "csv" and self.catalogue_csv_path is None:
            raise ValueError("CATALOGUE_CSV_PATH must be set when CATALOGUE_SOURCE=csv")
        return self

    @model_validator(mode="after")
    def _check_production_cors(self) -> "Settings":
        """Production allows only explicit https site origins (no wildcard, no paths)."""
        if self.app_env != "production":
            return self
        if not self.cors_origins:
            raise ValueError("CORS_ORIGINS must list the site origin in production")
        for origin in self.cors_origins:
            parts = urlsplit(origin)
            if (
                origin == "*"
                or parts.scheme != "https"
                or not parts.hostname
                or parts.path not in ("", "/")
                or parts.query
                or parts.fragment
            ):
                raise ValueError(
                    "CORS_ORIGINS must contain only https origins such as https://example.pk "
                    "in production"
                )
        return self

    @model_validator(mode="after")
    def _check_referral_method(self) -> "Settings":
        if self.oriflame_referral_method == "manual_code" and self.oriflame_consultant_code is None:
            raise ValueError(
                "ORIFLAME_REFERRAL_METHOD=manual_code requires ORIFLAME_CONSULTANT_CODE"
            )
        return self

    @property
    def referral(self) -> ReferralConfig:
        return ReferralConfig(
            country=self.oriflame_country,
            method=self.oriflame_referral_method,
            consultant_code=self.oriflame_consultant_code,
            referral_url=self.oriflame_referral_url,
        )


def load_settings() -> Settings:
    """Build Settings, turning validation failures into a value-free ConfigurationError."""
    try:
        return Settings()
    except ValidationError as exc:
        problems = "; ".join(
            f"{'.'.join(str(part) for part in error['loc']).upper() or 'SETTINGS'}: {error['msg']}"
            for error in exc.errors(include_input=False, include_url=False)
        )
        raise ConfigurationError(f"Invalid configuration - {problems}") from None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Process-wide settings, loaded once."""
    return load_settings()


class ConfigProvider(Protocol):
    """Source of configuration for services. Environment variables are the MVP provider."""

    def get_settings(self) -> Settings: ...

    def get_referral_config(self) -> ReferralConfig: ...


class EnvConfigProvider:
    """ConfigProvider backed by environment variables (via the cached Settings)."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    def get_settings(self) -> Settings:
        return self._settings if self._settings is not None else get_settings()

    def get_referral_config(self) -> ReferralConfig:
        return self.get_settings().referral


@lru_cache(maxsize=1)
def get_config_provider() -> ConfigProvider:
    """FastAPI dependency: ``Depends(get_config_provider)``; override it in tests."""
    return EnvConfigProvider()
