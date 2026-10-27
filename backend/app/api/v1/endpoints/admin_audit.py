"""GET /api/v1/admin/audit-logs (OR-046): newest first, paginated. No logic here."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from backend.app.schemas.admin import AuditEntry, AuditPage, Page
from backend.app.services.audit import AuditService, get_audit_service

router = APIRouter(tags=["admin"])


@router.get("/audit-logs", response_model=AuditPage)
def audit_logs(
    params: Annotated[Page, Query()],
    response: Response,
    service: Annotated[AuditService, Depends(get_audit_service)],
) -> AuditPage:
    response.headers["Cache-Control"] = "no-store"
    rows, total = service.recent(page=params.page, page_size=params.page_size)
    return AuditPage(
        items=[AuditEntry.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )
