"""POST /api/v1/referral/handoff (OR-032). No logic here.

The client never supplies a destination: the request body has no URL field (unknown
fields are a 422), and the destination comes only from ReferralService.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from backend.app.core.rate_limit import RateLimiter, rate_limit_dependency
from backend.app.schemas.referral import HandoffRequest, ReferralHandoff
from backend.app.services.referral import HandoffService, get_handoff_service

HANDOFF_LIMIT_PER_MINUTE = 30
handoff_limiter = RateLimiter(limit=HANDOFF_LIMIT_PER_MINUTE)

router = APIRouter(prefix="/referral", tags=["referral"])


@router.post(
    "/handoff",
    response_model=ReferralHandoff,
    dependencies=[Depends(rate_limit_dependency(handoff_limiter))],
)
def referral_handoff(
    body: HandoffRequest,
    request: Request,
    response: Response,
    service: Annotated[HandoffService, Depends(get_handoff_service)],
) -> ReferralHandoff:
    response.headers["Cache-Control"] = "no-store"
    return service.handoff(body, user_agent=request.headers.get("user-agent", ""))
