import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.models import Base
from app.db.seed_loader import load_seed_if_empty
from app.db.session import SessionLocal, engine

logger = logging.getLogger(__name__)


def _run_alembic_upgrade() -> None:
    """Apply pending DB migrations (same as `alembic upgrade head` in dev-gateway.ps1)."""
    try:
        from alembic import command
        from alembic.config import Config
    except ImportError:
        logger.warning("Alembic not installed; skipping database migrations")
        return

    gateway_dir = Path(__file__).resolve().parents[1]
    ini_path = gateway_dir / "alembic.ini"
    if not ini_path.is_file():
        logger.warning("alembic.ini not found at %s; skipping migrations", ini_path)
        return

    prev_cwd = os.getcwd()
    try:
        os.chdir(gateway_dir)
        cfg = Config(str(ini_path))
        command.upgrade(cfg, "head")
        logger.info("Database migrations applied (alembic upgrade head)")
    except Exception as exc:
        logger.warning(
            "Alembic upgrade failed: %s. Run `cd services/gateway && alembic upgrade head` manually.",
            exc,
        )
    finally:
        os.chdir(prev_cwd)


@asynccontextmanager
async def lifespan(_: FastAPI):
    _run_alembic_upgrade()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        load_seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.include_router(api_router)


@app.get("/")
def root() -> dict:
    return {"service": "prism-gateway", "status": "ok"}


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "database": settings.database_url.split("://")[0]}


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
    return JSONResponse(status_code=500, content={"error": "服务器内部错误"})
