"""SQLAlchemy engine, session factory and the get_db dependency (Supabase PostgreSQL)."""

from collections.abc import Iterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Engine, create_engine, make_url
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from backend.app.core.config import Settings, get_config_provider

# Small pool suited to Supabase connection limits.
POOL_SIZE = 5
MAX_OVERFLOW = 5
POOL_TIMEOUT_SECONDS = 5
CONNECT_TIMEOUT_SECONDS = 5

_SUPABASE_DIRECT_HOST_SUFFIX = ".supabase.co"


def create_db_engine(
    settings: Settings, *, connect_timeout_seconds: int = CONNECT_TIMEOUT_SECONDS
) -> Engine:
    return create_engine(
        settings.postgres_url.get_secret_value(),
        pool_size=POOL_SIZE,
        max_overflow=MAX_OVERFLOW,
        pool_timeout=POOL_TIMEOUT_SECONDS,
        pool_pre_ping=True,
        connect_args={"connect_timeout": connect_timeout_seconds},
    )


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Process-wide engine; a FastAPI dependency."""
    return create_db_engine(get_config_provider().get_settings())


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db(
    factory: Annotated[sessionmaker[Session], Depends(get_session_factory)],
) -> Iterator[Session]:
    """One session per request. Services commit; close() rolls back anything left open."""
    session = factory()
    try:
        yield session
    finally:
        session.close()


def describe_connection_error(exc: OperationalError, settings: Settings) -> str:
    """Actionable, URL-free explanation of a failed database connection."""
    driver_message = str(exc.orig).lower()
    if "password authentication failed" in driver_message:
        return (
            "Database authentication failed. Check the password in POSTGRES_URL: remove the "
            "[ ] from the Supabase template and URL-encode special characters."
        )
    host = (make_url(settings.postgres_url.get_secret_value()).host or "").lower()
    message = "Could not connect to the database in POSTGRES_URL."
    if host.startswith("db.") and host.endswith(_SUPABASE_DIRECT_HOST_SUFFIX):
        message += (
            " The Supabase direct host is IPv6-only; on IPv4-only networks use the "
            "Session pooler connection string (port 5432)."
        )
    return message
