"""Aggregates the /api/v1 endpoint routers."""

from fastapi import APIRouter

from backend.app.api.v1.endpoints import (
    admin,
    admin_auth,
    categories,
    products,
    referral,
    search,
)

api_router = APIRouter()
api_router.include_router(products.router)
api_router.include_router(categories.router)
api_router.include_router(search.router)
api_router.include_router(referral.router)
api_router.include_router(admin_auth.public_router)
api_router.include_router(admin.router)
