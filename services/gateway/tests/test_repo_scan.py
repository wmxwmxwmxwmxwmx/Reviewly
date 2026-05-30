"""Tests for repository-level security/performance scans."""
from __future__ import annotations

from pathlib import Path

from app.services.repo_scan import _collect_findings


def test_collect_findings_uses_path_list_not_tuple(tmp_path: Path) -> None:
    src = tmp_path / "src"
    src.mkdir()
    (src / "main.py").write_text(
        'password = "hardcoded-secret"\n',
        encoding="utf-8",
    )

    findings = _collect_findings(tmp_path, finding_type="security")

    assert isinstance(findings, list)
    for finding in findings:
        file_field = finding.get("file")
        assert isinstance(file_field, str)
        assert "/" in file_field or file_field.endswith(".py")
