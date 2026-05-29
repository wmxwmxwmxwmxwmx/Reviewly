"""GitHub webhook verification and dispatch."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.github import sync
from app.integrations.github.webhook_verify import verify_signature
from app.services.pr_sync import sync_from_webhook_pr

logger = logging.getLogger(__name__)


def _github_configured() -> bool:
    return bool(settings.github_app_id and settings.github_app_private_key)


async def handle_event(session: Session, event: str, payload: dict[str, Any]) -> None:
    if event == "installation":
        action = payload.get("action")
        installation = payload.get("installation", {})
        account = payload.get("sender", {}) or installation.get("account", {})
        inst_id = installation.get("id")
        if not inst_id:
            return
        inst_str = str(inst_id)
        if action in ("created", "added"):
            sync.record_installation(
                session,
                inst_str,
                account.get("login", "unknown"),
            )
            if _github_configured():
                try:
                    await sync.sync_installation(session, inst_str)
                except Exception:
                    logger.exception(
                        "Webhook installation sync failed installation_id=%s action=%s",
                        inst_str,
                        action,
                    )
            return
        if action == "deleted":
            return
        if _github_configured():
            try:
                await sync.sync_installation(session, inst_str)
            except Exception:
                logger.exception(
                    "Webhook installation sync failed installation_id=%s action=%s",
                    inst_str,
                    action,
                )
        return

    if event == "installation_repositories":
        action = payload.get("action", "")
        installation = payload.get("installation", {})
        inst_id = installation.get("id")
        if not inst_id:
            return
        inst_str = str(inst_id)
        if action in ("added", "removed") and _github_configured():
            await sync.sync_installation(session, inst_str)
        return

    if event == "pull_request":
        action = payload.get("action", "")
        installation_id = payload.get("installation", {}).get("id")
        inst_str = str(installation_id) if installation_id else None

        if action in ("opened", "synchronize", "reopened"):
            pr_id = await sync_from_webhook_pr(
                session,
                payload,
                installation_id=inst_str,
            )
            if pr_id and action in ("opened", "synchronize"):
                from app.services.analysis_orchestrator import (
                    enqueue_analysis,
                    schedule_analysis_background,
                )

                job_id = enqueue_analysis(pr_id)
                if job_id:
                    schedule_analysis_background(job_id)
            logger.info("Webhook pull_request %s handled pr_id=%s", action, pr_id)
            return

        if installation_id and _github_configured():
            try:
                await sync.sync_installation(session, inst_str)
            except Exception:
                logger.exception(
                    "Webhook pull_request resync failed installation_id=%s action=%s",
                    inst_str,
                    action,
                )
        return

    if event == "push":
        repo = payload.get("repository") or {}
        full_name = repo.get("full_name", "")
        if full_name:
            from app.repositories import repos as repos_repo
            from datetime import datetime, timezone

            row = repos_repo.get_repository_by_full_name(session, full_name)
            if row:
                row.last_synced_at = datetime.now(timezone.utc)
                session.commit()
        return

    if event == "repository":
        action = payload.get("action")
        if action in ("created", "edited", "renamed", "transferred") and _github_configured():
            installation_id = payload.get("installation", {}).get("id")
            if installation_id:
                try:
                    await sync.sync_installation(session, str(installation_id))
                except Exception:
                    logger.exception(
                        "Webhook repository sync failed installation_id=%s action=%s",
                        installation_id,
                        action,
                    )
        return
