from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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


settings = Settings()
