"""Post AI review comments to GitHub PRs (GitHub App)."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)


async def post_review_summary(
    session: Session,
    *,
    owner: str,
    repo: str,
    pr_number: int,
    summary_markdown: str,
    installation_id: str | None,
) -> bool:
    """Post a PRism AI review comment when App credentials are configured."""
    if not settings.github_app_id or not settings.github_app_private_key:
        logger.debug("GitHub App not configured; skipping PR review comment")
        return False
    if not installation_id:
        return False
    # Full review API integration deferred; log intent for operators.
    logger.info(
        "PRism AI Review ready for %s/%s#%s (%s chars); wire GitHub Reviews API in App phase",
        owner,
        repo,
        pr_number,
        len(summary_markdown),
    )
    return False
