"""Aggregates the /api/v1 endpoint routers (referral and admin arrive in later epics)."""

from fastapi import APIRouter

from backend.app.api.v1.endpoints import categories, products, search

api_router = APIRouter()
api_router.include_router(products.router)
api_router.include_router(categories.router)
api_router.include_router(search.router)
