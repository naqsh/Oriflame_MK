"""HTTP transport for a future permitted JSON feed (OR-013).

No feed is configured: ADR-001 has not accepted a source, and no adapter calls
the Oriflame website. When one is accepted, its adapter uses this client so that the rules
below hold for every source:

- explicit connect/read timeouts on every request;
- bounded retries with exponential backoff, for idempotent GETs only (timeouts,
  connection errors, 5xx);
- 429 honours Retry-After within a total wait budget, then fails;
- 401/403 stop at once and are never retried or worked around;
- error messages name the path and status only, never query strings or credentials.
"""

import time
from collections.abc import Callable, Iterator, Mapping
from typing import Any

import httpx

from backend.app.integrations.oriflame.client import (
    SourceAuthError,
    SourceError,
    SourceMalformedError,
    SourcePageError,
    SourceRateLimitedError,
    SourceUnavailableError,
)

CONNECT_TIMEOUT_SECONDS = 5.0
READ_TIMEOUT_SECONDS = 15.0
MAX_RETRIES = 3
BACKOFF_BASE_SECONDS = 1.0
RETRY_AFTER_BUDGET_SECONDS = 60.0
USER_AGENT = "OriflameMK-catalogue-sync/0.1 (single-vendor referral store)"


class FeedHttpClient:
    def __init__(
        self,
        base_url: str,
        *,
        max_retries: int = MAX_RETRIES,
        backoff_base_seconds: float = BACKOFF_BASE_SECONDS,
        retry_after_budget_seconds: float = RETRY_AFTER_BUDGET_SECONDS,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url,
            timeout=httpx.Timeout(READ_TIMEOUT_SECONDS, connect=CONNECT_TIMEOUT_SECONDS),
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            follow_redirects=False,
            transport=transport,
        )
        self._max_retries = max_retries
        self._backoff = backoff_base_seconds
        self._retry_after_budget = retry_after_budget_seconds
        self._sleep = sleep

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "FeedHttpClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def get_json(self, path: str, params: Mapping[str, str | int] | None = None) -> Any:
        failures = 0
        waited = 0.0
        while True:
            try:
                response = self._client.get(path, params=params)
            except httpx.TimeoutException:
                failure = f"GET {path} timed out"
            except httpx.TransportError:
                failure = f"GET {path} could not connect"
            else:
                status = response.status_code
                if status in (401, 403):
                    raise SourceAuthError(f"GET {path} was refused with {status}; not retrying")
                if status == 429:
                    delay = _retry_after_seconds(response) or self._backoff_for(failures)
                    if waited + delay > self._retry_after_budget:
                        raise SourceRateLimitedError(
                            f"GET {path} still rate limited after waiting {waited:.0f}s"
                        )
                    waited += delay
                    self._sleep(delay)
                    continue
                if status >= 500:
                    failure = f"GET {path} returned {status}"
                elif status != 200:
                    raise SourceError(f"GET {path} returned {status}")
                else:
                    return _json(response, path)
            failures += 1
            if failures > self._max_retries:
                raise SourceUnavailableError(f"{failure} after {failures} attempts")
            self._sleep(self._backoff_for(failures - 1))

    def iter_pages(
        self, path: str, *, items_key: str = "items", next_key: str = "next_page"
    ) -> Iterator[list[Any]]:
        """Yield each page's items for a ``{items: [...], next_page: n | null}`` feed.

        A failure on the first page is raised as is; a later failure raises
        SourcePageError so the run can be recorded as partial.
        """
        page: int | None = 1
        while page is not None:
            try:
                body = self.get_json(path, params={"page": page})
                items = body.get(items_key) if isinstance(body, dict) else None
                if not isinstance(items, list):
                    raise SourceMalformedError(f"GET {path} page {page}: '{items_key}' missing")
                next_page = body.get(next_key)
                if next_page is not None and (not isinstance(next_page, int) or next_page <= page):
                    raise SourceMalformedError(f"GET {path} page {page}: invalid '{next_key}'")
            except SourceAuthError:
                raise
            except SourceError as exc:
                if page == 1:
                    raise
                raise SourcePageError(page, exc) from exc
            yield items
            page = next_page

    def _backoff_for(self, failures: int) -> float:
        return float(self._backoff * (2**failures))


def _retry_after_seconds(response: httpx.Response) -> float | None:
    """Retry-After as delta-seconds. HTTP-date values fall back to backoff."""
    raw = response.headers.get("Retry-After", "").strip()
    if raw.isdigit():
        return float(raw)
    return None


def _json(response: httpx.Response, path: str) -> Any:
    try:
        return response.json()
    except ValueError:
        raise SourceMalformedError(f"GET {path} did not return valid JSON") from None
