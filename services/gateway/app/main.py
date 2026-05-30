import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.dev_errors import dev_error_payload
from app.db.models import Base
from app.db.seed_loader import load_seed_if_empty
from app.db.session import SessionLocal, engine
from app.repositories import governance as governance_repo

logger = logging.getLogger(__name__)

migration_status: str = "unknown"
migration_error: str | None = None


def _configure_logging() -> None:
    """Ensure unhandled exceptions print full stack traces to the Gateway console."""
    level = logging.DEBUG if settings.debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        force=True,
    )
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)


_configure_logging()


def _run_alembic_upgrade() -> bool:
    """Apply pending DB migrations (same as `alembic upgrade head` in dev-gateway.ps1)."""
    global migration_status, migration_error

    try:
        from alembic import command
        from alembic.config import Config
    except ImportError:
        migration_status = "skipped"
        migration_error = "Alembic not installed"
        logger.warning("Alembic not installed; skipping database migrations")
        return False

    gateway_dir = Path(__file__).resolve().parents[1]
    ini_path = gateway_dir / "alembic.ini"
    if not ini_path.is_file():
        migration_status = "skipped"
        migration_error = f"alembic.ini not found at {ini_path}"
        logger.warning("%s; skipping migrations", migration_error)
        return False

    prev_cwd = os.getcwd()
    try:
        os.chdir(gateway_dir)
        cfg = Config(str(ini_path))
        command.upgrade(cfg, "head")
        migration_status = "ok"
        migration_error = None
        logger.info("Database migrations applied (alembic upgrade head)")
        return True
    except Exception as exc:
        migration_status = "failed"
        migration_error = str(exc)
        logger.exception(
            "Alembic upgrade failed. Run `cd services/gateway && alembic upgrade head` "
            "or `python scripts/repair_migration_drift.py` then retry.",
        )
        if settings.prism_fail_on_migration_error or settings.debug:
            raise
        return False
    finally:
        os.chdir(prev_cwd)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ready = False
    _run_alembic_upgrade()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        governance_repo.ensure_governance_schema(db)
        if settings.prism_seed_db:
            load_seed_if_empty(db)
    finally:
        db.close()
    app.state.ready = True
    logger.info("Gateway startup complete (ready for API traffic)")
    yield
    app.state.ready = False
    logger.info("Gateway shutting down")


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.state.ready = False
app.include_router(api_router)


@app.middleware("http")
async def gateway_readiness(request: Request, call_next):
    """Reject API calls until migrations and schema bootstrap finish (avoids startup race 500s)."""
    if request.url.path.startswith("/api/") and not getattr(request.app.state, "ready", False):
        return JSONResponse(
            status_code=503,
            content={
                "error": "Gateway 正在启动，请稍候再试",
                "code": "GATEWAY_STARTING",
            },
        )
    return await call_next(request)


@app.middleware("http")
async def import_request_diagnostics(request: Request, call_next):
    """Log PR import requests when DEBUG is enabled."""
    path = request.url.path
    is_import = request.method == "POST" and path == "/api/pull-requests/import"
    if settings.debug and is_import:
        logger.info("=== FastAPI === received request: %s %s", request.method, path)
    response = await call_next(request)
    if settings.debug and is_import:
        logger.info(
            "=== FastAPI === response status: %s for %s %s",
            response.status_code,
            request.method,
            path,
        )
    return response


@app.get("/")
def root() -> dict:
    return {"service": "prism-gateway", "status": "ok"}


@app.get("/health")
def health(request: Request) -> dict:
    ready = bool(getattr(request.app.state, "ready", False))
    payload: dict = {
        "status": "ok" if ready and migration_status in ("ok", "skipped", "unknown") else "degraded",
        "ready": ready,
        "database": settings.database_url.split("://")[0],
        "migrations": migration_status,
    }
    if migration_error:
        payload["migrationError"] = migration_error
    return payload


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"error": "请求参数无效", "details": exc.errors()})


@app.exception_handler(Exception)
async def generic_handler(_: Request, exc: Exception) -> JSONResponse:
    from fastapi import HTTPException

    if isinstance(exc, HTTPException):
        detail = exc.detail
        if isinstance(detail, dict):
            return JSONResponse(status_code=exc.status_code, content=detail)
        return JSONResponse(status_code=exc.status_code, content={"error": str(detail)})
    logger.exception("Unhandled server error")
    return JSONResponse(
        status_code=500,
        content=dev_error_payload(exc),
    )
