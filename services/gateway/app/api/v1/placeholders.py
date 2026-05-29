"""B3–B10 route placeholders returning seed or 501 until fully implemented."""
from fastapi import APIRouter

from app.core.errors import api_error
from app.mock import seed

router = APIRouter(prefix="/api", tags=["placeholders"])


@router.post("/repos/sync")
def repos_sync() -> dict:
    return {"synced": len(seed.list_repos()), "status": "mock"}


@router.get("/integrations/github/install-url")
def github_install_url() -> dict:
    return {"url": "https://github.com/apps/prism-reviewly/installations/new", "status": "placeholder"}


@router.post("/webhooks/github")
def github_webhook() -> None:
    return None


@router.get("/governance/rules")
def governance_rules() -> list:
    return seed.get_governance_rules()


@router.get("/team/members")
def team_members() -> list:
    return seed.get_team_members()


@router.get("/performance/stats")
def performance_stats() -> dict:
    return {"openFindings": 4, "avgImpact": "medium", "status": "mock"}


@router.get("/performance/findings")
def performance_findings() -> list:
    return [f for f in seed.list_findings(seed.DEFAULT_PR_ID) if f.get("type") != "security"]


@router.get("/architecture/repos/{repo_id}/graph")
def architecture_graph(repo_id: str) -> dict:
    _ = repo_id
    return {"nodes": [{"id": "payment", "label": "payment-service"}], "edges": [], "status": "mock"}


@router.post("/settings/test-integration")
def test_integration() -> dict:
    return {"ok": True, "message": "集成测试占位（B10）"}


@router.post("/settings/rotate-secret")
def rotate_secret() -> dict:
    raise api_error("B10 尚未启用服务端密钥轮换", 501)
