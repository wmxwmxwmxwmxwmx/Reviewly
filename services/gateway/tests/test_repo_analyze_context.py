"""Tests for repository AI analyze context assembly."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


def test_analyze_context_includes_tree_and_configs(client: TestClient) -> None:
    repos = client.get("/api/repos").json()
    if not repos:
        return
    repo_id = repos[0]["id"]

    with (
        patch(
            "app.services.repo_analyze_context.repo_context.resolve_access_token",
            new_callable=AsyncMock,
            return_value="ghp_test",
        ),
        patch(
            "app.services.repo_analyze_context.repo_context.fetch_readme",
            new_callable=AsyncMock,
            return_value=("# Reviewly\n\nAI PR tool", None),
        ),
        patch(
            "app.services.repo_analyze_context.repo_context.fetch_file_tree",
            new_callable=AsyncMock,
            return_value=("apps/web/package.json\nservices/gateway/pyproject.toml", None),
        ),
        patch(
            "app.services.repo_analyze_context.repo_context.fetch_config_snippets",
            new_callable=AsyncMock,
            return_value={"package.json": '{"name":"reviewly"}'},
        ),
    ):
        r = client.get(f"/api/repos/{repo_id}/analyze-context")

    assert r.status_code == 200
    body = r.json()
    assert "Reviewly" in body["readme"]
    assert "apps/web" in body["fileTree"]
    assert "package.json" in body["configSnippets"]


def test_fetch_file_tree_sorts_paths() -> None:
    from app.github.repo_context import fetch_file_tree

    tree_payload = {
        "tree": [
            {"path": "b.txt", "type": "blob"},
            {"path": "a.txt", "type": "blob"},
            {"path": "dir", "type": "tree"},
        ],
        "truncated": False,
    }

    async def _run() -> None:
        with (
            patch(
                "app.github.repo_context._get_json",
                new_callable=AsyncMock,
                side_effect=[
                    {"object": {"sha": "abc"}},
                    tree_payload,
                ],
            ),
        ):
            text, warn = await fetch_file_tree("o", "r", "token", default_branch="main")
            assert warn is None
            assert text.split("\n") == ["a.txt", "b.txt"]

    import asyncio

    asyncio.run(_run())


def test_select_tree_paths_prioritizes_monorepo_roots() -> None:
    from app.github.repo_context import _select_tree_paths

    noise = [f".agents/skills/skill-{i}/SKILL.md" for i in range(450)]
    paths = noise + [
        "apps/web/package.json",
        "services/gateway/app/main.py",
        "packages/shared/src/index.ts",
    ]
    display, truncated = _select_tree_paths(paths, 400)
    assert truncated
    assert any(p.startswith("apps/") for p in display)
    assert any(p.startswith("services/") for p in display)
    assert any(p.startswith("packages/") for p in display)
