"""Tests for import resolution indexes."""
from __future__ import annotations

from app.architecture.import_indexes import (
    build_python_module_lookup,
    resolve_python_import,
    resolve_typescript_import,
)


def test_python_module_lookup_is_o1() -> None:
    paths = {
        "services/user_service.py": "services/user_service.py",
        "repositories/user_repository.py": "repositories/user_repository.py",
    }
    lookup = build_python_module_lookup(paths)
    assert lookup["user_service"] == "services/user_service.py"
    assert (
        resolve_python_import("user_service", "controllers/x.py", paths, lookup)
        == "services/user_service.py"
    )


def test_typescript_relative_resolve() -> None:
    paths = {"src/util/helper.ts": "src/util/helper.ts", "src/app.ts": "src/app.ts"}
    assert (
        resolve_typescript_import("./util/helper", "src/app.ts", paths)
        == "src/util/helper.ts"
    )


def test_python_relative_import() -> None:
    paths = {"pkg/mod/utils.py": "pkg/mod/utils.py", "pkg/mod/main.py": "pkg/mod/main.py"}
    lookup = build_python_module_lookup(paths)
    assert (
        resolve_python_import(".utils", "pkg/mod/main.py", paths, lookup)
        == "pkg/mod/utils.py"
    )
