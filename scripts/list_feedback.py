#!/usr/bin/env python3
"""List pending user feedback from the production or local database."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from sqlalchemy import select

from app.core.db import get_session_factory
from app.models import UserFeedback
from app.services.feedback_triage import feedback_is_priority


async def main(status: str, limit: int) -> None:
    if not os.environ.get("DATABASE_URL"):
        raise SystemExit("Set DATABASE_URL before running this script.")

    session_factory = get_session_factory()
    async with session_factory() as session:
        filters = []
        if status != "all":
            filters.append(UserFeedback.status == status)
        result = await session.execute(
            select(UserFeedback)
            .where(*filters)
            .order_by(UserFeedback.created_at.desc())
            .limit(limit)
        )
        rows = result.scalars().all()

    if not rows:
        print(f"No feedback with status={status!r}.")
        return

    for row in rows:
        flag = "PRIORITY" if feedback_is_priority(row.category, row.rating) else "normal"
        print("-" * 72)
        print(f"id:       {row.id}")
        print(f"when:     {row.created_at.isoformat()}")
        print(f"status:   {row.status} ({flag})")
        print(f"category: {row.category}  rating: {row.rating}/5")
        print(f"page:     {row.page_path or '-'}")
        print(f"comment:  {row.comment}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--status", default="new", help="Filter by status (default: new)")
    parser.add_argument("--limit", type=int, default=50, help="Maximum rows to print")
    args = parser.parse_args()
    asyncio.run(main(args.status, args.limit))
