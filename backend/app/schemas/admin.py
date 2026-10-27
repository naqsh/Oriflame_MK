"""Admin API schemas (OR-E6)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from backend.app.core.passwords import MAX_PASSWORD_LENGTH


class AdminLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH, repr=False)


class AdminLoginResponse(BaseModel):
    token: str
    expires_at: datetime


class AdminSetupStatus(BaseModel):
    has_admin: bool


class AdminMe(BaseModel):
    email: str
    last_login_at: datetime | None


class Page(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(default=1, ge=1, le=10_000)
    page_size: int = Field(default=25, ge=1, le=100)


class AuditEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    occurred_at: datetime
    admin_user_id: int | None
    action: str
    target_type: str | None
    target_id: str | None
    details: dict[str, Any]


class AuditPage(BaseModel):
    items: list[AuditEntry]
    total: int
    page: int
    page_size: int
