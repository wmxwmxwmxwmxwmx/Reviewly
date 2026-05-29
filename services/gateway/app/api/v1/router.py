from fastapi import APIRouter

from app.api.v1 import ai, data, placeholders

api_router = APIRouter()
api_router.include_router(ai.router)
api_router.include_router(data.router)
api_router.include_router(placeholders.router)
