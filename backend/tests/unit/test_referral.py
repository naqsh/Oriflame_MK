"""ReferralService (OR-030, ADR-002)."""

import re

import pytest
from pydantic import HttpUrl, SecretStr

from backend.app.core.config import (
    ALLOWED_REFERRAL_HOSTS,
    ConfigurationError,
    EnvConfigProvider,
    ReferralConfig,
    Settings,
    load_settings,
    referral_url_problem,
)
from backend.app.schemas.referral import ManualCodeHandoff, OfficialUrlHandoff, UnavailableHandoff
from backend.app.services.referral import (
    MANUAL_CODE_INSTRUCTIONS,
    OFFICIAL_SITE_HOST,
    OFFICIAL_SITE_URL,
    OFFICIAL_URL_NOTE,
    UNAVAILABLE_MESSAGE,
    ReferralService,
)

REFERRAL_URL = "https://pk.oriflame.com/join?ref=abc"
FAKE_CODE = "TESTCODE-0000"


class FixedProvider:
    """A ConfigProvider that hands back a ReferralConfig as is, bypassing startup checks."""

    def __init__(self, referral: ReferralConfig) -> None:
        self._referral = referral

    def get_settings(self) -> Settings:
        raise NotImplementedError

    def get_referral_config(self) -> ReferralConfig:
        return self._referral


def _service(monkeypatch: pytest.MonkeyPatch, **env: str) -> ReferralService:
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    return ReferralService(EnvConfigProvider(load_settings()))


def test_official_url_with_valid_config_returns_the_url(monkeypatch: pytest.MonkeyPatch) -> None:
    service = _service(monkeypatch, ORIFLAME_REFERRAL_URL=REFERRAL_URL)

    handoff = service.resolve()

    assert isinstance(handoff, OfficialUrlHandoff)
    assert handoff.url == REFERRAL_URL
    assert handoff.note == OFFICIAL_URL_NOTE
    assert service.status() == "configured"


def test_manual_code_returns_code_instructions_and_the_official_site(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = _service(
        monkeypatch, ORIFLAME_REFERRAL_METHOD="manual_code", ORIFLAME_CONSULTANT_CODE=FAKE_CODE
    )

    handoff = service.resolve()

    assert isinstance(handoff, ManualCodeHandoff)
    assert handoff.code == FAKE_CODE
    assert handoff.instructions == MANUAL_CODE_INSTRUCTIONS
    assert handoff.checkout_url == OFFICIAL_SITE_URL
    assert FAKE_CODE not in handoff.checkout_url  # never appended to a URL
    assert service.status() == "configured"


def test_missing_config_is_unavailable_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    service = _service(monkeypatch)  # the owner's placeholders: everything empty

    handoff = service.resolve()

    assert handoff == UnavailableHandoff(
        reason="not_configured", message=UNAVAILABLE_MESSAGE, fallback_url=OFFICIAL_SITE_URL
    )
    assert service.status() == "not_configured"


def test_code_alone_with_official_url_method_is_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = _service(monkeypatch, ORIFLAME_CONSULTANT_CODE=FAKE_CODE)
    handoff = service.resolve()
    assert isinstance(handoff, UnavailableHandoff)
    assert FAKE_CODE not in handoff.model_dump_json()


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.example.com/ref",
        "http://pk.oriflame.com/ref",
        "https://user:pass@pk.oriflame.com/ref",
        "https://pk.oriflame.com:8443/ref",
        "https://pk.oriflame.com/ref#frag",
        "https://pk.oriflame.com.evil.com/ref",
    ],
)
def test_invalid_urls_are_unavailable_at_resolve_time(url: str) -> None:
    """Defence in depth: a config that slipped past startup checks still never leaks."""
    service = ReferralService(
        FixedProvider(
            ReferralConfig(
                country="PK", method="official_url", consultant_code=None, referral_url=HttpUrl(url)
            )
        )
    )
    handoff = service.resolve()
    assert isinstance(handoff, UnavailableHandoff)
    assert handoff.reason == "invalid"
    assert service.status() == "invalid"


@pytest.mark.parametrize(
    "url, message",
    [
        ("https://pk.oriflame.com:8443/ref", "non-default port"),
        ("https://pk.oriflame.com/ref#frag", "fragment"),
        ("https://user:pass@pk.oriflame.com/ref", "credentials"),
    ],
)
def test_startup_rejects_ports_fragments_and_credentials(
    monkeypatch: pytest.MonkeyPatch, url: str, message: str
) -> None:
    monkeypatch.setenv("ORIFLAME_REFERRAL_URL", url)
    with pytest.raises(ConfigurationError, match=message) as caught:
        load_settings()
    assert "pk.oriflame.com" not in str(caught.value)  # the URL is never echoed


def test_explicit_default_port_is_accepted() -> None:
    assert referral_url_problem("https://pk.oriflame.com:443/ref") is None
    assert referral_url_problem("https://pk.oriflame.com:notaport/x") == "has an invalid port"


def test_manual_code_without_code_from_a_provider_is_not_configured() -> None:
    service = ReferralService(
        FixedProvider(
            ReferralConfig(
                country="PK", method="manual_code", consultant_code=None, referral_url=None
            )
        )
    )
    assert service.status() == "not_configured"


def test_config_changes_are_picked_up_on_the_next_resolve() -> None:
    """Nothing is cached in the service beyond the provider's settings lifecycle."""
    provider = FixedProvider(
        ReferralConfig(country="PK", method="official_url", consultant_code=None, referral_url=None)
    )
    service = ReferralService(provider)
    assert service.status() == "not_configured"

    provider._referral = ReferralConfig(
        country="PK",
        method="manual_code",
        consultant_code=SecretStr(FAKE_CODE),
        referral_url=None,
    )
    assert service.status() == "configured"


def test_service_reads_configuration_only_through_the_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Single-vendor configuration: changing the environment alone changes nothing."""
    provider = FixedProvider(
        ReferralConfig(country="PK", method="official_url", consultant_code=None, referral_url=None)
    )
    service = ReferralService(provider)
    monkeypatch.setenv("ORIFLAME_REFERRAL_URL", REFERRAL_URL)
    assert service.status() == "not_configured"


@pytest.mark.parametrize(
    "text", [OFFICIAL_URL_NOTE, UNAVAILABLE_MESSAGE, *MANUAL_CODE_INSTRUCTIONS]
)
def test_no_text_claims_or_promises_attribution(text: str) -> None:
    assert not re.search(
        r"attribut|credit|commission|guarantee|discount|official partner|endorse", text, re.I
    )


def test_fallback_site_is_an_allowed_host() -> None:
    assert OFFICIAL_SITE_HOST in ALLOWED_REFERRAL_HOSTS
    assert referral_url_problem(OFFICIAL_SITE_URL) is None
