"""Admin API schemas (OR-E6)."""

from datetime import datetime

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
