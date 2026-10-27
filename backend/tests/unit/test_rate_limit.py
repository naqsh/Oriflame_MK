"""In-memory rate limiter (OR-032)."""

import pytest
from starlette.requests import Request

from backend.app.core.rate_limit import RateLimiter, client_address


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_allows_up_to_the_limit_then_refuses() -> None:
    limiter = RateLimiter(limit=2, clock=FakeClock())
    assert [limiter.allow("a") for _ in range(3)] == [True, True, False]
    assert limiter.allow("b") is True  # per client


def test_a_new_window_starts_after_the_window_passes() -> None:
    clock = FakeClock()
    limiter = RateLimiter(limit=1, window_seconds=60, clock=clock)
    assert limiter.allow("a") is True
    assert limiter.allow("a") is False
    assert limiter.retry_after("a") == 61
    clock.now += 30
    assert limiter.retry_after("a") == 31
    clock.now += 30
    assert limiter.allow("a") is True


def test_reset_clears_counts() -> None:
    limiter = RateLimiter(limit=1, clock=FakeClock())
    limiter.allow("a")
    limiter.reset()
    assert limiter.allow("a") is True


def test_memory_is_bounded_by_dropping_expired_windows() -> None:
    clock = FakeClock()
    limiter = RateLimiter(limit=5, window_seconds=60, clock=clock)
    for n in range(10_001):
        limiter.allow(f"old-{n}")
    clock.now += 61
    limiter.allow("new")
    assert len(limiter._hits) <= 2


def _request(peer: str, forwarded: str | None = None) -> Request:
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return Request({"type": "http", "client": (peer, 1234), "headers": headers})


@pytest.mark.parametrize(
    ("peer", "forwarded", "trusted", "expected"),
    [
        # No trusted proxies: the header is ignored, so it cannot be spoofed.
        ("203.0.113.9", "1.2.3.4", [], "203.0.113.9"),
        # Untrusted peer: ignored even if proxies are configured.
        ("203.0.113.9", "1.2.3.4", ["10.0.0.5"], "203.0.113.9"),
        # Trusted proxy: the right-most address it did not add itself.
        ("10.0.0.5", "1.2.3.4", ["10.0.0.5"], "1.2.3.4"),
        ("10.0.0.5", "6.6.6.6, 1.2.3.4", ["10.0.0.5"], "1.2.3.4"),
        ("10.0.0.5", "1.2.3.4, 10.0.0.6", ["10.0.0.5", "10.0.0.6"], "1.2.3.4"),
        # Trusted proxy without a usable header: the proxy itself.
        ("10.0.0.5", None, ["10.0.0.5"], "10.0.0.5"),
        ("10.0.0.5", " , ", ["10.0.0.5"], "10.0.0.5"),
    ],
)
def test_client_address(
    peer: str, forwarded: str | None, trusted: list[str], expected: str
) -> None:
    assert client_address(_request(peer, forwarded), trusted) == expected
