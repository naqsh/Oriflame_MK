"""Small in-memory, per-client rate limiter (OR-032; shared with OR-E6).

Fixed one-minute windows keyed by the client address. The address is used only to
count requests in memory and is never logged or stored. Limits are per process: with
several workers, each enforces its own limit (documented in backend/AGENT.md).
Behind a proxy, the address is the proxy's unless the server trusts forwarded headers
(revisit with OR-052 hosting).
"""

import threading
import time
from collections.abc import Callable

from fastapi import HTTPException, Request, status


class RateLimiter:
    def __init__(
        self,
        limit: int,
        window_seconds: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.limit = limit
        self.window = window_seconds
        self._clock = clock
        self._hits: dict[str, tuple[float, int]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = self._clock()
        with self._lock:
            start, count = self._hits.get(key, (now, 0))
            if now - start >= self.window:
                start, count = now, 0
            if count >= self.limit:
                self._hits[key] = (start, count)
                return False
            self._hits[key] = (start, count + 1)
            if len(self._hits) > 10_000:  # bound memory: drop expired windows
                self._hits = {k: v for k, v in self._hits.items() if now - v[0] < self.window}
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def retry_after(self, key: str) -> int:
        start, _ = self._hits.get(key, (self._clock(), 0))
        return max(1, int(self.window - (self._clock() - start)) + 1)


def rate_limit_dependency(limiter: RateLimiter) -> Callable[[Request], None]:
    """A FastAPI dependency answering 429 (with Retry-After) once a client is over limit."""

    def check(request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        if not limiter.allow(key):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again shortly.",
                headers={"Retry-After": str(limiter.retry_after(key))},
            )

    return check
