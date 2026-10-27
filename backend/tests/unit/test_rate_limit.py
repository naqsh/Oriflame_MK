"""In-memory rate limiter (OR-032)."""

from backend.app.core.rate_limit import RateLimiter


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
