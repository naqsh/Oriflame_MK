"""Admin catalogue sync status and manual trigger (OR-047). No logic here."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status

from backend.app.core.security import CurrentAdmin
from backend.app.schemas.admin import Page, SyncRunEntry, SyncRunsPage, SyncStarted
from backend.app.services.admin_sync import (
    AdminSyncService,
    SyncRefusedError,
    SyncRunner,
    get_admin_sync_service,
    get_sync_runner,
)

router = APIRouter(tags=["admin"])

Service = Annotated[AdminSyncService, Depends(get_admin_sync_service)]


@router.get("/sync-runs", response_model=SyncRunsPage)
def sync_runs(
    params: Annotated[Page, Query()], response: Response, service: Service
) -> SyncRunsPage:
    response.headers["Cache-Control"] = "no-store"
    rows, total = service.runs(page=params.page, page_size=params.page_size)
    return SyncRunsPage(
        items=[SyncRunEntry.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
        last_success_at=service.last_success_at(),
    )


@router.post("/sync", response_model=SyncStarted, status_code=status.HTTP_202_ACCEPTED)
def start_sync(
    admin: CurrentAdmin,
    background: BackgroundTasks,
    service: Service,
    runner: Annotated[SyncRunner, Depends(get_sync_runner)],
) -> SyncStarted:
    try:
        source = service.prepare(admin)
    except SyncRefusedError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    background.add_task(runner, source)
    return SyncStarted(source=source.name)
