"""Typed settings behind a ConfigProvider (ADR-005).

A condensed version of backend/app/core/config.py. The rules:

- Configuration is read once, from environment variables (and a local .env in
  development); nothing else reads os.environ.
- Secrets are SecretStr, so they never appear in a repr, a log or a model_dump.
- Validation errors never echo the value (hide_input_in_errors, value-free messages).
- Services depend on the ConfigProvider protocol, so a future provider (for example a
  database-backed one) can replace the environment without touching them.
"""

from functools import lru_cache
from typing import Literal, Protocol

from pydantic import Field, SecretStr, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfigurationError(RuntimeError):
    """Startup configuration problem. The message never contains a value."""


class ExampleSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", hide_input_in_errors=True
    )

    app_env: Literal["development", "test", "production"] = "development"
    consultant_code: SecretStr | None = None
    availability_max_age_hours: int = Field(default=24, ge=1, le=720)

    @field_validator("consultant_code", mode="before")
    @classmethod
    def _blank_as_none(cls, value: object) -> object:
        # An empty placeholder in .env means "not configured", not an empty secret.
        return None if isinstance(value, str) and not value.strip() else value


def load_example_settings() -> ExampleSettings:
    try:
        return ExampleSettings()
    except ValidationError as exc:
        problems = "; ".join(
            f"{'.'.join(map(str, e['loc'])).upper()}: {e['msg']}"
            for e in exc.errors(include_input=False, include_url=False)
        )
        raise ConfigurationError(f"Invalid configuration - {problems}") from None


class ExampleConfigProvider(Protocol):
    def get_settings(self) -> ExampleSettings: ...


class EnvProvider:
    def get_settings(self) -> ExampleSettings:
        return _cached_settings()


@lru_cache(maxsize=1)
def _cached_settings() -> ExampleSettings:
    return load_example_settings()
