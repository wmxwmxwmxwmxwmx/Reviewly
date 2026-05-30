"""Extract TypeScript/JavaScript import targets."""
from __future__ import annotations

import re

_IMPORT_RE = re.compile(
    r"""(?:from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))"""
)

_MAX_IMPORTS = 256


def extract_typescript_imports(content: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for match in _IMPORT_RE.finditer(content):
        if len(out) >= _MAX_IMPORTS:
            break
        raw = (match.group(1) or match.group(2) or match.group(3) or "").strip()
        if not raw:
            continue
        if raw.startswith("."):
            key = raw
        elif not raw.startswith("@") and "/" not in raw:
            key = raw.split("/")[0]
        else:
            continue
        if key not in seen:
            seen.add(key)
            out.append(key)
    return out
