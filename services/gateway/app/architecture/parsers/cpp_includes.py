"""Extract C/C++ #include targets."""
from __future__ import annotations

import re

_INCLUDE_RE = re.compile(r'#include\s+[<"]([^">]+)[">]')


def extract_cpp_includes(content: str) -> list[str]:
    return [m.group(1) for m in _INCLUDE_RE.finditer(content)]
