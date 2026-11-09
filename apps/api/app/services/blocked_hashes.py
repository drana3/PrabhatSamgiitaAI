"""The list of files that cannot be uploaded again (docs/takedown-process.md).

Kept apart from `takedowns.py` so the upload code can ask it without importing the whole
take-down flow (which itself imports the recordings service).
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.takedown import BlockedAudioHash

BLOCKED_MESSAGE = (
    "This file cannot be published: a rights holder asked us to remove it. "
    "If you have the right to share it, contact us from the app."
)


async def is_blocked(session: AsyncSession, sha256: str) -> bool:
    found = await session.scalar(
        select(BlockedAudioHash.sha256).where(BlockedAudioHash.sha256 == sha256.lower())
    )
    return found is not None


async def block(
    session: AsyncSession, sha256: str, *, reason: str, by: str, takedown_id: UUID | None = None
) -> None:
    """Add a file to the list. Does not commit. Safe to call twice."""
    digest = sha256.lower()
    if await is_blocked(session, digest):
        return
    session.add(
        BlockedAudioHash(
            sha256=digest,
            takedown_id=takedown_id,
            reason=reason[:500],
            blocked_by=by,
            blocked_at=datetime.now(UTC),
        )
    )


async def unblock(session: AsyncSession, sha256: str) -> None:
    """Remove a file from the list. Does not commit."""
    await session.execute(delete(BlockedAudioHash).where(BlockedAudioHash.sha256 == sha256.lower()))
