#!/usr/bin/env python3
"""输出本地开发应使用的 DATABASE_URL（仅 stdout 一行，说明写 stderr）。"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database_resolve import resolve_dev_database_url


def main() -> int:
    try:
        url, db_mode = resolve_dev_database_url()
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(url, end="")
    if db_mode == "postgres":
        print(f"[PRism] 数据库: PostgreSQL ({url})", file=sys.stderr)
    else:
        print(
            f"[PRism] 数据库: SQLite ({url}) — Postgres 未连通，已自动回退。"
            " 优先 Postgres 可执行: npm run dev:db（或确保 Docker 已运行，dev 会自动尝试拉起 postgres）",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
