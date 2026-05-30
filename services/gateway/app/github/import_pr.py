"""Import a single pull request by GitHub URL into the database."""
from __future__ import annotations

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.github import sync
from app.integrations.github.app_auth import get_installation_id_for_repo
from app.github.url_parser import parse_github_pr_url
from app.repositories import pull_requests as pr_repo


async def import_pull_request_by_url(session: Session, url: str) -> dict[str, str]:
    parsed = parse_github_pr_url(url)

    cached = pr_repo.find_by_repo_number(session, parsed.owner, parsed.repo, parsed.number)
    if cached:
        return {"prId": cached, "source": "cache"}

    last_error: HTTPException | None = None

    if settings.github_app_id and settings.github_app_private_key:
        try:
            installation_id = await get_installation_id_for_repo(parsed.owner, parsed.repo)
        except httpx.HTTPError as exc:
            last_error = api_error(f"GitHub App 安装查询失败：{exc}", 502)
            installation_id = None
        if installation_id:
            try:
                pr_id = await sync.sync_single_pull_request(
                    session,
                    parsed.owner,
                    parsed.repo,
                    parsed.number,
                    installation_id=installation_id,
                )
                return {"prId": pr_id, "source": "github_app"}
            except HTTPException as exc:
                last_error = exc

    try:
        pr_id = await sync.sync_single_pull_request_public(
            session,
            parsed.owner,
            parsed.repo,
            parsed.number,
        )
        return {"prId": pr_id, "source": "github_public"}
    except HTTPException as exc:
        last_error = exc

    if last_error is not None:
        raise last_error

    raise api_error(
        "请配置 GitHub App 或 GITHUB_PAT 以导入 PR，或粘贴已同步到本地的 PR 链接。",
        501,
    )
