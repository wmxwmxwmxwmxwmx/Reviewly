from fastapi import APIRouter, BackgroundTasks, Query

from app.core.errors import api_error
from app.mock import seed
from app.services import analysis_jobs

router = APIRouter(prefix="/api", tags=["data"])


@router.get("/dashboard")
def dashboard() -> dict:
    return seed.get_dashboard()


@router.get("/repos")
def repos() -> list:
    return seed.list_repos()


@router.get("/pull-requests")
def pull_requests(
    repo: str | None = None,
    risk: str | None = None,
    author: str | None = None,
    state: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=50, le=100),
) -> dict:
    items = seed.list_pull_requests(repo=repo, risk=risk, author=author, state=state)
    return {"items": items[:limit], "cursor": cursor, "hasMore": len(items) > limit}


@router.get("/pull-requests/{pr_id}")
def pull_request(pr_id: str) -> dict:
    pr = seed.get_pull_request(pr_id)
    if not pr:
        raise api_error("合并请求不存在", 404)
    return pr


@router.get("/pull-requests/{pr_id}/diff")
def pull_request_diff(pr_id: str) -> list:
    if seed.get_pull_request(pr_id) is None:
        raise api_error("合并请求不存在", 404)
    return seed.get_diff(pr_id)


@router.get("/pull-requests/{pr_id}/analysis/latest")
def analysis_latest(pr_id: str) -> dict:
    summary = analysis_jobs.get_latest_analysis(pr_id)
    if not summary:
        raise api_error("暂无分析结果", 404)
    return summary


@router.post("/pull-requests/{pr_id}/analysis")
async def start_analysis(pr_id: str, background_tasks: BackgroundTasks) -> dict:
    try:
        result = analysis_jobs.create_job(pr_id)
        job_id = result.pop("_schedule", None)
        if job_id:
            background_tasks.add_task(analysis_jobs.run_job, job_id)
        return result
    except KeyError as exc:
        raise api_error("合并请求不存在", 404) from exc


@router.get("/pull-requests/{pr_id}/findings")
def pr_findings(pr_id: str) -> list:
    if seed.get_pull_request(pr_id) is None:
        raise api_error("合并请求不存在", 404)
    return analysis_jobs.get_findings(pr_id)


@router.get("/analysis/jobs/{job_id}")
def analysis_job(job_id: str) -> dict:
    job = analysis_jobs.get_job(job_id)
    if not job:
        raise api_error("分析任务不存在", 404)
    return job


@router.get("/security/findings")
def security_findings() -> list:
    return seed.list_security_findings()


@router.get("/settings")
def get_settings() -> dict:
    return seed.get_settings()


@router.patch("/settings")
def patch_settings(body: dict) -> dict:
    return seed.patch_settings(body)
