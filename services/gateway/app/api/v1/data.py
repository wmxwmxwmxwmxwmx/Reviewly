from fastapi import APIRouter, BackgroundTasks, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.github.import_pr import import_pull_request_by_url
from app.db.deps import get_db
from app.repositories import analysis as analysis_repo
from app.repositories import dashboard as dashboard_repo
from app.repositories import pull_requests as pr_repo
from app.github import public_client
from app.repositories import repos as repos_repo
from app.repositories import settings as settings_repo
from app.services import analysis_jobs
from app.services import dashboard_summary

router = APIRouter(prefix="/api", tags=["data"])


class ImportPrBody(BaseModel):
    url: str = Field(min_length=1)
    pr_url: str | None = Field(default=None, validation_alias="prUrl")

    model_config = {"populate_by_name": True}

    def resolved_url(self) -> str:
        return (self.pr_url or self.url).strip()


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)) -> dict:
    return dashboard_repo.get_dashboard(db)


@router.post("/dashboard/weekly-summary")
async def dashboard_weekly_summary(db: Session = Depends(get_db)) -> dict:
    return await dashboard_summary.generate_weekly_summary(db)


@router.get("/repos")
def repos(db: Session = Depends(get_db)) -> list:
    return repos_repo.list_repos(db)


@router.get("/repos/{repo_id}/analyze-context")
async def repo_analyze_context(repo_id: str, db: Session = Depends(get_db)) -> dict:
    repo = repos_repo.get_repo(db, repo_id)
    if not repo:
        raise api_error("仓库不存在", 404)

    owner = repo.get("owner", "")
    name = repo.get("name", "")
    readme = ""
    if owner and name:
        try:
            readme = await public_client.get_readme(owner, name)
        except Exception:
            readme = ""

    findings = repos_repo.list_recent_findings_for_repo(db, repo_id, limit=20)
    return {
        "repository": repo,
        "recentFindings": findings,
        "readme": readme[:8000] if readme else "",
    }


@router.post("/repos/{repo_id}/clone")
def repo_clone_placeholder(repo_id: str, db: Session = Depends(get_db)) -> dict:
    if repos_repo.get_repo_row(db, repo_id) is None:
        raise api_error("仓库不存在", 404)
    raise api_error("仓库 clone 尚未实现，将用于架构分析与全仓扫描", 501)


@router.get("/pull-requests")
def pull_requests(
    db: Session = Depends(get_db),
    repo: str | None = None,
    risk: str | None = None,
    author: str | None = None,
    state: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=50, le=100),
) -> dict:
    items = pr_repo.list_pull_requests(db, repo=repo, risk=risk, author=author, state=state)
    return {"items": items[:limit], "cursor": cursor, "hasMore": len(items) > limit}


@router.post("/pull-requests/import")
async def import_pull_request(body: ImportPrBody, db: Session = Depends(get_db)) -> dict:
    return await import_pull_request_by_url(db, body.resolved_url())


@router.get("/pull-requests/{pr_id}")
def pull_request(pr_id: str, db: Session = Depends(get_db)) -> dict:
    pr = pr_repo.get_pull_request(db, pr_id)
    if not pr:
        raise api_error("合并请求不存在", 404)
    return pr


@router.get("/pull-requests/{pr_id}/diff")
async def pull_request_diff(pr_id: str, db: Session = Depends(get_db)) -> list:
    if pr_repo.get_pull_request(db, pr_id) is None:
        raise api_error("合并请求不存在", 404)

    from app.grpc_client.engine import get_engine_client
    from sqlalchemy import select

    from app.db.models import PullRequestDiff

    diff_row = db.scalar(select(PullRequestDiff).where(PullRequestDiff.pull_request_id == pr_id))
    if diff_row and diff_row.patch:
        client = get_engine_client()
        return await client.parse_diff(diff_row.patch)

    return pr_repo.get_diff(db, pr_id)


@router.get("/pull-requests/{pr_id}/analysis/latest")
def analysis_latest(pr_id: str, db: Session = Depends(get_db)) -> dict:
    summary = analysis_jobs.get_latest_analysis(db, pr_id)
    if not summary:
        raise api_error("暂无分析结果", 404)
    return summary


@router.post("/pull-requests/{pr_id}/analysis")
async def start_analysis(
    pr_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    try:
        result = analysis_jobs.create_job(db, pr_id)
        job_id = result.pop("_schedule", None)
        if job_id:

            def _run(jid: str) -> None:
                import asyncio

                from app.db.session import SessionLocal

                session = SessionLocal()
                try:
                    asyncio.run(analysis_jobs.run_job(session, jid))
                finally:
                    session.close()

            background_tasks.add_task(_run, job_id)
        return result
    except KeyError as exc:
        raise api_error("合并请求不存在", 404) from exc


@router.get("/pull-requests/{pr_id}/findings")
def pr_findings(pr_id: str, db: Session = Depends(get_db)) -> list:
    if pr_repo.get_pull_request(db, pr_id) is None:
        raise api_error("合并请求不存在", 404)
    return analysis_jobs.get_findings(db, pr_id)


@router.get("/analysis/jobs/{job_id}")
def analysis_job(job_id: str, db: Session = Depends(get_db)) -> dict:
    job = analysis_jobs.get_job(db, job_id)
    if not job:
        raise api_error("分析任务不存在", 404)
    return job


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)) -> dict:
    return settings_repo.get_settings(db)


@router.patch("/settings")
def patch_settings(body: dict, db: Session = Depends(get_db)) -> dict:
    return settings_repo.patch_settings(db, body)
