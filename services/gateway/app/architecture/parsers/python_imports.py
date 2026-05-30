"""Extract Python import targets from source."""
from __future__ import annotations

import re

_IMPORT_RE = re.compile(
    r"^\s*(?:from\s+(\.?[\w.]+)\s+import|import\s+([\w.]+))",
    re.MULTILINE,
)

_MAX_IMPORTS = 256


def extract_python_imports(content: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for match in _IMPORT_RE.finditer(content):
        if len(out) >= _MAX_IMPORTS:
            break
        mod = match.group(1) or match.group(2)
        if not mod:
            continue
        if mod.startswith("."):
            key = mod
        else:
            key = mod.split(".")[0]
        if key not in seen:
            seen.add(key)
            out.append(key)
    return out
