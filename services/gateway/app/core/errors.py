from fastapi import HTTPException

SCHEMA_OUTDATED_MESSAGE = (
    "数据库 schema 未更新。请在 services/gateway 目录执行 "
    "python scripts/repair_migration_drift.py 与 alembic upgrade head 后重启 Gateway。"
)


def api_error(message: str, status: int = 400, code: str | None = None) -> HTTPException:
    body: dict[str, str] = {"error": message}
    if code:
        body["code"] = code
    return HTTPException(status_code=status, detail=body)
