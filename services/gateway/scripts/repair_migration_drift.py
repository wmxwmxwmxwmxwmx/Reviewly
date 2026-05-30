"""Repair alembic version drift when schema columns exist but version is behind.

Usage:
  cd services/gateway
  python scripts/repair_migration_drift.py
  alembic upgrade head
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_GATEWAY_ROOT = Path(__file__).resolve().parents[1]
if str(_GATEWAY_ROOT) not in sys.path:
    sys.path.insert(0, str(_GATEWAY_ROOT))

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core.config import settings


def _current_version(conn) -> str | None:
    if not inspect(conn).has_table("alembic_version"):
        return None
    row = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).fetchone()
    return str(row[0]) if row else None


def _stamp(cfg: Config, revision: str) -> None:
    command.stamp(cfg, revision)
    print(f"Stamped alembic_version -> {revision}")


def main() -> None:
    engine = create_engine(settings.database_url)
    cfg = Config(str(_GATEWAY_ROOT / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)

    prev_cwd = os.getcwd()
    try:
        os.chdir(_GATEWAY_ROOT)
        with engine.connect() as conn:
            version = _current_version(conn)
            print(f"Current alembic version: {version or '(none)'}")
            print(f"Database: {settings.database_url}")

            repo_cols = (
                {c["name"] for c in inspect(conn).get_columns("repositories")}
                if inspect(conn).has_table("repositories")
                else set()
            )
            pr_cols = (
                {c["name"] for c in inspect(conn).get_columns("pull_requests")}
                if inspect(conn).has_table("pull_requests")
                else set()
            )

            target = version or "000"
            version_rank = {
                None: -1,
                "001": 1,
                "002": 2,
                "003": 3,
                "004": 4,
                "005": 5,
                "006": 6,
                "007": 7,
                "008": 8,
                "009": 9,
                "010": 10,
            }

            def behind(rev: str) -> bool:
                return version_rank.get(version, -1) < version_rank[rev]

            if "source_type" in repo_cols and behind("008"):
                _stamp(cfg, "008")
                version = "008"

            if "owner_user_id" in pr_cols and behind("009"):
                _stamp(cfg, "009")
                version = "009"

            if "managed" in repo_cols and "repository_type" in repo_cols and behind("010"):
                aj_cols = (
                    {c["name"] for c in inspect(conn).get_columns("analysis_jobs")}
                    if inspect(conn).has_table("analysis_jobs")
                    else set()
                )
                af_cols = (
                    {c["name"] for c in inspect(conn).get_columns("analysis_findings")}
                    if inspect(conn).has_table("analysis_findings")
                    else set()
                )
                complete_010 = (
                    inspect(conn).has_table("repository_jobs")
                    and "repository_id" in aj_cols
                    and "repository_job_id" in aj_cols
                    and "repository_id" in af_cols
                )
                if complete_010:
                    _stamp(cfg, "010")
                    version = "010"
                else:
                    print(
                        "Migration 010 incomplete (missing repository_jobs columns). "
                        "Stamping 009 so `alembic upgrade head` can finish 010."
                    )
                    if behind("009") or version == "010":
                        _stamp(cfg, "009")
                        version = "009"

            print(f"Version after repair: {version or '(none)'}")
    finally:
        os.chdir(prev_cwd)

    print("Next step: alembic upgrade head")


if __name__ == "__main__":
    main()
