from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_GATEWAY_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _GATEWAY_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE) if _ENV_FILE.is_file() else None,
        extra="ignore",
    )

    app_name: str = "PRism Gateway"
    debug: bool = False
    database_url: str = "postgresql+psycopg://prism:prism@localhost:5432/prism"
    engine_grpc_addr: str = "localhost:50051"
    prism_stub_engine: bool = True
    github_app_id: str = ""
    github_app_private_key: str = ""
    github_webhook_secret: str = ""
    app_url: str = "http://localhost:3000"
    settings_encryption_key: str = ""
    prism_seed_db: bool = False
    github_app_slug: str = "prism-reviewly"
    github_pat: str = ""
    github_oauth_client_id: str = ""
    github_oauth_client_secret: str = ""
    jwt_secret: str = ""
    jwt_expire_minutes: int = 60 * 24 * 7
    oauth_callback_url: str = "http://localhost:3001/api/auth/github/callback"
    frontend_url: str = "http://localhost:3000"
    prism_auth_bypass: bool = False
    prism_allow_legacy_sync: bool = False
    prism_repo_cache_dir: str = "./data/repo-cache"
    prism_fail_on_migration_error: bool = False
    architecture_scan_max_files: int = 8000
    architecture_scan_max_edges: int = 25000
    repo_cache_ttl_hours: int = 24
    git_clone_timeout_seconds: int = 1800
    prism_analysis_cost_per_run_usd: float = 0.05


settings = Settings()
