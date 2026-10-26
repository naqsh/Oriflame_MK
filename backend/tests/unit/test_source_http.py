"""FeedHttpClient against mocked HTTP (OR-013). No test touches the network."""

from collections.abc import Callable, Iterator

import httpx
import pytest

from backend.app.integrations.oriflame.client import (
    SourceAuthError,
    SourceError,
    SourceMalformedError,
    SourcePageError,
    SourceRateLimitedError,
    SourceUnavailableError,
)
from backend.app.integrations.oriflame.http import (
    CONNECT_TIMEOUT_SECONDS,
    READ_TIMEOUT_SECONDS,
    FeedHttpClient,
)

BASE_URL = "https://feed.example.test"
Handler = Callable[[httpx.Request], httpx.Response]


class Recorder:
    """Scripted responses; records requests and sleeps."""

    def __init__(self, *responses: httpx.Response | Exception) -> None:
        self._responses = list(responses)
        self.requests: list[httpx.Request] = []
        self.sleeps: list[float] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    def client(self, **kwargs: float | int) -> FeedHttpClient:
        return FeedHttpClient(
            BASE_URL,
            transport=httpx.MockTransport(self),
            sleep=self.sleeps.append,
            **kwargs,  # type: ignore[arg-type]
        )


def _json(body: object, status: int = 200) -> httpx.Response:
    return httpx.Response(status, json=body)


@pytest.fixture
def ok() -> Iterator[Recorder]:
    yield Recorder(_json({"items": [{"source_id": "p1"}], "next_page": None}))


def test_parses_json_and_sends_identifying_headers(ok: Recorder) -> None:
    with ok.client() as client:
        body = client.get_json("/products", params={"page": 1})

    assert body == {"items": [{"source_id": "p1"}], "next_page": None}
    request = ok.requests[0]
    assert str(request.url) == f"{BASE_URL}/products?page=1"
    assert request.headers["Accept"] == "application/json"
    assert "OriflameMK" in request.headers["User-Agent"]
    assert ok.sleeps == []


def test_every_request_has_explicit_timeouts(ok: Recorder) -> None:
    with ok.client() as client:
        client.get_json("/products")
    timeout = ok.requests[0].extensions["timeout"]
    assert timeout["connect"] == CONNECT_TIMEOUT_SECONDS
    assert timeout["read"] == READ_TIMEOUT_SECONDS


def test_timeout_is_retried_with_backoff_then_succeeds() -> None:
    recorder = Recorder(httpx.ReadTimeout("slow"), httpx.ReadTimeout("slow"), _json({"ok": 1}))
    with recorder.client(backoff_base_seconds=1.0) as client:
        assert client.get_json("/products") == {"ok": 1}
    assert recorder.sleeps == [1.0, 2.0]


@pytest.mark.parametrize(
    "failure",
    [httpx.ReadTimeout("slow"), httpx.ConnectError("refused"), _json({}, status=503)],
    ids=["timeout", "connect-error", "5xx"],
)
def test_persistent_failure_gives_up_after_bounded_retries(
    failure: httpx.Response | Exception,
) -> None:
    recorder = Recorder(*[failure] * 3)
    with recorder.client(max_retries=2) as client, pytest.raises(SourceUnavailableError):
        client.get_json("/products")
    assert len(recorder.requests) == 3
    assert recorder.sleeps == [1.0, 2.0]


@pytest.mark.parametrize("status", [401, 403])
def test_auth_failure_stops_immediately(status: int) -> None:
    recorder = Recorder(_json({}, status=status))
    with recorder.client() as client, pytest.raises(SourceAuthError, match="not retrying"):
        client.get_json("/products")
    assert len(recorder.requests) == 1
    assert recorder.sleeps == []


def test_429_honours_retry_after() -> None:
    limited = httpx.Response(429, headers={"Retry-After": "7"})
    recorder = Recorder(limited, _json({"ok": 1}))
    with recorder.client() as client:
        assert client.get_json("/products") == {"ok": 1}
    assert recorder.sleeps == [7.0]


def test_429_without_usable_retry_after_falls_back_to_backoff() -> None:
    limited = httpx.Response(429, headers={"Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT"})
    recorder = Recorder(limited, _json({"ok": 1}))
    with recorder.client(backoff_base_seconds=2.0) as client:
        client.get_json("/products")
    assert recorder.sleeps == [2.0]


def test_429_beyond_the_wait_budget_fails() -> None:
    limited = httpx.Response(429, headers={"Retry-After": "30"})
    recorder = Recorder(limited, limited, limited)
    with (
        recorder.client(retry_after_budget_seconds=45) as client,
        pytest.raises(SourceRateLimitedError, match="rate limited"),
    ):
        client.get_json("/products")
    assert recorder.sleeps == [30.0]  # the second wait would exceed the budget


def test_malformed_json_is_reported() -> None:
    recorder = Recorder(httpx.Response(200, text="<html>not json</html>"))
    with recorder.client() as client, pytest.raises(SourceMalformedError, match="valid JSON"):
        client.get_json("/products")


@pytest.mark.parametrize("status", [302, 404])
def test_other_statuses_fail_without_retry(status: int) -> None:
    recorder = Recorder(httpx.Response(status, headers={"Location": "https://elsewhere.test"}))
    with recorder.client() as client, pytest.raises(SourceError, match=str(status)):
        client.get_json("/products")
    assert len(recorder.requests) == 1  # redirects are not followed


def test_error_messages_never_include_query_strings() -> None:
    recorder = Recorder(_json({}, status=403))
    with recorder.client() as client, pytest.raises(SourceAuthError) as caught:
        client.get_json("/products", params={"token": "s3cret-value"})
    assert "s3cret-value" not in str(caught.value)


# --- Pagination ----------------------------------------------------------------------


def test_iter_pages_follows_next_page() -> None:
    recorder = Recorder(
        _json({"items": [1, 2], "next_page": 2}),
        _json({"items": [3], "next_page": None}),
    )
    with recorder.client() as client:
        assert list(client.iter_pages("/products")) == [[1, 2], [3]]
    assert [r.url.params["page"] for r in recorder.requests] == ["1", "2"]


def test_failure_on_a_later_page_is_a_partial_page_error() -> None:
    recorder = Recorder(_json({"items": [1], "next_page": 2}), *[_json({}, status=500)] * 2)
    with recorder.client(max_retries=1) as client:
        pages = client.iter_pages("/products")
        assert next(pages) == [1]
        with pytest.raises(SourcePageError) as caught:
            next(pages)
    assert caught.value.page == 2
    assert isinstance(caught.value.cause, SourceUnavailableError)


def test_failure_on_the_first_page_is_raised_as_is() -> None:
    recorder = Recorder(_json({"no_items": True}))
    with recorder.client() as client, pytest.raises(SourceMalformedError, match="items"):
        list(client.iter_pages("/products"))


def test_auth_failure_on_a_later_page_is_never_softened_to_partial() -> None:
    recorder = Recorder(_json({"items": [1], "next_page": 2}), _json({}, status=401))
    with recorder.client() as client, pytest.raises(SourceAuthError):
        list(client.iter_pages("/products"))


@pytest.mark.parametrize("next_page", [1, "2", 0])
def test_non_advancing_next_page_is_malformed(next_page: object) -> None:
    recorder = Recorder(_json({"items": [], "next_page": next_page}))
    with recorder.client() as client, pytest.raises(SourceMalformedError, match="next_page"):
        list(client.iter_pages("/products"))
