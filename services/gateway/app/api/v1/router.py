from fastapi import APIRouter

from app.api.v1 import (
    ai,
    ai_usage,
    architecture,
    auth,
    data,
    domain,
    findings,
    performance_optimize,
    placeholders,
    repository_jobs,
    repos,
    security_explain,
    webhooks,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(ai.router)
api_router.include_router(ai_usage.router)
api_router.include_router(findings.router)
api_router.include_router(architecture.router)
api_router.include_router(repos.router)
api_router.include_router(repository_jobs.router)
api_router.include_router(data.router)
api_router.include_router(domain.router)
api_router.include_router(security_explain.router)
api_router.include_router(performance_optimize.router)
api_router.include_router(placeholders.router)
api_router.include_router(webhooks.router)
