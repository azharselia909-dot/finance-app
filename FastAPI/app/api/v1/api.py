from fastapi import APIRouter

from app.api.v1.endpoints.accounts import router as accounts_router
from app.api.v1.endpoints.transactions import router as transactions_router

router = APIRouter()
router.include_router(accounts_router)
router.include_router(transactions_router)
