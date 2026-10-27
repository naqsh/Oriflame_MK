"""Referral handoff models (OR-030, OR-032). A discriminated union on ``method``."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

ReferralStatus = Literal["configured", "not_configured", "invalid"]
HandoffOrigin = Literal["pdp", "list", "referral_page"]


class OfficialUrlHandoff(BaseModel):
    method: Literal["official_url"] = "official_url"
    url: str
    note: str


class ManualCodeHandoff(BaseModel):
    method: Literal["manual_code"] = "manual_code"
    code: str
    instructions: list[str]
    checkout_url: str


class UnavailableHandoff(BaseModel):
    method: Literal["unavailable"] = "unavailable"
    reason: Literal["not_configured", "invalid"]
    message: str
    # The official site's homepage (no referral), so visitors can still buy there.
    fallback_url: str


ReferralHandoff = Annotated[
    OfficialUrlHandoff | ManualCodeHandoff | UnavailableHandoff, Field(discriminator="method")
]


class HandoffRequest(BaseModel):
    """Body of POST /api/v1/referral/handoff. The client never supplies a destination."""

    model_config = ConfigDict(extra="forbid")

    origin: HandoffOrigin
    product_slug: str | None = Field(default=None, max_length=200)
    item_count: int = Field(default=0, ge=0, le=200)
