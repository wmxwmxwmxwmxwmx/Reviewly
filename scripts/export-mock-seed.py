"""One-off: copy mock structures into gateway seed JSON (no TS parser)."""
from __future__ import annotations

import json
from pathlib import Path

# Inline mirror of apps/web mock-data (kept in sync manually on mock changes).
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "services" / "gateway" / "app" / "mock" / "seed_data.json"

# Import by reading TS is skipped; data loaded from existing seed_data if present else minimal.
OUT.parent.mkdir(parents=True, exist_ok=True)

if OUT.exists():
    print(f"seed_data.json already exists at {OUT}")
else:
    minimal = {
        "defaultPrId": "pr-2847",
        "repos": [
            {
                "id": "repo-payment",
                "fullName": "acme-corp/backend",
                "defaultBranch": "main",
                "openPrCount": 12,
                "healthScore": 78,
                "aiReviewEnabled": True,
            }
        ],
    }
    OUT.write_text(json.dumps(minimal, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote minimal {OUT}")
