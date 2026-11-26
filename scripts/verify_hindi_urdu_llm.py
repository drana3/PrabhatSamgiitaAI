#!/usr/bin/env python3
"""Batch LLM lyric review for Hindi/Urdu catalogue songs (offline)."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.services.hindi_urdu_llm import (  # noqa: E402
    LLM_OUTPUT,
    load_llm_verification,
    run_llm_verification_batch,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--disagreements-only",
        action="store_true",
        help="Call LLM only when rule scores tie or confidence is low",
    )
    parser.add_argument(
        "--extra",
        type=int,
        nargs="*",
        default=[],
        help="Extra song numbers (e.g. FAQ outliers like 4146)",
    )
    args = parser.parse_args()
    rows = asyncio.run(
        run_llm_verification_batch(
            disagreements_only=args.disagreements_only,
            extra_numbers=args.extra,
        )
    )
    print(f"Wrote {len(rows)} rows to {LLM_OUTPUT}")
    for row in rows:
        print(
            f"{row.song_number:4} {row.collection_primary:5} "
            f"{row.lyric_language:12} {row.confidence:6}  {row.title[:40]}"
        )
    if args.extra:
        loaded = load_llm_verification()
        missing = [n for n in args.extra if n not in loaded]
        if missing:
            print(f"Warning: extra numbers missing from output: {missing}", file=sys.stderr)


if __name__ == "__main__":
    main()