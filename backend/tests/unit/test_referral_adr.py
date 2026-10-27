"""The referral host allow-list in code matches ADR-002 exactly (OR-029)."""

import re
from pathlib import Path

from backend.app.core.config import ALLOWED_REFERRAL_HOSTS

ADR = Path(__file__).resolve().parents[3] / "docs" / "adr" / "ADR-002-referral-method.md"


def test_allow_list_matches_adr_002() -> None:
    match = re.search(r"`ALLOWED_REFERRAL_HOSTS: ([^`]+)`", ADR.read_text(encoding="utf-8"))
    assert match, "ADR-002 must state the allow-list as `ALLOWED_REFERRAL_HOSTS: host, host`"
    documented = {host.strip() for host in match.group(1).split(",")}
    assert documented == set(ALLOWED_REFERRAL_HOSTS)
