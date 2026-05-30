"""AI usage logging and summary."""
from __future__ import annotations

from app.repositories import auth_users as auth_users_repo
from app.services.ai_usage import get_usage_summary, log_ai_usage


def test_log_ai_usage_and_summary(db) -> None:
    user = auth_users_repo.get_or_create_bypass_user(db)
    log_ai_usage(
        db,
        user_id=user.id,
        feature="chat",
        provider="anthropic",
        model="claude-test",
        usage={"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
        latency_ms=100,
    )
    db.commit()

    summary = get_usage_summary(db, user_id=user.id, period="month")
    assert summary["totalTokens"] >= 30
    assert summary["calls"] >= 1
    assert any(row["feature"] == "chat" for row in summary["byFeature"])


def test_usage_summary_api(client) -> None:
    r = client.get("/api/ai/usage/summary?period=month")
    assert r.status_code == 200
    body = r.json()
    assert "totalTokens" in body
    assert "calls" in body
    assert "byFeature" in body
