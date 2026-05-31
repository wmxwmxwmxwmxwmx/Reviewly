"""本地开发用：探测可用数据库连接，Postgres 不可用时回退 SQLite。"""
from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

_GATEWAY_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_SQLITE = f"sqlite:///{(_GATEWAY_ROOT / 'prism.db').as_posix()}"
_PROBE_TIMEOUT_SEC = 3

_STANDARD_POSTGRES = (
    "postgresql+psycopg://prism:prism@127.0.0.1:5432/prism",
    "postgresql+psycopg://prism:prism@localhost:5432/prism",
)


def _is_sqlite(url: str) -> bool:
    return url.strip().lower().startswith("sqlite")


def _probe_postgres(url: str) -> bool:
    try:
        engine = create_engine(
            url,
            poolclass=NullPool,
            connect_args={"connect_timeout": _PROBE_TIMEOUT_SEC},
        )
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def _repo_root() -> Path:
    return _GATEWAY_ROOT.parent.parent


def _try_start_docker_postgres() -> bool:
    """auto 模式下 Postgres 不可达时，尝试拉起 deploy 栈中的 postgres 服务。"""
    if os.environ.get("PRISM_DEV_SKIP_DOCKER_DB", "").strip() in ("1", "true", "yes"):
        return False
    if not shutil.which("docker"):
        return False
    compose = _repo_root() / "deploy" / "docker-compose.yml"
    if not compose.is_file():
        return False
    try:
        subprocess.run(
            ["docker", "compose", "-f", str(compose), "up", "-d", "postgres"],
            cwd=_repo_root(),
            capture_output=True,
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    for _ in range(30):
        for url in _STANDARD_POSTGRES:
            if _probe_postgres(url):
                return True
        time.sleep(1)
    return False


def _postgres_candidates(configured: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for url in (configured, *_STANDARD_POSTGRES):
        u = url.strip()
        if not u or _is_sqlite(u) or u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def resolve_dev_database_url() -> tuple[str, str]:
    """
    解析本地开发 DATABASE_URL。

    Returns:
        (database_url, mode) — mode 为 ``postgres`` 或 ``sqlite``。
    """
    mode = os.environ.get("PRISM_DATABASE_MODE", "auto").strip().lower()
    configured = os.environ.get("DATABASE_URL", "").strip()

    if mode == "sqlite":
        url = configured if configured and _is_sqlite(configured) else _DEFAULT_SQLITE
        return url, "sqlite"

    if configured and _is_sqlite(configured):
        return configured, "sqlite"

    candidates = _postgres_candidates(configured)

    if mode == "postgres":
        for url in candidates:
            if _probe_postgres(url):
                return url, "postgres"
        raise RuntimeError(
            "PostgreSQL 不可用（PRISM_DATABASE_MODE=postgres）。"
            "请执行 npm run dev:db 启动 Docker Postgres，或修正 DATABASE_URL。"
        )

    for url in candidates:
        if _probe_postgres(url):
            return url, "postgres"

    if _try_start_docker_postgres():
        for url in candidates:
            if _probe_postgres(url):
                return url, "postgres"

    sqlite_url = configured if configured and _is_sqlite(configured) else _DEFAULT_SQLITE
    return sqlite_url, "sqlite"
