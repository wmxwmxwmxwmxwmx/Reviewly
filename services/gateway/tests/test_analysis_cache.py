"""PR analysis cache: version key, cache hit/miss, version-scoped queries."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy.orm import Session

from app.db.models import AnalysisJob, PullRequest, Repository
from app.repositories import analysis as analysis_repo
from app.services import analysis_jobs
from app.services.analysis_cache import (
    PHASE_COMPLETED,
    aggregate_cache_stats,
    build_analysis_version,
    find_cached_completed_job,
    record_cache_event,
)


def _seed_pr(
    session: Session,
    *,
    pr_id: str = "pr-cache-1",
    head_sha: str = "deadbeef",
    base_sha: str = "cafebabe",
) -> tuple[Repository, PullRequest, str]:
    repo = Repository(
        id="repo-cache-1",
        team_id="team-default",
        full_name="acme/widget",
        github_id="9001",
        source_type="github",
    )
    version = build_analysis_version("acme/widget", 7, head_sha)
    pr = PullRequest(
        id=pr_id,
        repository_id=repo.id,
        number=7,
        github_id="7007",
        state="open",
        risk_score=10,
        head_sha=head_sha,
        base_sha=base_sha,
        analysis_version=version,
        payload={"repo": "acme/widget", "headSha": head_sha},
    )
    session.add(repo)
    session.flush()
    session.add(pr)
    session.commit()
    return repo, pr, version


def test_build_analysis_version() -> None:
    assert build_analysis_version("acme/repo", 42, "abc") == "acme/repo#42:abc"


def test_find_cached_completed_job(session: Session) -> None:
    _, pr, version = _seed_pr(session)
    completed = AnalysisJob(
        id="job-done-1",
        pull_request_id=pr.id,
        status="completed",
        progress=100,
        chunk_index=1,
        chunk_total=1,
        analysis_version=version,
        head_sha=pr.head_sha,
        phase=PHASE_COMPLETED,
        cache_hit=False,
        completed_at=datetime.now(timezone.utc),
        duration_ms=5000,
    )
    session.add(completed)
    session.commit()

    found = find_cached_completed_job(session, version)
    assert found is not None
    assert found.id == "job-done-1"


def test_create_job_cache_hit(session: Session) -> None:
    _, pr, version = _seed_pr(session)
    session.add(
        AnalysisJob(
            id="job-source",
            pull_request_id=pr.id,
            status="completed",
            progress=100,
            chunk_index=1,
            chunk_total=1,
            analysis_version=version,
            head_sha=pr.head_sha,
            phase=PHASE_COMPLETED,
            cache_hit=False,
            completed_at=datetime.now(timezone.utc),
            duration_ms=3000,
        )
    )
    session.commit()

    result = analysis_jobs.create_job(session, pr.id)
    assert result["cacheHit"] is True
    assert result["queued"] is False
    assert result["jobId"] == "job-source"
    assert "_schedule" not in result


def test_create_job_force_bypasses_cache(session: Session) -> None:
    _, pr, version = _seed_pr(session)
    session.add(
        AnalysisJob(
            id="job-source",
            pull_request_id=pr.id,
            status="completed",
            progress=100,
            chunk_index=1,
            chunk_total=1,
            analysis_version=version,
            head_sha=pr.head_sha,
            phase=PHASE_COMPLETED,
            cache_hit=False,
            completed_at=datetime.now(timezone.utc),
        )
    )
    session.commit()

    result = analysis_jobs.create_job(session, pr.id, force=True)
    assert result["cacheHit"] is False
    assert result["queued"] is True
    assert result["_schedule"] == result["jobId"]


def test_get_latest_analysis_filters_by_version(session: Session) -> None:
    _, pr, version = _seed_pr(session)
    old_version = build_analysis_version("acme/widget", 7, "oldsha000")
    session.add(
        AnalysisJob(
            id="job-old",
            pull_request_id=pr.id,
            status="completed",
            progress=100,
            chunk_index=1,
            chunk_total=1,
            analysis_version=old_version,
            head_sha="oldsha000",
            phase=PHASE_COMPLETED,
            result_summary={"summary": "old"},
            completed_at=datetime(2020, 1, 1, tzinfo=timezone.utc),
        )
    )
    session.add(
        AnalysisJob(
            id="job-new",
            pull_request_id=pr.id,
            status="completed",
            progress=100,
            chunk_index=1,
            chunk_total=1,
            analysis_version=version,
            head_sha=pr.head_sha,
            phase=PHASE_COMPLETED,
            result_summary={"summary": "new"},
            completed_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
        )
    )
    session.commit()

    latest = analysis_repo.get_latest_analysis(session, pr.id)
    assert latest is not None
    assert latest.get("summary") == "new"


def test_get_latest_analysis_falls_back_when_version_drifts(session: Session) -> None:
    _, pr, _version = _seed_pr(session)
    drifted = build_analysis_version("acme/widget", pr.number, "driftsha111")
    session.add(
        AnalysisJob(
            id="job-drift-fallback",
            pull_request_id=pr.id,
            status="completed",
            progress=100,
            chunk_index=1,
            chunk_total=1,
            analysis_version="acme/widget#7@oldonly",
            head_sha="oldonly",
            phase=PHASE_COMPLETED,
            result_summary={"summary": "fallback"},
            completed_at=datetime(2024, 6, 1, tzinfo=timezone.utc),
        )
    )
    pr.analysis_version = drifted
    pr.head_sha = "driftsha111"
    session.commit()

    latest = analysis_repo.get_latest_analysis(session, pr.id)
    assert latest is not None
    assert latest.get("summary") == "fallback"


def test_aggregate_cache_stats(session: Session) -> None:
    _, pr, version = _seed_pr(session)
    session.add(
        AnalysisJob(
            id="job-agg-source",
            pull_request_id=pr.id,
            status="completed",
            progress=100,
            chunk_index=1,
            chunk_total=1,
            analysis_version=version,
            head_sha=pr.head_sha,
            phase=PHASE_COMPLETED,
            cache_hit=False,
            completed_at=datetime.now(timezone.utc),
            duration_ms=4000,
        )
    )
    session.commit()
    record_cache_event(
        session,
        pull_request_id=pr.id,
        analysis_version=version,
        job_id="job-agg-source",
        cache_hit=True,
        saved_duration_ms=4000,
    )
    record_cache_event(
        session,
        pull_request_id=pr.id,
        analysis_version=version,
        job_id=None,
        cache_hit=False,
    )
    session.commit()

    stats = aggregate_cache_stats(session, days=30)
    assert stats["hits"] >= 1
    assert stats["misses"] >= 1
    assert stats["hitRate"] > 0


@pytest.fixture()
def session(client) -> Session:
    from conftest import TestingSession

    db = TestingSession()
    try:
        yield db
    finally:
        db.rollback()
        db.close()
