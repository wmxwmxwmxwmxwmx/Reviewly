"""One-off repair: add repositories OAuth columns when migration 006 was interrupted."""
from __future__ import annotations

from sqlalchemy import create_engine, text

from app.core.config import settings


def main() -> None:
    engine = create_engine(settings.database_url)
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS owner_user_id VARCHAR(64)"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS visibility VARCHAR(32) "
                "DEFAULT 'private'"
            )
        )
        conn.execute(
            text("ALTER TABLE repositories ADD COLUMN IF NOT EXISTS source VARCHAR(32)")
        )
        fk = conn.execute(
            text(
                "SELECT 1 FROM pg_constraint WHERE conname = 'fk_repositories_owner_user_id'"
            )
        ).scalar()
        if not fk:
            conn.execute(
                text(
                    "ALTER TABLE repositories ADD CONSTRAINT fk_repositories_owner_user_id "
                    "FOREIGN KEY (owner_user_id) REFERENCES auth_users(id)"
                )
            )
        idx = conn.execute(
            text(
                "SELECT 1 FROM pg_indexes WHERE indexname = 'ix_repositories_owner_user_id'"
            )
        ).scalar()
        if not idx:
            conn.execute(
                text(
                    "CREATE INDEX ix_repositories_owner_user_id ON repositories (owner_user_id)"
                )
            )
        conn.execute(text("UPDATE alembic_version SET version_num = '006'"))
    print("Migration 006 repository columns repaired; alembic_version = 006")


if __name__ == "__main__":
    main()
