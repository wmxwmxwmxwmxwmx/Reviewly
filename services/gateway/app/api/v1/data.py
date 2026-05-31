import httpx
from fastapi import APIRouter, BackgroundTasks, Body, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
from sqlalchemy.orm import Session

import logging

from app.core.config import settings
from app.core.dev_errors import dev_diagnostics_enabled, dev_error_payload
from app.core.errors import SCHEMA_OUTDATED_MESSAGE, api_error
from app.core.security import get_optional_user
from app.db.models import AuthUser
from app.repositories import auth_users as auth_users_repo
from app.github.import_pr import import_pull_request_by_url
from app.db.deps import get_db
from app.repositories import analysis as analysis_repo
from app.repositories import dashboard as dashboard_repo
from app.repositories import pull_requests as pr_repo
from app.github import public_client
from app.repositories import repos as repos_repo
from app.repositories import governance as governance_repo
from app.repositories import settings as settings_repo
from app.services import analysis_jobs
from app.services.pr_metadata import pr_has_head_sha, refresh_pr_shas_from_github
from app.services import dashboard_summary

router = APIRouter(prefix="/api", tags=["data"])

logger = logging.getLogger(__name__)


def _resolve_user_scope(
    db: Session,
    user: AuthUser | None,
) -> tuple[str | None, list[str] | None]:
    if user and not settings.prism_auth_bypass:
        return user.id, auth_users_repo.get_team_ids_for_user(db, user.id)
    return None, None


class ImportPrBody(BaseModel):
    url: str = Field(min_length=1)
    pr_url: str | None = Field(default=None, validation_alias="prUrl")

    model_config = {"populate_by_name": True}

    def resolved_url(self) -> str:
        return (self.pr_url or self.url).strip()


class RepoAiAnalysisBody(BaseModel):
    content: str = Field(min_length=1)
    model: str | None = None
    provider: str | None = None


class AiUsageMetricsBody(BaseModel):
    prompt_tokens: int = Field(default=0, validation_alias="promptTokens")
    completion_tokens: int = Field(default=0, validation_alias="completionTokens")
    total_tokens: int = Field(default=0, validation_alias="totalTokens")
    cost_cny: float = Field(default=0, validation_alias="costCny")
    latency_ms: int | None = Field(default=None, validation_alias="latencyMs")

    model_config = {"populate_by_name": True}


class PrAiSummaryBody(BaseModel):
    content: str = Field(min_length=1)
    model: str | None = None
    provider: str | None = None
    analyzed_at: str | None = Field(default=None, validation_alias="analyzedAt")
    analysis_version: str | None = Field(default=None, validation_alias="analysisVersion")
    prompt_version: str | None = Field(default=None, validation_alias="promptVersion")
    usage: AiUsageMetricsBody | None = None

    model_config = {"populate_by_name": True}


class PatchPullRequestBody(BaseModel):
    display_name: str | None = Field(default=None, validation_alias="displayName")
    note: str | None = None
    favorite: bool | None = None

    model_config = {"populate_by_name": True}


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    if user and not settings.prism_auth_bypass:
        team_ids = auth_users_repo.get_team_ids_for_user(db, user.id)
        return dashboard_repo.get_dashboard(db, user_id=user.id, team_ids=team_ids)
    return dashboard_repo.get_dashboard(db)


@router.get("/dashboard/activities")
def dashboard_activities(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, le=100),
) -> dict:
    from app.services.activity_log import list_recent

    return {"activities": list_recent(db, limit=limit)}


class WeeklySummaryBody(BaseModel):
    api_key: str | None = Field(default=None, validation_alias="apiKey")

    model_config = {"populate_by_name": True}


@router.post("/dashboard/weekly-summary")
async def dashboard_weekly_summary(
    db: Session = Depends(get_db),
    body: WeeklySummaryBody | None = Body(None),
) -> dict:
    override = body.api_key if body and body.api_key else None
    return await dashboard_summary.generate_weekly_summary(db, api_key_override=override)


@router.get("/repos")
def repos(
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
    type: str = Query(default="github", alias="type"),
) -> list:
    repo_type = type if type in ("github", "external", "all") else "github"
    if user and not settings.prism_auth_bypass:
        team_ids = auth_users_repo.get_team_ids_for_user(db, user.id)
        return repos_repo.list_repos(db, user_id=user.id, team_ids=team_ids, repo_type=repo_type)
    return repos_repo.list_repos(db, repo_type=repo_type)


@router.get("/repos/{repo_id}/analyze-context")
async def repo_analyze_context(
    repo_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    if user and not settings.prism_auth_bypass:
        team_ids = auth_users_repo.get_team_ids_for_user(db, user.id)
        if repos_repo.get_repo_row_for_user(db, repo_id, user.id, team_ids) is None:
            raise api_error("仓库不存在", 404)
    elif repos_repo.get_repo(db, repo_id) is None:
        raise api_error("仓库不存在", 404)

    from app.services.repo_analyze_context import build_repo_analyze_context

    ctx = await build_repo_analyze_context(db, repo_id, user=user)
    if not ctx:
        raise api_error("仓库不存在", 404)
    return ctx


@router.put("/repos/{repo_id}/ai-analysis")
def repo_save_ai_analysis(
    repo_id: str,
    body: RepoAiAnalysisBody,
    db: Session = Depends(get_db),
) -> dict:
    repo = repos_repo.save_repo_ai_analysis(
        db,
        repo_id,
        content=body.content,
        model=body.model,
        provider=body.provider,
    )
    if not repo:
        raise api_error("仓库不存在", 404)
    db.commit()
    return repo


@router.put("/repos/{repo_id}/architecture-analysis")
def repo_save_architecture_analysis(
    repo_id: str,
    body: RepoAiAnalysisBody,
    db: Session = Depends(get_db),
) -> dict:
    repo = repos_repo.save_repo_architecture_analysis(
        db,
        repo_id,
        content=body.content,
        model=body.model,
        provider=body.provider,
    )
    if not repo:
        raise api_error("仓库不存在", 404)
    db.commit()
    return repo


@router.post("/repos/{repo_id}/clone")
async def repo_clone(repo_id: str, db: Session = Depends(get_db)) -> dict:
    from app.services.repo_clone import ensure_repo_clone

    return await ensure_repo_clone(db, repo_id)


@router.get("/pull-requests/recent-activity")
def pull_requests_recent_activity(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, le=100),
) -> dict:
    from app.services.activity_log import list_recent

    return {"activities": list_recent(db, limit=limit)}


@router.get("/pull-requests")
def pull_requests(
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
    repo: str | None = None,
    repo_id: str | None = Query(None, alias="repoId"),
    risk: str | None = None,
    author: str | None = None,
    state: str | None = None,
    review_status: str | None = Query(None, alias="reviewStatus"),
    search: str | None = None,
    pr_filter: str | None = Query(None, alias="filter"),
    cursor: str | None = None,
    limit: int = Query(default=50, le=100),
    include_external: bool = Query(default=False, alias="includeExternal"),
    include_counts: bool = Query(default=False, alias="includeCounts"),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    items = pr_repo.list_pull_requests(
        db,
        repo=repo,
        repo_id=repo_id,
        risk=risk,
        author=author,
        state=state,
        review_status=review_status,
        search=search,
        include_external=include_external,
        user_id=user_id,
        team_ids=team_ids,
    )
    items = pr_repo.filter_pull_request_items(items, pr_filter)
    total = len(items)
    page = items[:limit]
    result: dict = {
        "items": page,
        "total": total,
        "cursor": cursor,
        "hasMore": total > limit,
    }
    if include_counts:
        from app.repositories import review_center as rc_repo

        result["statusCounts"] = rc_repo.count_by_review_status(
            db, repo_id=repo_id, user_id=user_id, team_ids=team_ids
        )
    return result


@router.post("/pull-requests/import")
async def import_pull_request(
    body: ImportPrBody,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    from app.main import migration_status

    if migration_status == "failed":
        raise api_error(SCHEMA_OUTDATED_MESSAGE, 503, code="SCHEMA_OUTDATED")

    user_id = user.id if user and not settings.prism_auth_bypass else None
    resolved_url = body.resolved_url()
    logger.info(
        "=== FastAPI import === parsed url: %s user_id: %s",
        resolved_url,
        user_id or "(none)",
    )
    try:
        result = await import_pull_request_by_url(db, resolved_url, user_id=user_id)
        logger.info(
            "=== FastAPI import === ok prId=%s source=%s",
            result.get("prId"),
            result.get("source"),
        )
        return result
    except (OperationalError, ProgrammingError):
        logger.exception("Database schema error during PR import")
        raise api_error(SCHEMA_OUTDATED_MESSAGE, 503, code="SCHEMA_OUTDATED")
    except IntegrityError:
        logger.exception("Database integrity error during PR import")
        raise api_error("PR 数据写入失败，请重试或联系管理员", 409, code="IMPORT_INTEGRITY_ERROR")
    except httpx.HTTPError as exc:
        logger.exception("GitHub HTTP error during PR import")
        raise api_error(f"GitHub 网络请求失败：{exc}", 502)
    except Exception as exc:
        logger.exception("Unexpected error during PR import")
        if dev_diagnostics_enabled():
            return JSONResponse(
                status_code=500,
                content=dev_error_payload(exc, error="PR 导入失败", context="import_pull_request"),
            )
        raise


@router.get("/pull-requests/{pr_id}")
def pull_request(
    pr_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    pr = pr_repo.get_pull_request(db, pr_id, user_id=user_id, team_ids=team_ids)
    if not pr:
        raise api_error("合并请求不存在", 404)
    return pr


@router.patch("/pull-requests/{pr_id}")
def patch_pull_request(
    pr_id: str,
    body: PatchPullRequestBody,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    if body.display_name is None and body.note is None and body.favorite is None:
        raise api_error("请求参数无效", 400)
    updated = pr_repo.update_pull_request_metadata(
        db,
        pr_id,
        display_name=body.display_name,
        note=body.note,
        favorite=body.favorite,
        user_id=user_id,
        team_ids=team_ids,
    )
    if not updated:
        raise api_error("合并请求不存在", 404)
    return updated


@router.delete("/pull-requests/{pr_id}")
def delete_pull_request(
    pr_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    result = pr_repo.delete_pull_request(db, pr_id, user_id=user_id, team_ids=team_ids)
    if result == "protected":
        raise api_error("内置演示 PR 不能删除", 403)
    if not result:
        raise api_error("合并请求不存在", 404)
    return {"ok": True, "id": pr_id}


@router.get("/pull-requests/{pr_id}/diff")
async def pull_request_diff(
    pr_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> list:
    user_id, team_ids = _resolve_user_scope(db, user)
    if pr_repo.get_pull_request(db, pr_id, user_id=user_id, team_ids=team_ids) is None:
        raise api_error("合并请求不存在", 404)

    from sqlalchemy import select

    from app.db.models import PullRequestDiff
    from app.repositories import pull_request_files as pr_files_repo

    diff_row = db.scalar(select(PullRequestDiff).where(PullRequestDiff.pull_request_id == pr_id))
    pr_patch = diff_row.patch if diff_row and diff_row.patch else None

    rows = pr_files_repo.build_diff_view_rows(db, pr_id, pr_patch=pr_patch)
    if rows:
        return rows

    fallback = pr_repo.get_diff(db, pr_id, user_id=user_id, team_ids=team_ids)
    return pr_files_repo.ensure_diff_view_shape(fallback)


@router.get("/pull-requests/{pr_id}/files")
def pull_request_files(
    pr_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> list:
    user_id, team_ids = _resolve_user_scope(db, user)
    if pr_repo.get_pull_request(db, pr_id, user_id=user_id, team_ids=team_ids) is None:
        raise api_error("合并请求不存在", 404)
    from app.repositories import pull_request_files as pr_files_repo

    return pr_files_repo.list_files(db, pr_id)


@router.get("/pull-requests/{pr_id}/analysis/latest")
def analysis_latest(
    pr_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    if pr_repo.get_pull_request(db, pr_id, user_id=user_id, team_ids=team_ids) is None:
        raise api_error("合并请求不存在", 404)
    summary = analysis_jobs.get_latest_analysis(db, pr_id)
    if not summary:
        raise api_error("暂无分析结果", 404)
    return summary


@router.get("/pull-requests/{pr_id}/ai-summary")
def get_pr_ai_summary(
    pr_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    if pr_repo.get_pull_request(db, pr_id, user_id=user_id, team_ids=team_ids) is None:
        raise api_error("合并请求不存在", 404)
    summary = pr_repo.get_ai_summary(db, pr_id, user_id=user_id, team_ids=team_ids)
    if not summary:
        raise api_error("暂无 AI 摘要", 404)
    return summary


@router.patch("/pull-requests/{pr_id}/ai-summary")
def patch_pr_ai_summary(
    pr_id: str,
    body: PrAiSummaryBody,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    if pr_repo.get_pull_request(db, pr_id, user_id=user_id, team_ids=team_ids) is None:
        raise api_error("合并请求不存在", 404)
    from datetime import datetime, timezone

    payload = {
        "content": body.content.strip(),
        "analyzedAt": body.analyzed_at or datetime.now(timezone.utc).isoformat(),
    }
    if body.model:
        payload["model"] = body.model.strip()
    if body.provider:
        payload["provider"] = body.provider.strip()
    if body.analysis_version:
        payload["analysisVersion"] = body.analysis_version.strip()
    if body.prompt_version:
        payload["promptVersion"] = body.prompt_version.strip()
    if body.usage:
        payload["usage"] = {
            "promptTokens": body.usage.prompt_tokens,
            "completionTokens": body.usage.completion_tokens,
            "totalTokens": body.usage.total_tokens,
            "costCny": body.usage.cost_cny,
            **({"latencyMs": body.usage.latency_ms} if body.usage.latency_ms is not None else {}),
        }
    saved = pr_repo.save_ai_summary(db, pr_id, payload, user_id=user_id, team_ids=team_ids)
    if saved is None:
        raise api_error("保存失败", 500)
    return saved


@router.post("/pull-requests/{pr_id}/analysis")
async def start_analysis(
    pr_id: str,
    background_tasks: BackgroundTasks,
    force: bool = False,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    from app.main import migration_status

    if migration_status == "failed":
        raise api_error(SCHEMA_OUTDATED_MESSAGE, 503, code="SCHEMA_OUTDATED")

    user_id, team_ids = _resolve_user_scope(db, user)
    if pr_repo.get_pull_request(db, pr_id, user_id=user_id, team_ids=team_ids) is None:
        raise api_error("合并请求不存在", 404)

    if not pr_has_head_sha(db, pr_id):
        refreshed = await refresh_pr_shas_from_github(db, pr_id, user=user)
        if not refreshed:
            raise api_error(
                "缺少 PR 提交版本信息，请先在代码仓库中重新同步该合并请求",
                400,
            )

    try:
        result = analysis_jobs.create_job(db, pr_id, force=force)
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
    except ValueError as exc:
        raise api_error(str(exc) or "无法创建分析任务，请先同步合并请求", 400) from exc
    except (OperationalError, ProgrammingError) as exc:
        logger.exception("Database schema error during PR analysis start")
        raise api_error(SCHEMA_OUTDATED_MESSAGE, 503, code="SCHEMA_OUTDATED") from exc
    except IntegrityError as exc:
        logger.exception("Database integrity error during PR analysis start")
        raise api_error("分析任务创建失败，请重试", 409, code="ANALYSIS_INTEGRITY_ERROR") from exc


@router.get("/pull-requests/{pr_id}/findings")
def pr_findings(
    pr_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> list:
    user_id, team_ids = _resolve_user_scope(db, user)
    if pr_repo.get_pull_request(db, pr_id, user_id=user_id, team_ids=team_ids) is None:
        raise api_error("合并请求不存在", 404)
    return analysis_jobs.get_findings(db, pr_id)


@router.get("/pull-requests/{pr_id}/governance")
def pr_governance(
    pr_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> list:
    user_id, team_ids = _resolve_user_scope(db, user)
    if pr_repo.get_pull_request(db, pr_id, user_id=user_id, team_ids=team_ids) is None:
        raise api_error("合并请求不存在", 404)
    return governance_repo.list_rules_for_pr(db, pr_id)


@router.get("/analysis/jobs/stats")
def analysis_jobs_stats(
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    from app.repositories import review_center as rc_repo

    user_id, team_ids = _resolve_user_scope(db, user)
    counts = rc_repo.count_by_review_status(
        db, user_id=user_id, team_ids=team_ids
    )
    stats = rc_repo.get_stats(db, user_id=user_id, team_ids=team_ids)
    dash = rc_repo.get_dashboard(db, user_id=user_id, team_ids=team_ids)
    return {
        "pendingAssigned": int(counts.get("OPEN", 0)) + int(counts.get("IN_REVIEW", 0)),
        "changesRequested": int(counts.get("CHANGES_REQUESTED", 0)),
        "highRisk": int(dash.get("highRisk", 0)),
        "approved": int(counts.get("APPROVED", 0)),
        "weeklyAnalysisCount": int(stats.get("weeklyAnalysisCount", 0)),
    }


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
