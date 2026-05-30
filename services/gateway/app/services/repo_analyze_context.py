"""Assemble repository analyze context for AI review."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import AuthUser
from app.github import repo_context
from app.repositories import repos as repos_repo


async def build_repo_analyze_context(
    session: Session,
    repo_id: str,
    *,
    user: AuthUser | None = None,
) -> dict:
    row = repos_repo.get_repo_row(session, repo_id)
    if row is None:
        return {}

    repo = repos_repo.get_repo(session, repo_id)
    if repo is None:
        return {}

    owner = str(repo.get("owner") or row.owner or "")
    name = str(repo.get("name") or row.name or "")
    if not owner or not name:
        parts = (repo.get("fullName") or row.full_name or "").split("/", 1)
        if len(parts) == 2:
            owner, name = parts[0], parts[1]

    token = await repo_context.resolve_access_token(session, row, user)
    default_branch = str(repo.get("defaultBranch") or row.default_branch or "main")

    warnings: list[str] = []
    if user and not token:
        warnings.append(
            "无法读取已保存的 GitHub 访问令牌，请退出 PRism 后重新使用 GitHub 登录。"
        )

    readme, readme_warn = await repo_context.fetch_readme(owner, name, token)
    file_tree, tree_warn = await repo_context.fetch_file_tree(
        owner, name, token, default_branch=default_branch
    )
    config_snippets = await repo_context.fetch_config_snippets(owner, name, token)

    if readme_warn:
        warnings.append(readme_warn)
    if tree_warn:
        warnings.append(tree_warn)
    if not token and row.is_private:
        warnings.append("私有仓库：请使用 GitHub 登录后再分析，或在 .env 配置 GITHUB_PAT。")
    if not config_snippets and token:
        warnings.append("未读取到常见配置文件（package.json / pyproject.toml 等）。")

    findings = repos_repo.list_recent_findings_for_repo(session, repo_id, limit=20)

    return {
        "repository": repo,
        "recentFindings": findings,
        "readme": readme,
        "fileTree": file_tree,
        "configSnippets": config_snippets,
        "contextWarnings": warnings,
    }
