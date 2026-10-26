# Idempotent Catalogue Upserts

## Summary

The catalogue sync (OR-E2) can run any number of times and always gives the same rows. PostgreSQL decides in one statement whether a product is new, changed or untouched, and the sync records each run so failures are visible and safe to retry. Reference implementation: `docs/example-code/upsert-pattern.py`.

## Technique

- **Key on the source's id, never on our own.** `products.source_id` and `categories.source_id` are unique. Every write is `INSERT ... ON CONFLICT (source_id) DO UPDATE`, so a repeated record can never create a second row.
- **Update only on a real change.** The `DO UPDATE` has `WHERE (sku, name, description, price_pkr, source_url) IS DISTINCT FROM (excluded...)`. `IS DISTINCT FROM` treats `NULL` as a value, so a price that goes from known to unknown counts as a change.
- **Tell created from updated with `xmax = 0`.** `RETURNING xmax = 0` is true only for a freshly inserted row. No row returned means the `WHERE` filtered it out, which means unchanged.
- **Separate "seen" from "changed".** An unchanged product still gets `last_synced_at` (a second `UPDATE` that sets `updated_at = updated_at`, so SQLAlchemy's `onupdate` does not fire). `updated_at` moves only when a field, image or category link changed.
- **Children in the same savepoint.** Images are replaced only when the ordered list differs. Category links are reconciled as a set difference. The whole product, with its images and links, runs in `session.begin_nested()`, so a failure rolls back only that product.
- **Never overwrite what the sync does not own.** `slug` (stable URLs), `is_visible` and `is_featured` are not in the `DO UPDATE` set.
- **Order-independent references.** Category parents are linked in a second pass. A missing category or parent is reported, never invented.
- **One sync at a time.** `pg_try_advisory_lock` on a dedicated connection, so the lock survives the batch commits on the sync's own session. A second sync fails fast instead of racing.
- **Record every run.** A `catalogue_sync_runs` row is committed as `running` before any work, and finished as `success`, `partial` or `failed` with counts and a capped, value-free `error_detail`. A `running` row found while holding the lock belongs to a dead process and is marked failed.
- **Fail safe on suspicious input.** A source with no valid products fails the run instead of hiding the catalogue. Products the source stops listing are hidden, never deleted, and only within that source.

### Pitfalls met

- `now()` is fixed for a whole transaction. Tests that check `updated_at` must backdate it first.
- An `UPDATE` on a model with `onupdate=func.now()` sets `updated_at` unless you assign it explicitly.
- `NOT IN (empty list)` is true for every row. `hide_products_missing_from` refuses an empty list.
- Code after the `try` that records failures is not protected by it. A database error while hiding once left a run stuck at `running`; the whole run body now sits inside the error handling.

## Code Reference

- `backend/app/repositories/products.py` (`upsert_product`, `hide_products_missing_from`)
- `backend/app/repositories/categories.py` (`upsert_categories`)
- `backend/app/repositories/outcomes.py` (`WAS_INSERTED`, `UpsertOutcome`)
- `backend/app/repositories/sync_runs.py` (`catalogue_sync_lock`, `fail_stale_runs`)
- `backend/app/integrations/oriflame/catalogue.py` (`CatalogueSyncService`)
- Tests: `backend/tests/integration/test_catalogue_repositories.py`, `test_catalogue_sync.py`

## Related

- [ADR-001](../adr/ADR-001-catalogue-data-source.md): catalogue data source (Proposed; development fixtures only)
- [docs/CATALOGUE-DATA.md](../CATALOGUE-DATA.md)
- OR-011 to OR-016 in `docs/jira-tickets-json/OR-E2-mvp2-catalogue-data.json`
