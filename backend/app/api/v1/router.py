"""Aggregates the /api/v1 endpoint routers (admin arrives in OR-E6)."""

from fastapi import APIRouter

from backend.app.api.v1.endpoints import categories, products, referral, search

api_router = APIRouter()
api_router.include_router(products.router)
api_router.include_router(categories.router)
api_router.include_router(search.router)
api_router.include_router(referral.router)
