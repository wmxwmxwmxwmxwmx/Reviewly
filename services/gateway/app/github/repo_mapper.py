"""Map GitHub REST repo objects to PRism repository metadata."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _parse_github_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def github_repo_to_metadata(
    gh: dict[str, Any],
    *,
    open_prs: int | None = None,
    last_synced_at: datetime | None = None,
    installation_id: str | None = None,
) -> dict[str, Any]:
    """Build metadata dict for upsert_repository (columns + payload snapshot)."""
    github_id = str(gh["id"])
    full_name = gh.get("full_name") or ""
    owner_login = (gh.get("owner") or {}).get("login", "")
    if not owner_login and "/" in full_name:
        owner_login = full_name.split("/", 1)[0]
    name = gh.get("name") or (full_name.split("/", 1)[-1] if "/" in full_name else full_name)
    synced = last_synced_at or datetime.now(timezone.utc)
    open_count = open_prs if open_prs is not None else 0

    return {
        "id": f"repo-{github_id}",
        "github_id": github_id,
        "full_name": full_name,
        "owner": owner_login,
        "name": name,
        "description": gh.get("description"),
        "language": gh.get("language"),
        "stars": int(gh.get("stargazers_count") or 0),
        "forks": int(gh.get("forks_count") or 0),
        "open_prs": open_count,
        "default_branch": gh.get("default_branch") or "main",
        "clone_url": gh.get("clone_url"),
        "html_url": gh.get("html_url"),
        "avatar_url": (gh.get("owner") or {}).get("avatar_url"),
        "is_private": bool(gh.get("private", False)),
        "github_created_at": _parse_github_datetime(gh.get("created_at")),
        "github_updated_at": _parse_github_datetime(gh.get("updated_at")),
        "pushed_at": _parse_github_datetime(gh.get("pushed_at")),
        "last_synced_at": synced,
        "installation_id": installation_id,
        "payload": {
            "id": f"repo-{github_id}",
            "fullName": full_name,
            "name": name,
            "owner": owner_login,
            "defaultBranch": gh.get("default_branch") or "main",
            "openPrCount": open_count,
            "lastSyncTime": synced.isoformat().replace("+00:00", "Z"),
            "aiReviewEnabled": True,
            "description": gh.get("description"),
            "language": gh.get("language"),
            "stars": int(gh.get("stargazers_count") or 0),
            "forks": int(gh.get("forks_count") or 0),
            "htmlUrl": gh.get("html_url"),
            "cloneUrl": gh.get("clone_url"),
            "avatarUrl": (gh.get("owner") or {}).get("avatar_url"),
            "isPrivate": bool(gh.get("private", False)),
            "installationId": installation_id,
        },
    }
