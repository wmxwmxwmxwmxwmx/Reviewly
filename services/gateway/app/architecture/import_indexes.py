"""O(1) import target resolution indexes built once per scan."""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path

_TS_EXTENSIONS = ("", ".ts", ".tsx", ".js", ".mjs", ".cjs", "/index.ts", "/index.tsx", "/index.js")


def build_python_module_lookup(path_to_id: dict[str, str]) -> dict[str, str]:
    """Map top-level module name -> unique file path (O(n) build, O(1) lookup)."""
    groups: dict[str, list[str]] = defaultdict(list)
    for rel in path_to_id:
        stem = Path(rel).stem
        if stem != "__init__":
            groups[stem].append(rel)
        parts = rel.split("/")
        if len(parts) > 1 and parts[-1] == "__init__.py":
            groups[parts[-2]].append(rel)
    return {name: paths[0] for name, paths in groups.items() if len(paths) == 1}


def build_basename_lookup(path_to_id: dict[str, str]) -> dict[str, str]:
    """Map file basename -> unique path (for C++ includes)."""
    groups: dict[str, list[str]] = defaultdict(list)
    for rel in path_to_id:
        groups[Path(rel).name].append(rel)
    return {name: paths[0] for name, paths in groups.items() if len(paths) == 1}


def resolve_python_import(
    target: str,
    rel_path: str,
    path_to_id: dict[str, str],
    module_lookup: dict[str, str],
) -> str | None:
    if target.startswith("."):
        base_dir = Path(rel_path).parent
        parts = target.lstrip(".").split(".")
        while parts and not parts[0]:
            parts.pop(0)
            base_dir = base_dir.parent
        if not parts:
            return None
        candidate = (base_dir / "/".join(parts)).with_suffix(".py").as_posix()
        if candidate in path_to_id:
            return candidate
        init_cand = (Path(candidate).parent / "__init__.py").as_posix()
        if init_cand in path_to_id:
            return init_cand
        return None

    base_dir = Path(rel_path).parent
    parts = target.split(".")
    candidate = (base_dir / "/".join(parts)).with_suffix(".py").as_posix()
    if candidate in path_to_id:
        return candidate
    return module_lookup.get(parts[0])


def resolve_typescript_import(
    target: str,
    rel_path: str,
    path_to_id: dict[str, str],
) -> str | None:
    if not target.startswith("."):
        return None
    base = Path(rel_path).parent / target
    for ext in _TS_EXTENSIONS:
        cand = base.as_posix() + ext
        if cand.startswith("./"):
            cand = cand[2:]
        if cand in path_to_id:
            return cand
    return None


def resolve_cpp_import(
    target: str,
    rel_path: str,
    path_to_id: dict[str, str],
    basename_lookup: dict[str, str],
) -> str | None:
    base = Path(rel_path).parent
    cand = (base / target).as_posix()
    if cand in path_to_id:
        return cand
    return basename_lookup.get(Path(target).name)
