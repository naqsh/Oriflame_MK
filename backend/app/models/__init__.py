"""All models, imported here so Base.metadata is complete for Alembic."""

from backend.app.models.admin import AdminSession, AdminUser
from backend.app.models.audit import AuditLog
from backend.app.models.base import Base
from backend.app.models.catalogue import (
    CatalogueSyncRun,
    Category,
    Product,
    ProductImage,
    SyncRunStatus,
    product_categories,
)
from backend.app.models.referral import ReferralClick

__all__ = [
    "AdminSession",
    "AdminUser",
    "AuditLog",
    "Base",
    "CatalogueSyncRun",
    "Category",
    "Product",
    "ProductImage",
    "ReferralClick",
    "SyncRunStatus",
    "product_categories",
]
