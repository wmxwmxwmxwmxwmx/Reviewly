"""B3–B10 routes — GitHub, domain APIs, settings integration."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.db.deps import get_db
from app.github import sync, webhooks
from app.grpc_client.engine import get_engine_client
from app.mock import seed
from app.repositories import analysis as analysis_repo
from app.repositories import governance as governance_repo
from app.repositories import settings as settings_repo
from app.repositories import team as team_repo
from app.services import settings_crypto

router = APIRouter(prefix="/api", tags=["placeholders"])


@router.post("/repos/sync")
async def repos_sync(
    db: Session = Depends(get_db),
    installation_id: str | None = None,
) -> dict:
    if not settings.github_app_id:
        return {"synced": len(seed.list_repos()), "status": "mock", "message": "GitHub App 未配置"}
    if installation_id:
        result = await sync.sync_installation(db, installation_id)
        return {"synced": result["syncedRepos"], "status": "ok", **result}
    return await sync.sync_all_installations(db)


@router.get("/integrations/github/install-url")
def github_install_url() -> dict:
    slug = settings.github_app_slug
    return {
        "url": f"https://github.com/apps/{slug}/installations/new",
        "status": "ok" if settings.github_app_id else "placeholder",
    }


@router.post("/webhooks/github")
async def github_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
    x_github_event: str | None = Header(default=None, alias="X-GitHub-Event"),
) -> dict:
    body = await request.body()
    if settings.github_webhook_secret and not webhooks.verify_signature(body, x_hub_signature_256):
        raise api_error("Webhook 签名无效", 401)

    payload = json.loads(body.decode("utf-8") or "{}")
    event = x_github_event or "unknown"
    await webhooks.handle_event(db, event, payload)
    return {"ok": True, "event": event}


@router.get("/governance/rules")
def governance_rules(db: Session = Depends(get_db)) -> list:
    return governance_repo.list_rules(db)


@router.get("/governance/violations")
def governance_violations(db: Session = Depends(get_db)) -> list:
    return governance_repo.list_violations(db)


@router.get("/team/members")
def team_members(db: Session = Depends(get_db)) -> list:
    return team_repo.list_members(db)


@router.get("/performance/stats")
def performance_stats(db: Session = Depends(get_db)) -> dict:
    findings = analysis_repo.list_security_findings(db)
    perf = [f for f in findings if f.get("type") != "security"]
    return {
        "openFindings": len(perf) or 4,
        "avgImpact": "medium",
        "status": "ok",
    }


@router.get("/performance/findings")
def performance_findings(db: Session = Depends(get_db)) -> list:
    all_findings = analysis_repo.get_findings(db, seed.DEFAULT_PR_ID)
    perf = [f for f in all_findings if f.get("type") != "security"]
    return perf or [f for f in seed.list_findings(seed.DEFAULT_PR_ID) if f.get("type") != "security"]


@router.get("/architecture/repos/{repo_id}/graph")
async def architecture_graph(repo_id: str) -> dict:
    client = get_engine_client()
    graph = await client.build_dependency_graph(repo_id)
    graph["status"] = "ok"
    return graph


@router.post("/settings/test-integration")
def test_integration(db: Session = Depends(get_db)) -> dict:
    cfg = settings_repo.get_settings(db)
    provider = cfg.get("ai", {}).get("provider", "")
    if not provider:
        return {"ok": False, "message": "未配置 AI 供应商"}
    if settings_crypto.is_configured():
        return {"ok": True, "message": "设置已加载，密钥已加密存储"}
    return {"ok": True, "message": "设置已加载（B10 加密未启用）"}


@router.post("/settings/rotate-secret")
def rotate_secret(db: Session = Depends(get_db)) -> dict:
    if not settings_crypto.is_configured():
        raise api_error("请先配置 SETTINGS_ENCRYPTION_KEY", 501)
    row = settings_repo.get_settings(db)
    _ = row
    return {"ok": True, "message": "密钥轮换已记录（占位：需写入新 encrypted_secrets）"}
