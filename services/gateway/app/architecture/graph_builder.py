"""Build dependency graph from cloned repository."""
from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from app.architecture.layers import classify_layer
from app.architecture.parsers import (
    extract_cpp_includes,
    extract_python_imports,
    extract_typescript_imports,
)
from app.architecture.walker import iter_source_files, language_for
from app.core.config import settings

ProgressFn = Callable[[str, int, int | None, str], None]


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def _node_id(rel: str) -> str:
    return rel.replace("\\", "/")


def _resolve_python(target: str, rel_path: str, index: dict[str, str]) -> str | None:
    base_dir = Path(rel_path).parent
    parts = target.split(".")
    candidate = (base_dir / "/".join(parts)).with_suffix(".py")
    rel = candidate.as_posix()
    if rel in index:
        return index[rel]
    alt = f"{parts[0]}.py"
    for key in index:
        if key.endswith(f"/{alt}") or key == alt:
            return index[key]
    return None


def _resolve_ts(target: str, rel_path: str, index: dict[str, str]) -> str | None:
    if not target.startswith("."):
        return None
    base = Path(rel_path).parent / target
    for ext in ("", ".ts", ".tsx", ".js", "/index.ts", "/index.tsx"):
        cand = _node_id((base.as_posix() + ext).lstrip("./"))
        if cand in index:
            return index[cand]
        for key in index:
            if key.endswith(cand.split("/")[-1] + ext.split("/")[-1]):
                return index[key]
    return None


def _resolve_cpp(target: str, rel_path: str, index: dict[str, str]) -> str | None:
    base = Path(rel_path).parent
    cand = (base / target).as_posix()
    if cand in index:
        return index[cand]
    name = Path(target).name
    for key in index:
        if key.endswith(name):
            return index[key]
    return None


def build_graph(repo_root: Path, on_progress: ProgressFn | None = None) -> dict:
    def emit(phase: str, current: int, total: int | None, message: str) -> None:
        if on_progress:
            on_progress(phase, current, total, message)

    root = repo_root.resolve()
    emit("discover", 0, None, "正在扫描源文件…")
    files = iter_source_files(root, settings.architecture_scan_max_files)
    total = len(files)
    emit("discover", total, total, f"发现 {total} 个源文件")

    path_to_id: dict[str, str] = {}
    nodes: list[dict] = []
    import_counts: dict[str, int] = {}

    emit("nodes", 0, total or None, "正在解析模块…")
    for idx, fpath in enumerate(files):
        rel = _node_id(str(fpath.relative_to(root)))
        path_to_id[rel] = rel
        content = _read_text(fpath)
        lang = language_for(fpath)
        nodes.append(
            {
                "id": rel,
                "label": Path(rel).name,
                "path": rel,
                "language": lang,
                "layer": classify_layer(rel),
                "lines": content.count("\n") + 1 if content else 0,
                "importCount": 0,
            }
        )
        if total and (idx % 10 == 0 or idx == total - 1):
            emit("nodes", idx + 1, total, f"正在解析模块 ({idx + 1}/{total})")

    edges: list[dict] = []
    emit("edges", 0, total or None, "正在分析依赖…")
    for idx, fpath in enumerate(files):
        rel = _node_id(str(fpath.relative_to(root)))
        content = _read_text(fpath)
        lang = language_for(fpath)
        targets: list[str] = []
        if lang == "python":
            targets = extract_python_imports(content)
        elif lang == "typescript":
            targets = extract_typescript_imports(content)
        elif lang == "cpp":
            targets = extract_cpp_includes(content)

        resolved = 0
        for t in targets:
            dest: str | None = None
            if lang == "python":
                dest = _resolve_python(t, rel, path_to_id)
            elif lang == "typescript":
                dest = _resolve_ts(t, rel, path_to_id)
            elif lang == "cpp":
                dest = _resolve_cpp(t, rel, path_to_id)
            if dest and dest != rel:
                edges.append({"from": rel, "to": dest, "kind": "import"})
                resolved += 1
        import_counts[rel] = resolved
        if total and (idx % 10 == 0 or idx == total - 1):
            emit("edges", idx + 1, total, f"正在分析依赖 ({idx + 1}/{total})")

    for node in nodes:
        node["importCount"] = import_counts.get(node["id"], 0)

    from app.architecture.analysis import analyze_graph

    emit("metrics", 0, None, "正在计算架构指标…")
    metrics = analyze_graph(nodes, edges)
    emit("metrics", 1, 1, "指标计算完成")

    return {
        "nodes": nodes,
        "edges": edges,
        "metrics": metrics,
        "status": "ok",
    }
