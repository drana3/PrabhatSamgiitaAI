from __future__ import annotations

import logging
import re
from collections import defaultdict
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserFeedback, UserFeedbackReply
from app.services.acs_email import send_transactional_email

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def contact_is_email(contact: str | None) -> bool:
    value = (contact or "").strip()
    return bool(value and _EMAIL_RE.match(value))


def reply_to_dict(reply: UserFeedbackReply) -> dict[str, object]:
    return {
        "reply_id": str(reply.id),
        "body": reply.body,
        "author_label": reply.author_label,
        "kind": reply.kind,
        "email_delivered": bool(reply.email_delivered),
        "created_at": reply.created_at.isoformat() if reply.created_at else "",
    }


async def load_replies_by_feedback(
    session: AsyncSession, feedback_ids: list[UUID]
) -> dict[UUID, list[UserFeedbackReply]]:
    if not feedback_ids:
        return {}
    result = await session.execute(
        select(UserFeedbackReply)
        .where(UserFeedbackReply.feedback_id.in_(feedback_ids))
        .order_by(UserFeedbackReply.created_at.asc())
    )
    grouped: dict[UUID, list[UserFeedbackReply]] = defaultdict(list)
    for row in result.scalars().all():
        grouped[row.feedback_id].append(row)
    return grouped


def _email_reply(*, to_address: str, subject: str, body: str, original: str | None) -> bool:
    original_block = ""
    if original and original.strip():
        original_block = f"\n\n---\nYour original feedback:\n{original.strip()}\n"
    plain = (
        f"Hello,\n\n{body.strip()}\n{original_block}\n"
        "— Prabhat Samgiita team\n"
    )
    html_body = body.strip().replace("\n", "<br/>")
    html_original = ""
    if original and original.strip():
        html_original = (
            "<hr/><p><small>Your original feedback:</small><br/>"
            f"{original.strip().replace(chr(10), '<br/>')}</p>"
        )
    html = (
        f"<p>Hello,</p><p>{html_body}</p>{html_original}"
        "<p>— Prabhat Samgiita team</p>"
    )
    return send_transactional_email(
        to_address=to_address.strip(),
        subject=subject,
        plain_text=plain,
        html_body=html,
    )


async def create_feedback_reply(
    session: AsyncSession,
    *,
    feedback: UserFeedback,
    body: str,
    author_label: str,
    kind: str = "admin",
    subject: str | None = None,
    commit: bool = True,
) -> UserFeedbackReply:
    text = body.strip()
    if len(text) < 1:
        raise ValueError("Reply body is required")
    if len(text) > 4000:
        raise ValueError("Reply is too long (max 4000 characters)")

    delivered = False
    if contact_is_email(feedback.contact):
        delivered = _email_reply(
            to_address=feedback.contact or "",
            subject=subject or "Reply to your Prabhat Samgiita feedback",
            body=text,
            original=feedback.comment,
        )
    else:
        logger.info(
            "Feedback %s has no email contact; reply stored without delivery",
            feedback.id,
        )

    reply = UserFeedbackReply(
        id=uuid4(),
        feedback_id=feedback.id,
        body=text,
        author_label=(author_label or "Admin")[:320],
        kind=kind if kind in {"admin", "system"} else "admin",
        email_delivered=delivered,
    )
    session.add(reply)
    if commit:
        await session.commit()
        await session.refresh(reply)
    else:
        await session.flush()
    return reply


def song_matches_feedback(feedback: UserFeedback, song_number: int) -> bool:
    path = feedback.page_path or ""
    if re.search(rf"/songs?/{song_number}(?:/|$|\?)", path, flags=re.I):
        return True
    if re.search(rf"song\s*#{song_number}\b", feedback.comment or "", flags=re.I):
        return True
    return False


async def notify_devanagari_reporters(
    session: AsyncSession,
    *,
    song_number: int,
    author_label: str,
    review_note: str | None = None,
) -> int:
    """Email reporters who filed Devanagari feedback for this song; skip if already notified."""
    result = await session.execute(
        select(UserFeedback).where(UserFeedback.category == "devanagari")
    )
    candidates = [row for row in result.scalars().all() if song_matches_feedback(row, song_number)]
    if not candidates:
        return 0

    existing = await load_replies_by_feedback(session, [row.id for row in candidates])
    note = (review_note or "").strip()
    note_suffix = f"\n\nNote from reviewer: {note}" if note else ""
    body = (
        f"Thank you for reporting Devanagari lyrics for song #{song_number}. "
        f"An admin has reviewed the text and approved the corrected version."
        f"{note_suffix}"
    )
    notified = 0
    for feedback in candidates:
        prior = existing.get(feedback.id) or []
        already = any(
            reply.kind == "system" and "approved" in (reply.body or "").lower()
            for reply in prior
        )
        if already:
            continue
        await create_feedback_reply(
            session,
            feedback=feedback,
            body=body,
            author_label=author_label or "System",
            kind="system",
            subject=f"Devanagari lyrics approved for song #{song_number}",
            commit=False,
        )
        if feedback.status in {"new", "reviewed"}:
            feedback.status = "actioned"
        notified += 1
    if notified:
        await session.commit()
    return notified
