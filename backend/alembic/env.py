"""Alembic environment: URL from typed Settings, never from alembic.ini.

Failures exit non-zero with a message that never includes POSTGRES_URL. PostgreSQL
DDL is transactional, so a failed upgrade leaves no partial schema.
"""

import sys
from logging.config import fileConfig

from alembic import context
from alembic.runtime.environment import NameFilterParentNames, NameFilterType
from sqlalchemy import create_engine, pool
from sqlalchemy.exc import OperationalError

from backend.app.core.config import ConfigurationError, Settings, load_settings
from backend.app.db.session import CONNECT_TIMEOUT_SECONDS, describe_connection_error
from backend.app.models import Base

# Schemas Supabase manages; autogenerate must never try to create or drop them.
SUPABASE_MANAGED_SCHEMAS = frozenset(
    {
        "auth",
        "storage",
        "realtime",
        "extensions",
        "graphql",
        "graphql_public",
        "vault",
        "pgbouncer",
        "pgsodium",
        "pgsodium_masks",
        "net",
        "cron",
    }
)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def include_name(
    name: str | None, type_: NameFilterType, parent_names: NameFilterParentNames
) -> bool:
    if type_ == "schema" and name is not None:
        return name not in SUPABASE_MANAGED_SCHEMAS and not name.startswith("supabase_")
    return True


def _settings() -> Settings:
    try:
        return load_settings()
    except ConfigurationError as exc:
        sys.exit(str(exc))


def run_migrations_offline() -> None:
    """Emit SQL to stdout without connecting (``alembic upgrade head --sql``)."""
    context.configure(
        url=_settings().postgres_url.get_secret_value(),
        target_metadata=target_metadata,
        include_name=include_name,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    settings = _settings()
    engine = create_engine(
        settings.postgres_url.get_secret_value(),
        poolclass=pool.NullPool,
        connect_args={"connect_timeout": CONNECT_TIMEOUT_SECONDS},
    )
    try:
        with engine.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                include_name=include_name,
                compare_type=True,
            )
            with context.begin_transaction():
                context.run_migrations()
    except OperationalError as exc:
        sys.exit(describe_connection_error(exc, settings))
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
