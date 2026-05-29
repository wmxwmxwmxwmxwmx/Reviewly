import pytest

from app.engine.analyzer import analyze_patch
from app.engine.scoring import merge_recommendation, scores_from_findings
from app.engine.summary import build_result_summary


def test_analyze_patch_sql_rule() -> None:
    patch = """diff --git a/db.go b/db.go
--- a/db.go
+++ b/db.go
@@ -1,3 +1,5 @@
+query := fmt.Sprintf("SELECT * FROM t WHERE id=%s", userInput)
"""
    findings, chunks = analyze_patch(patch, ["db.go"])
    assert len(chunks) >= 1
    assert any("SQL" in f.get("title", "") for f in findings)


def test_build_summary() -> None:
    findings = [
        {"id": "1", "type": "security", "severity": "critical", "title": "x", "file": "a.go", "line": 1},
    ]
    summary = build_result_summary(findings, "pr-1")
    assert summary["mergeRecommendation"] == merge_recommendation(scores_from_findings(findings)["riskScore"])
    assert "riskScore" in summary
