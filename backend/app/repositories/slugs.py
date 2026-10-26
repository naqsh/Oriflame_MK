"""Slug lookups shared by the product and category repositories."""

from sqlalchemy import exists, select
from sqlalchemy.orm import InstrumentedAttribute, Session

from backend.app.services.slugs import resolve_slug


class _TakenSlugs:
    """Container that asks the database whether another source row holds a slug."""

    def __init__(
        self,
        session: Session,
        source_id: str,
        slug_column: InstrumentedAttribute[str],
        source_id_column: InstrumentedAttribute[str],
    ) -> None:
        self._session = session
        self._source_id = source_id
        self._slug = slug_column
        self._source = source_id_column

    def __contains__(self, slug: object) -> bool:
        query = select(exists().where(self._slug == slug, self._source != self._source_id))
        return bool(self._session.scalar(query))


def new_slug(
    session: Session,
    *,
    name: str,
    source_id: str,
    slug_column: InstrumentedAttribute[str],
    source_id_column: InstrumentedAttribute[str],
) -> str:
    """Slug for a row that does not exist yet. Existing rows keep their slug."""
    taken = _TakenSlugs(session, source_id, slug_column, source_id_column)
    return resolve_slug(name, source_id, taken)
