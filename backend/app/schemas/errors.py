"""Shared error response models."""

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str
