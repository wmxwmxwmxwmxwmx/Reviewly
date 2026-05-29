"""B5–B9 domain REST APIs."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.db.deps import get_db
from app.grpc_client.engine import get_engine_client
from app.repositories import analysis as analysis_repo
from app.repositories import architecture as architecture_repo
from app.repositories import governance as governance_repo
from app.repositories import performance as performance_repo
from app.repositories import security as security_repo
from app.repositories import team as team_repo

router = APIRouter(prefix="/api", tags=["domain"])


@router.get("/security/findings")
def security_findings_list(db: Session = Depends(get_db)) -> list:
    return security_repo.list_security_findings(db)


@router.get("/security/stats")
def security_stats(db: Session = Depends(get_db)) -> dict:
    return security_repo.get_security_stats(db)


@router.get("/security/findings/{finding_id}")
def security_finding_get(finding_id: str, db: Session = Depends(get_db)) -> dict:
    row = security_repo.get_finding(db, finding_id)
    if not row:
        raise api_error("安全发现不存在", 404)
    return row


@router.post("/security/findings")
def security_finding_create(body: dict, db: Session = Depends(get_db)) -> dict:
    return security_repo.create_finding(db, body)


@router.patch("/security/findings/{finding_id}")
def security_finding_update(finding_id: str, body: dict, db: Session = Depends(get_db)) -> dict:
    row = security_repo.update_finding(db, finding_id, body)
    if not row:
        raise api_error("安全发现不存在", 404)
    return row


@router.delete("/security/findings/{finding_id}")
def security_finding_delete(finding_id: str, db: Session = Depends(get_db)) -> dict:
    if not security_repo.delete_finding(db, finding_id):
        raise api_error("安全发现不存在", 404)
    return {"ok": True}


@router.get("/performance/stats")
def performance_stats(db: Session = Depends(get_db)) -> dict:
    return performance_repo.get_performance_stats(db)


@router.get("/performance/findings")
def performance_findings(db: Session = Depends(get_db)) -> list:
    return performance_repo.list_performance_findings(db)


@router.get("/performance/findings/{finding_id}")
def performance_finding_get(finding_id: str, db: Session = Depends(get_db)) -> dict:
    row = performance_repo.get_finding(db, finding_id)
    if not row:
        raise api_error("性能发现不存在", 404)
    return row


@router.post("/performance/findings")
def performance_finding_create(body: dict, db: Session = Depends(get_db)) -> dict:
    return performance_repo.create_finding(db, body)


@router.patch("/performance/findings/{finding_id}")
def performance_finding_update(finding_id: str, body: dict, db: Session = Depends(get_db)) -> dict:
    row = performance_repo.update_finding(db, finding_id, body)
    if not row:
        raise api_error("性能发现不存在", 404)
    return row


@router.delete("/performance/findings/{finding_id}")
def performance_finding_delete(finding_id: str, db: Session = Depends(get_db)) -> dict:
    if not performance_repo.delete_finding(db, finding_id):
        raise api_error("性能发现不存在", 404)
    return {"ok": True}


@router.get("/governance/rules")
def governance_rules(db: Session = Depends(get_db)) -> list:
    return governance_repo.list_rules(db)


@router.get("/governance/rules/{rule_id}")
def governance_rule_get(rule_id: str, db: Session = Depends(get_db)) -> dict:
    row = governance_repo.get_rule(db, rule_id)
    if not row:
        raise api_error("治理规则不存在", 404)
    return row


@router.post("/governance/rules")
def governance_rule_create(body: dict, db: Session = Depends(get_db)) -> dict:
    return governance_repo.create_rule(db, body)


@router.patch("/governance/rules/{rule_id}")
def governance_rule_update(rule_id: str, body: dict, db: Session = Depends(get_db)) -> dict:
    row = governance_repo.update_rule(db, rule_id, body)
    if not row:
        raise api_error("治理规则不存在", 404)
    return row


@router.delete("/governance/rules/{rule_id}")
def governance_rule_delete(rule_id: str, db: Session = Depends(get_db)) -> dict:
    if not governance_repo.delete_rule(db, rule_id):
        raise api_error("治理规则不存在", 404)
    return {"ok": True}


@router.get("/governance/violations")
def governance_violations(db: Session = Depends(get_db)) -> list:
    return governance_repo.list_violations(db)


@router.get("/governance/audit-logs")
def governance_audit_logs(db: Session = Depends(get_db)) -> list:
    return governance_repo.list_audit_logs(db)


@router.post("/governance/audit-logs")
def governance_audit_create(body: dict, db: Session = Depends(get_db)) -> dict:
    return governance_repo.create_audit_log(db, body)


@router.get("/team/members")
def team_members(db: Session = Depends(get_db)) -> list:
    return team_repo.list_members(db)


@router.get("/team/members/{member_id}")
def team_member_get(member_id: str, db: Session = Depends(get_db)) -> dict:
    row = team_repo.get_member(db, member_id)
    if not row:
        raise api_error("团队成员不存在", 404)
    return row


@router.post("/team/members")
def team_member_create(body: dict, db: Session = Depends(get_db)) -> dict:
    return team_repo.create_member(db, body)


@router.patch("/team/members/{member_id}")
def team_member_update(member_id: str, body: dict, db: Session = Depends(get_db)) -> dict:
    row = team_repo.update_member(db, member_id, body)
    if not row:
        raise api_error("团队成员不存在", 404)
    return row


@router.delete("/team/members/{member_id}")
def team_member_delete(member_id: str, db: Session = Depends(get_db)) -> dict:
    if not team_repo.delete_member(db, member_id):
        raise api_error("团队成员不存在", 404)
    return {"ok": True}


@router.get("/architecture/repos/{repo_id}/graph")
async def architecture_graph(repo_id: str, db: Session = Depends(get_db)) -> dict:
    client = get_engine_client()
    graph = await client.build_dependency_graph(repo_id)
    db_graph = architecture_repo.get_dependency_graph(db, repo_id)
    if len(db_graph.get("nodes", [])) > len(graph.get("nodes", [])):
        return db_graph
    graph["status"] = "ok"
    return graph
