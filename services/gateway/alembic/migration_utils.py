"""Shared helpers for idempotent Alembic migrations."""
from __future__ import annotations

from sqlalchemy import inspect


def column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = inspect(bind)
    if not inspector.has_table(table_name):
        return False
    return column_name in {col["name"] for col in inspector.get_columns(table_name)}


def table_exists(bind, table_name: str) -> bool:
    return inspect(bind).has_table(table_name)


def index_exists(bind, table_name: str, index_name: str) -> bool:
    inspector = inspect(bind)
    if not inspector.has_table(table_name):
        return False
    return index_name in {idx["name"] for idx in inspector.get_indexes(table_name)}


def fk_exists(bind, fk_name: str) -> bool:
    inspector = inspect(bind)
    for table_name in inspector.get_table_names():
        for fk in inspector.get_foreign_keys(table_name):
            if fk.get("name") == fk_name:
                return True
    return False
