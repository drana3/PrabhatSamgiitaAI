from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CommunityTestimonial, UserFeedback


def live_display_name(feedback: UserFeedback) -> str:
    contact = (feedback.contact or "").strip()
    if contact and "@" in contact:
        local = contact.split("@", 1)[0].replace(".", " ").replace("_", " ").strip()
        if local:
            return local.title()[:120]
    if contact:
        return contact[:120]
    return "Community member"


async def feedback_is_on_live_ticker(session: AsyncSession, comment: str) -> bool:
    quote = comment.strip()
    if not quote:
        return False
    found = await session.scalar(
        select(CommunityTestimonial.id).where(
            CommunityTestimonial.status == "approved",
            func.lower(CommunityTestimonial.quote_text) == quote.casefold(),
        )
    )
    return found is not None


async def publish_feedback_to_live(
    session: AsyncSession, feedback: UserFeedback
) -> CommunityTestimonial:
    quote = feedback.comment.strip()
    if len(quote) < 12:
        raise ValueError("Comment is too short to show on the live ticker")

    now = datetime.now(UTC)
    existing = await session.scalar(
        select(CommunityTestimonial).where(
            func.lower(CommunityTestimonial.quote_text) == quote.casefold()
        )
    )
    if existing is not None:
        existing.quote_text = quote
        existing.display_name = live_display_name(feedback)
        existing.status = "approved"
        existing.approved_at = existing.approved_at or now
        await session.commit()
        await session.refresh(existing)
        return existing

    item = CommunityTestimonial(
        quote_text=quote,
        display_name=live_display_name(feedback),
        display_location=None,
        avatar_url=None,
        consented_at=now,
        approved_at=now,
        status="approved",
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def unpublish_feedback_from_live(session: AsyncSession, feedback: UserFeedback) -> None:
    quote = feedback.comment.strip()
    if not quote:
        return
    rows = list(
        (
            await session.execute(
                select(CommunityTestimonial).where(
                    func.lower(CommunityTestimonial.quote_text) == quote.casefold(),
                    CommunityTestimonial.status == "approved",
                )
            )
        ).scalars()
    )
    if not rows:
        return
    for row in rows:
        row.status = "removed"
        row.approved_at = None
    await session.commit()
