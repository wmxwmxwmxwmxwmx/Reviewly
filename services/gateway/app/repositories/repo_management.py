"""Repository adoption / managed-state helpers (single source of truth for API + guards)."""
from __future__ import annotations

from typing import Any

from app.db.models import Repository
from app.repositories.seed_filter import REPOSITORY_TYPE_MANAGED


def repository_is_managed(*, managed: bool, repository_type: str | None) -> bool:
    """Canonical managed check; tolerates legacy rows (managed=false + type=managed)."""
    return bool(managed) or repository_type == REPOSITORY_TYPE_MANAGED


def row_is_managed(row: Repository) -> bool:
    return repository_is_managed(
        managed=bool(row.managed),
        repository_type=row.repository_type,
    )


def repository_is_adopted(row: Repository) -> bool:
    """User adoption state must not be downgraded by external sync."""
    return row_is_managed(row)


def apply_management_fields_to_api(data: dict[str, Any], row: Repository) -> None:
    """Normalize API output so UI never sees contradictory managed/type pairs."""
    is_managed = row_is_managed(row)
    data["isManaged"] = is_managed
    data["managed"] = is_managed
    if is_managed:
        data["repositoryType"] = REPOSITORY_TYPE_MANAGED
    elif row.repository_type:
        data["repositoryType"] = row.repository_type


def external_sync_metadata_defaults(
    metadata: dict[str, Any],
    *,
    existing: Repository | None,
) -> dict[str, Any]:
    """Apply external-import defaults without downgrading adopted repositories."""
    metadata = dict(metadata)
    if existing is not None and repository_is_adopted(existing):
        metadata.pop("managed", None)
        metadata.pop("repository_type", None)
        return metadata
    from app.repositories.seed_filter import REPOSITORY_TYPE_EXTERNAL

    metadata.setdefault("repository_type", REPOSITORY_TYPE_EXTERNAL)
    if "managed" not in metadata:
        metadata["managed"] = False
    return metadata
