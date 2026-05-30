"""Repository adoption and background analysis job APIs."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.core.security import CurrentUser, get_current_user
from app.db.deps import get_db
from app.db.models import AuthUser
from app.repositories import auth_users as auth_users_repo
from app.repositories import repos as repos_repo
from app.repositories import repository_jobs as rjob_repo
from app.services import repository_jobs as repository_jobs_service
from app.services.activity_log import record_activity

router = APIRouter(prefix="/api", tags=["repository-jobs"])


class StartRepoAnalyzeBody(BaseModel):
    types: list[str] = Field(default_factory=lambda: ["architecture"])


class CancelJobBody(BaseModel):
    jobId: str = Field(min_length=1)


@router.post("/repos/{repo_id}/adopt")
async def adopt_repository(
    repo_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    team_ids = auth_users_repo.get_team_ids_for_user(db, user.id)
    row = repos_repo.adopt_repository_for_user(db, repo_id, user.id, team_ids)
    if row is None:
        raise api_error("Repository not found", 404)
    job = rjob_repo.create_job(
        db,
        repository_id=repo_id,
        job_type="onboarding",
        message="纳管初始化…",
    )
    db.commit()
    record_activity(
        db,
        event_type="repo_adopted",
        actor=user.username,
        action=f"Adopted repository {row.full_name} into management",
        repo=row.full_name,
    )
    db.commit()
    repository_jobs_service.schedule_repository_job(job.id)
    dto = repos_repo.get_repo(db, repo_id)
    return {"ok": True, "repository": dto, "jobId": job.id}


@router.post("/repos/{repo_id}/analyze")
async def start_repo_analyze(
    repo_id: str,
    body: StartRepoAnalyzeBody,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _ = user
    team_ids = auth_users_repo.get_team_ids_for_user(db, user.id)
    row = repos_repo.get_repo_row_for_user(db, repo_id, user.id, team_ids)
    if row is None:
        raise api_error("Repository not found", 404)
    if not row.managed:
        raise api_error("请先纳管该仓库后再执行分析", 400)

    allowed = {"architecture", "security", "performance", "repo_ai", "clone", "sync_prs"}
    types = [t for t in body.types if t in allowed]
    if not types:
        types = ["architecture"]

    job_ids: list[str] = []
    for job_type in types:
        jid = repository_jobs_service.create_and_schedule(
            db,
            repository_id=repo_id,
            job_type=job_type,
            message=f"排队 {job_type} 分析…",
        )
        job_ids.append(jid)

    if len(job_ids) == 1:
        return {"jobId": job_ids[0]}
    return {"jobs": [rjob_repo.get_job(db, jid) for jid in job_ids if jid]}


@router.get("/repos/{repo_id}/analysis-status")
async def repo_analysis_status(
    repo_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    team_ids = auth_users_repo.get_team_ids_for_user(db, user.id)
    row = repos_repo.get_repo_row_for_user(db, repo_id, user.id, team_ids)
    if row is None:
        raise api_error("Repository not found", 404)
    jobs = rjob_repo.list_jobs_for_repo(db, repo_id, limit=10)
    latest = jobs[0] if jobs else None
    return {"latest": latest, "jobs": jobs}


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _ = user
    job = rjob_repo.get_job(db, job_id)
    if job is None:
        raise api_error("Job not found", 404)
    return job


@router.post("/repos/{repo_id}/refresh")
async def refresh_repo_cache(
    repo_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    team_ids = auth_users_repo.get_team_ids_for_user(db, user.id)
    row = repos_repo.get_repo_row_for_user(db, repo_id, user.id, team_ids)
    if row is None:
        raise api_error("Repository not found", 404)
    from app.services.repo_clone import ensure_repo_clone

    result = await ensure_repo_clone(db, repo_id, force_refresh=True)
    return result


@router.post("/repos/{repo_id}/cancel-job")
async def cancel_repo_job(
    repo_id: str,
    body: CancelJobBody,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    team_ids = auth_users_repo.get_team_ids_for_user(db, user.id)
    row = repos_repo.get_repo_row_for_user(db, repo_id, user.id, team_ids)
    if row is None:
        raise api_error("Repository not found", 404)
    job = rjob_repo.get_job_row(db, body.jobId)
    if job is None or job.repository_id != repo_id:
        raise api_error("Job not found", 404)
    if not rjob_repo.cancel_job(db, body.jobId):
        raise api_error("无法取消该任务", 400)
    db.commit()
    return {"ok": True, "jobId": body.jobId}
