from fastapi import APIRouter

from app.api.v1.endpoints.transactions import router as transactions_router

router = APIRouter()
router.include_router(transactions_router)
