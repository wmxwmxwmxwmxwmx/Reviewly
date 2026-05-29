"""Heuristic layer classification from file paths."""
from __future__ import annotations

from pathlib import Path


def classify_layer(rel_path: str) -> str:
    lower = rel_path.replace("\\", "/").lower()
    name = Path(rel_path).name.lower()
    if any(x in lower for x in ("/controller", "/controllers", "/routes", "/api/")):
        return "controller"
    if "controller" in name:
        return "controller"
    if any(x in lower for x in ("/service", "/services", "/usecase", "/usecases")):
        return "service"
    if "service" in name and "repository" not in name:
        return "service"
    if any(x in lower for x in ("/repository", "/repositories", "/dao", "/repos/")):
        return "repository"
    if any(x in name for x in ("repository", "_repo.", "dao.")):
        return "repository"
    return "module"


_LAYER_RANK = {"controller": 3, "service": 2, "repository": 1, "module": 0}


def layer_violation(from_layer: str, to_layer: str) -> str | None:
    if from_layer == "module" or to_layer == "module":
        return None
    if _LAYER_RANK.get(from_layer, 0) < _LAYER_RANK.get(to_layer, 0):
        return f"{from_layer} 不应依赖 {to_layer}"
    return None
