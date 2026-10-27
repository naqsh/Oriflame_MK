"""Admin referral status and handoff-click counts (OR-049). No logic here."""

from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from backend.app.schemas.admin import DailyClicks, ReferralClicksReport, ReferralSetupStatus
from backend.app.services.admin_referral import AdminReferralService, get_admin_referral_service

router = APIRouter(tags=["admin"])

Service = Annotated[AdminReferralService, Depends(get_admin_referral_service)]
DEFAULT_DAYS = 30
# Pakistan Standard Time is a fixed UTC+5 (no daylight saving), matching the reporting days.
PKT = timezone(timedelta(hours=5))


@router.get("/referral-status", response_model=ReferralSetupStatus)
def referral_status(response: Response, service: Service) -> ReferralSetupStatus:
    response.headers["Cache-Control"] = "no-store"
    setup = service.setup()
    return ReferralSetupStatus(
        method=setup.method,
        status=setup.status,
        referral_host=setup.referral_host,
        masked_code=setup.masked_code,
    )


@router.get("/referral-clicks", response_model=ReferralClicksReport)
def referral_clicks(
    response: Response,
    service: Service,
    start: Annotated[date | None, Query(alias="from")] = None,
    end: Annotated[date | None, Query(alias="to")] = None,
) -> ReferralClicksReport:
    response.headers["Cache-Control"] = "no-store"
    end = end or datetime.now(PKT).date()
    start = start or end - timedelta(days=DEFAULT_DAYS - 1)
    try:
        report = service.clicks(start, end)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    return ReferralClicksReport(
        start=start,
        end=end,
        total=report.total,
        by_origin=report.by_origin,
        days=[DailyClicks(day=d.day, total=d.total, by_method=d.by_method) for d in report.days],
    )
