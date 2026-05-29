"""Parse GitHub pull request and repository URLs."""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.errors import api_error

# owner/repo/pull/123 with optional /files or query string
_PR_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/"
    r"(?P<owner>[\w.-]+)/(?P<repo>[\w.-]+)/pull/(?P<number>\d+)"
    r"(?:/files)?(?:[?#].*)?$",
    re.IGNORECASE,
)

# owner/repo with optional trailing slash, .git, or query string
_REPO_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/"
    r"(?P<owner>[\w.-]+)/(?P<repo>[\w.-]+?)(?:\.git)?/?(?:[?#].*)?$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ParsedPrUrl:
    owner: str
    repo: str
    number: int

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.repo}"


@dataclass(frozen=True)
class ParsedRepoUrl:
    owner: str
    repo: str

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.repo}"


def parse_github_repo_url(url: str) -> ParsedRepoUrl:
    raw = url.strip()
    if not raw:
        raise api_error("Please provide a GitHub repository URL", 400)

    if "/pull/" in raw.lower():
        raise api_error(
            "This URL is a pull request link. Use PR import instead.",
            400,
        )

    match = _REPO_URL_RE.search(raw)
    if not match:
        raise api_error(
            "Invalid GitHub repository URL (e.g. https://github.com/owner/repo)",
            400,
        )

    return ParsedRepoUrl(
        owner=match.group("owner"),
        repo=match.group("repo"),
    )


def parse_github_pr_url(url: str) -> ParsedPrUrl:
    raw = url.strip()
    if not raw:
        raise api_error("请输入 GitHub PR 链接", 400)

    match = _PR_URL_RE.search(raw)
    if not match:
        raise api_error("请输入有效的 GitHub PR 链接（例如 https://github.com/owner/repo/pull/123）", 400)

    return ParsedPrUrl(
        owner=match.group("owner"),
        repo=match.group("repo"),
        number=int(match.group("number")),
    )
