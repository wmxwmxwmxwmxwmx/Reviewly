"""Extract Python import targets from source."""
from __future__ import annotations

import re

_IMPORT_RE = re.compile(
    r"^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))",
    re.MULTILINE,
)


def extract_python_imports(content: str) -> list[str]:
    targets: list[str] = []
    for match in _IMPORT_RE.finditer(content):
        mod = match.group(1) or match.group(2)
        if mod and not mod.startswith("."):
            targets.append(mod.split(".")[0])
    return targets
