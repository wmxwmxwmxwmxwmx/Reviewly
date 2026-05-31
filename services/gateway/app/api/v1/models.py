"""Model configuration validation endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.services.ai_config import resolve_ai_config
from app.services.model_validate import validate_model_config
from app.services.provider_balance import fetch_provider_balance

router = APIRouter(prefix="/api/models", tags=["models"])


class ModelValidateBody(BaseModel):
    provider: str = Field(min_length=1)
    base_url: str | None = Field(default=None, validation_alias="baseUrl")
    api_key: str = Field(default="", validation_alias="apiKey")
    model: str = Field(min_length=1)

    model_config = {"populate_by_name": True}


class ModelBalanceBody(BaseModel):
    provider: str | None = None
    base_url: str | None = Field(default=None, validation_alias="baseUrl")
    api_key: str | None = Field(default=None, validation_alias="apiKey")

    model_config = {"populate_by_name": True}


@router.post("/validate")
async def validate_model(body: ModelValidateBody) -> dict:
    return await validate_model_config(
        provider=body.provider,
        model=body.model,
        api_key=body.api_key,
        base_url=body.base_url,
    )


@router.post("/balance")
async def model_balance(
    body: ModelBalanceBody | None = None,
    db: Session = Depends(get_db),
) -> dict:
    payload = body or ModelBalanceBody()
    provider, _model, api_key, custom_endpoint = resolve_ai_config(
        db,
        api_key_override=(payload.api_key or "").strip() or None,
        require_db_key=False,
    )
    if payload.provider and payload.provider.strip():
        provider = payload.provider.strip()
    base_url = payload.base_url or custom_endpoint
    if not api_key:
        return {"available": False, "message": "未配置 API Key"}
    return await fetch_provider_balance(
        provider=provider,
        api_key=api_key,
        base_url=base_url,
    )
