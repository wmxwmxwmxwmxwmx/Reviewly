"""Idempotent seed from mock/seed into PostgreSQL/SQLite (B2)."""
from __future__ import annotations

from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    GovernanceRule,
    GovernanceViolation,
    PullRequest,
    PullRequestDiff,
    Repository,
    Setting,
    Team,
    User,
)
from app.mock import seed
from app.services.analysis_cache import build_analysis_version, sync_pr_analysis_version

SEED_HEAD_SHA = "0" * 40


def _has_rows(session: Session, model: type) -> bool:
    return session.scalar(select(model).limit(1)) is not None


def load_seed_if_empty(session: Session) -> bool:
    """Load mock seed into DB when core tables are empty. Returns True if seeded."""
    if _has_rows(session, PullRequest):
        return False

    session.add(Team(id="team-default", name="Acme Corp"))
    session.flush()

    for repo in seed.list_repos():
        session.add(
            Repository(
                id=repo["id"],
                team_id="team-default",
                full_name=repo["fullName"],
                ai_review_enabled=repo.get("aiReviewEnabled", True),
                visibility="team",
                source="seed",
                payload=deepcopy(repo),
            )
        )
    session.flush()

    for pr in seed.list_pull_requests():
        pr_copy = deepcopy(pr)
        repo_name = pr_copy.get("repo") or "unknown/repo"
        head_sha = SEED_HEAD_SHA if pr_copy["id"] == seed.DEFAULT_PR_ID else f"seed{pr_copy['id']}"[:40].ljust(40, "0")
        pr_row = PullRequest(
            id=pr_copy["id"],
            repository_id=pr_copy["repoId"],
            number=pr_copy["number"],
            github_id=f"gh-{pr_copy['id']}",
            state=pr_copy["state"],
            risk_score=pr_copy.get("riskScore", 0),
            payload={**pr_copy, "headSha": head_sha},
            head_sha=head_sha,
        )
        session.add(pr_row)
        sync_pr_analysis_version(
            session,
            pr_row,
            head_sha=head_sha,
            base_sha=None,
            full_name=repo_name,
        )
        diff_files = seed.get_diff(pr_copy["id"])
        if diff_files:
            session.add(
                PullRequestDiff(
                    pull_request_id=pr_copy["id"],
                    files=deepcopy(diff_files),
                    patch=None,
                )
            )
    session.flush()

    session.add(Setting(id="default", data=deepcopy(seed.get_settings())))

    for member in seed.get_team_members():
        session.add(
            User(
                id=member["id"],
                team_id="team-default",
                email=f"{member['id']}@acme.local",
                payload=deepcopy(member),
            )
        )
    session.flush()

    governance_rules = seed.get_governance_rules()
    for rule in governance_rules:
        session.add(
            GovernanceRule(
                id=rule["id"],
                rule=rule["rule"],
                severity=rule.get("severity", "medium"),
                payload=deepcopy(rule),
            )
        )
    session.flush()

    for rule in governance_rules:
        session.add(
            GovernanceViolation(
                id=f"v-{rule['id']}",
                rule_id=rule["id"],
                pull_request_id=seed.DEFAULT_PR_ID,
                file=rule.get("file"),
                violated=rule.get("violated", False),
                payload=deepcopy(rule),
            )
        )

    from app.repositories import analysis as analysis_repo

    default_pr = session.get(PullRequest, seed.DEFAULT_PR_ID)
    assert default_pr is not None and default_pr.head_sha and default_pr.analysis_version
    job = analysis_repo.create_job(
        session,
        seed.DEFAULT_PR_ID,
        1,
        analysis_version=default_pr.analysis_version,
        head_sha=default_pr.head_sha,
        base_sha=default_pr.base_sha,
    )
    seeded_findings: list = []
    for f in seed.list_findings(seed.DEFAULT_PR_ID):
        seeded_findings.append(deepcopy(f))
    seeded_findings.extend(
        [
            {
                "id": "perf-seed-blocking",
                "ruleId": "blocking-io",
                "type": "performance",
                "perfType": "Blocking IO",
                "severity": "medium",
                "title": "同步 sleep 可能阻塞",
                "file": "internal/gateway/client.go",
                "line": 88,
                "description": "time.Sleep 出现在热路径，可能降低吞吐。",
                "confidence": 80,
                "rootCause": "",
                "fixSuggestion": "使用 context 超时或异步调度替代固定 sleep。",
            },
            {
                "id": "perf-seed-n1",
                "ruleId": "n-plus-one-query",
                "type": "performance",
                "perfType": "N+1 Query",
                "severity": "high",
                "title": "循环内数据库查询",
                "file": "internal/db/query_builder.go",
                "line": 120,
                "description": "for 循环内调用 Query，存在 N+1 风险。",
                "confidence": 85,
                "rootCause": "",
                "fixSuggestion": "批量预取或使用 JOIN 一次加载关联数据。",
            },
        ]
    )
    analysis_repo.save_findings(session, job.id, seeded_findings)

    session.commit()
    return True
