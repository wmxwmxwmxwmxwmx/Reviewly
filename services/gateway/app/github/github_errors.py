"""Map GitHub REST API error responses to actionable user messages."""
from __future__ import annotations

import httpx

from app.core.errors import api_error


def _github_message(resp: httpx.Response) -> str:
    try:
        data = resp.json()
        if isinstance(data, dict):
            msg = data.get("message")
            if isinstance(msg, str):
                return msg
    except Exception:  # noqa: BLE001
        pass
    return ""


def raise_for_github_response(
    resp: httpx.Response,
    *,
    resource: str,
    has_pat: bool,
) -> None:
    """Raise api_error for failed GitHub responses; no-op on success."""
    if resp.status_code < 400:
        return

    message = _github_message(resp)
    lower = message.lower()

    if resp.status_code == 403 and "rate limit" in lower:
        if has_pat:
            raise api_error(
                "GitHub API 调用频率已达上限，请稍后再试。",
                429,
            )
        raise api_error(
            "GitHub API 未认证调用次数已用尽（公开仓库也需要 Token 以提高限额）。"
            "请在 services/gateway/.env 配置 GITHUB_PAT 后重启 Gateway。"
            "创建 Token：https://github.com/settings/tokens（`public_repo` 只读权限即可）。",
            429,
        )

    if resp.status_code == 401:
        raise api_error(
            "GITHUB_PAT 无效或已过期，请在 services/gateway/.env 更新后重启 Gateway。",
            401,
        )

    if resp.status_code == 403:
        raise api_error(
            f"无法访问{resource}（权限不足或仓库为私有）。"
            "请安装 GitHub App 或在 .env 配置 GITHUB_PAT。",
            403,
        )

    if resp.status_code == 404:
        raise api_error(
            f"未找到{resource}，请确认链接中的 owner、仓库名与 PR 编号是否正确。",
            404,
        )

    resp.raise_for_status()
