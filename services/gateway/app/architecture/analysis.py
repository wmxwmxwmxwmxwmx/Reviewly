"""Graph metrics: cycles, giant modules, layer violations."""
from __future__ import annotations

from collections import defaultdict

from app.architecture.layers import layer_violation

GIANT_LINE_THRESHOLD = 400
GIANT_IMPORT_THRESHOLD = 25


def analyze_graph(nodes: list[dict], edges: list[dict]) -> dict:
    node_map = {n["id"]: n for n in nodes}
    adj: dict[str, list[str]] = defaultdict(list)
    for e in edges:
        adj[e["from"]].append(e["to"])

    cycles = _find_cycles(adj, limit=10)
    giant_modules = [
        {
            "id": n["id"],
            "path": n.get("path", n["id"]),
            "lines": n.get("lines", 0),
            "importCount": n.get("importCount", 0),
        }
        for n in nodes
        if n.get("lines", 0) >= GIANT_LINE_THRESHOLD
        or n.get("importCount", 0) >= GIANT_IMPORT_THRESHOLD
    ]
    giant_modules.sort(key=lambda x: (-x["lines"], -x["importCount"]))

    layer_violations: list[dict] = []
    for e in edges:
        src = node_map.get(e["from"], {})
        dst = node_map.get(e["to"], {})
        reason = layer_violation(src.get("layer", "module"), dst.get("layer", "module"))
        if reason:
            layer_violations.append(
                {"from": e["from"], "to": e["to"], "reason": reason}
            )

    languages: dict[str, int] = defaultdict(int)
    for n in nodes:
        languages[n.get("language", "unknown")] += 1

    return {
        "cycles": cycles,
        "giantModules": giant_modules[:20],
        "layerViolations": layer_violations[:50],
        "summary": {
            "fileCount": len(nodes),
            "edgeCount": len(edges),
            "languages": dict(languages),
        },
    }


def _find_cycles(adj: dict[str, list[str]], limit: int) -> list[list[str]]:
    cycles: list[list[str]] = []
    visited: set[str] = set()
    stack: list[str] = []
    on_stack: set[str] = set()

    def dfs(node: str) -> None:
        if len(cycles) >= limit:
            return
        visited.add(node)
        on_stack.add(node)
        stack.append(node)
        for nxt in adj.get(node, []):
            if nxt not in visited:
                dfs(nxt)
            elif nxt in on_stack:
                idx = stack.index(nxt)
                cycle = stack[idx:] + [nxt]
                if len(cycle) >= 2:
                    cycles.append(cycle)
        stack.pop()
        on_stack.discard(node)

    for start in list(adj.keys()):
        if start not in visited:
            dfs(start)
        if len(cycles) >= limit:
            break
    return cycles
