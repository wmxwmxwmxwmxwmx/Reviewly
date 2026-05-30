"""Build dependency graph from cloned repository."""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from app.architecture.analysis import analyze_graph
from app.architecture.import_indexes import (
    build_basename_lookup,
    build_python_module_lookup,
    resolve_cpp_import,
    resolve_python_import,
    resolve_typescript_import,
)
from app.architecture.layers import classify_layer
from app.architecture.parsers import (
    extract_cpp_includes,
    extract_python_imports,
    extract_typescript_imports,
)
from app.architecture.walker import iter_source_files, language_for
from app.core.config import settings

ProgressFn = Callable[[str, int, int | None, str], None]

_PROGRESS_INTERVAL = 25


@dataclass(slots=True)
class _FileRecord:
    rel: str
    lang: str
    content: str
    lines: int


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def _line_count(content: str) -> int:
    if not content:
        return 0
    return content.count("\n") + (0 if content.endswith("\n") else 1)


def _emit_progress(
    emit: Callable[[str, int, int | None, str], None],
    phase: str,
    idx: int,
    total: int,
    message: str,
) -> None:
    if idx % _PROGRESS_INTERVAL == 0 or idx == total - 1:
        emit(phase, idx + 1, total, message)


def _load_file_records(
    root: Path,
    files: list[Path],
    emit: Callable[[str, int, int | None, str], None],
) -> tuple[list[_FileRecord], dict[str, str]]:
    total = len(files)
    records: list[_FileRecord] = []
    path_to_id: dict[str, str] = {}

    emit("nodes", 0, total or None, "正在解析模块…")
    for idx, fpath in enumerate(files):
        rel = fpath.relative_to(root).as_posix().replace("\\", "/")
        path_to_id[rel] = rel
        content = _read_text(fpath)
        records.append(
            _FileRecord(
                rel=rel,
                lang=language_for(fpath),
                content=content,
                lines=_line_count(content),
            )
        )
        _emit_progress(emit, "nodes", idx, total, f"正在解析模块 ({idx + 1}/{total})")

    return records, path_to_id


def _build_edges(
    records: list[_FileRecord],
    path_to_id: dict[str, str],
    emit: Callable[[str, int, int | None, str], None],
) -> tuple[list[dict], dict[str, int]]:
    total = len(records)
    max_edges = settings.architecture_scan_max_edges
    python_lookup = build_python_module_lookup(path_to_id)
    basename_lookup = build_basename_lookup(path_to_id)

    edges: list[dict] = []
    edge_keys: set[tuple[str, str]] = set()
    import_counts: dict[str, int] = {}

    emit("edges", 0, total or None, "正在分析依赖…")
    for idx, rec in enumerate(records):
        targets: list[str]
        if rec.lang == "python":
            targets = extract_python_imports(rec.content)
        elif rec.lang == "typescript":
            targets = extract_typescript_imports(rec.content)
        elif rec.lang == "cpp":
            targets = extract_cpp_includes(rec.content)
        else:
            targets = []

        resolved = 0
        for target in targets:
            if len(edges) >= max_edges:
                break
            dest: str | None = None
            if rec.lang == "python":
                dest = resolve_python_import(target, rec.rel, path_to_id, python_lookup)
            elif rec.lang == "typescript":
                dest = resolve_typescript_import(target, rec.rel, path_to_id)
            elif rec.lang == "cpp":
                dest = resolve_cpp_import(target, rec.rel, path_to_id, basename_lookup)

            if dest and dest != rec.rel:
                key = (rec.rel, dest)
                if key not in edge_keys:
                    edge_keys.add(key)
                    edges.append({"from": rec.rel, "to": dest, "kind": "import"})
                    resolved += 1

        import_counts[rec.rel] = resolved
        _emit_progress(emit, "edges", idx, total, f"正在分析依赖 ({idx + 1}/{total})")

    return edges, import_counts


def build_graph(repo_root: Path, on_progress: ProgressFn | None = None) -> dict:
    def emit(phase: str, current: int, total: int | None, message: str) -> None:
        if on_progress:
            on_progress(phase, current, total, message)

    root = repo_root.resolve()
    emit("discover", 0, None, "正在扫描源文件…")
    files, total_discovered, truncated = iter_source_files(
        root, settings.architecture_scan_max_files
    )
    total = len(files)
    discover_msg = f"发现 {total_discovered} 个源文件"
    if truncated:
        discover_msg += f"，分析前 {total} 个（大仓库采样）"
    emit("discover", total, total, discover_msg)

    records, path_to_id = _load_file_records(root, files, emit)
    edges, import_counts = _build_edges(records, path_to_id, emit)

    nodes = [
        {
            "id": rec.rel,
            "label": Path(rec.rel).name,
            "path": rec.rel,
            "language": rec.lang,
            "layer": classify_layer(rec.rel),
            "lines": rec.lines,
            "importCount": import_counts.get(rec.rel, 0),
        }
        for rec in records
    ]

    emit("metrics", 0, None, "正在计算架构指标…")
    metrics = analyze_graph(nodes, edges)
    summary = metrics.setdefault("summary", {})
    summary["filesDiscovered"] = total_discovered
    summary["truncated"] = truncated
    summary["edgesTruncated"] = len(edges) >= settings.architecture_scan_max_edges
    emit("metrics", 1, 1, "指标计算完成")

    return {
        "nodes": nodes,
        "edges": edges,
        "metrics": metrics,
        "status": "ok",
    }
