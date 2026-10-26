"""SQLAlchemy engine for the Supabase PostgreSQL database.

OR-003 needs only the engine (for the readiness check); OR-004 adds the session
factory and the get_db dependency here.
"""

from functools import lru_cache

from sqlalchemy import Engine, create_engine

from backend.app.core.config import Settings, get_config_provider

# Small pool suited to Supabase connection limits.
POOL_SIZE = 5
MAX_OVERFLOW = 5
POOL_TIMEOUT_SECONDS = 5
CONNECT_TIMEOUT_SECONDS = 5


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
