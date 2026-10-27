"""Small in-memory, per-client rate limiter (OR-032; shared with OR-E6).

Fixed one-minute windows keyed by the client address. The address is used only to
count requests in memory and is never logged or stored. Limits are per process: with
several workers, each enforces its own limit (documented in backend/AGENT.md).
Behind a proxy, set TRUSTED_PROXIES: X-Forwarded-For is honoured only when the direct
peer is one of them, so a client cannot spoof its address (OR-050).
"""

import threading
import time
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from backend.app.core.config import ConfigProvider, get_config_provider


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


def client_address(request: Request, trusted_proxies: list[str]) -> str:
    """The client's address. X-Forwarded-For is used only from a trusted proxy, and then
    the right-most address that is not itself a trusted proxy is taken (the left part of
    the header is client-controlled)."""
    peer = request.client.host if request.client else "unknown"
    if peer not in trusted_proxies:
        return peer
    forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",")]
    for address in reversed([part for part in forwarded if part]):
        if address not in trusted_proxies:
            return address
    return peer


def rate_limit_dependency(limiter: RateLimiter) -> Callable[..., None]:
    """A FastAPI dependency answering 429 (with Retry-After) once a client is over limit."""

    def check(
        request: Request, config: Annotated[ConfigProvider, Depends(get_config_provider)]
    ) -> None:
        key = client_address(request, config.get_settings().trusted_proxies)
        if not limiter.allow(key):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again shortly.",
                headers={"Retry-After": str(limiter.retry_after(key))},
            )

    return check
