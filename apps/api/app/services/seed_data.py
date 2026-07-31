from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, cast

DATA_DIR = Path(__file__).resolve().parents[4] / "data"


@lru_cache(maxsize=8)
def load_rows(filename: str) -> list[dict[str, Any]]:
    for folder in ("generated", "seed"):
        path = DATA_DIR / folder / filename
        if path.exists():
            return cast(list[dict[str, Any]], json.loads(path.read_text(encoding="utf-8")))
    return []

