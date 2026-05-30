"""Repository health score detail."""
from __future__ import annotations

from app.db.models import Repository
from app.services.repo_health import compute_repo_health_detail


def test_compute_repo_health_detail_bounds(db) -> None:
    row = Repository(
        id="repo-health-1",
        full_name="acme/health",
        owner="acme",
        name="health",
        github_id="health-1",
        source_type="github",
        source="test",
        ai_review_enabled=True,
        payload={"openPrCount": 15},
        architecture_graph={"metrics": {"cycles": 2, "giants": 1, "layerViolations": 0}},
    )
    db.add(row)
    db.commit()

    detail = compute_repo_health_detail(db, row.id, open_pr_count=15)
    assert 0 <= detail["score"] <= 100
    assert detail["score"] < 100
    assert len(detail["deductions"]) >= 1
