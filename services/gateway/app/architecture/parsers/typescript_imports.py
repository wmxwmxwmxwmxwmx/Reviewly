"""Extract TypeScript/JavaScript import targets."""
from __future__ import annotations

import re

_PATTERNS = [
    re.compile(r"""from\s+['"]([^'"]+)['"]"""),
    re.compile(r"""import\s+['"]([^'"]+)['"]"""),
    re.compile(r"""require\s*\(\s*['"]([^'"]+)['"]\s*\)"""),
    re.compile(r"""export\s+.*from\s+['"]([^'"]+)['"]"""),
]


def extract_typescript_imports(content: str) -> list[str]:
    targets: list[str] = []
    for pat in _PATTERNS:
        for match in pat.finditer(content):
            raw = match.group(1).strip()
            if raw.startswith("."):
                targets.append(raw)
            elif not raw.startswith("@") and "/" not in raw:
                targets.append(raw.split("/")[0])
    return targets
