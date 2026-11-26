#!/usr/bin/env python3
"""Run Hindi/Urdu language verification and print the audit report path."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))
from app.services.hindi_urdu_language import (  # noqa: E402
    verify_all_hindi_urdu,
    write_verification_report,
)


def main() -> None:
    verified = verify_all_hindi_urdu()
    write_verification_report(verified)
    for row in verified:
        print(
            f"{row.song_number:4} {row.primary:5} {row.confidence:6} "
            f"H={row.hindi_score:.2f} U={row.urdu_score:.2f}  {row.title[:40]}"
        )


if __name__ == "__main__":
    main()