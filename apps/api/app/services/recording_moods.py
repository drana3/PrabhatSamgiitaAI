"""Moods of recordings: the uploader suggests, listeners confirm, the team decides
(docs/search-menu.md, section 6; the numbers below are the ones written there).

A mood becomes public (`confirmed`) only through people, never through a guess by a model.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import UserAccount
from app.models.author_profiles import PlayEvent
from app.models.recording_moods import RecordingMood, RecordingMoodVote
from app.models.recordings import Recording
from app.services.author_profiles import pepper
from app.services.author_stats import LISTENER_SALT_ROTATION_DAYS, listener_key
from app.services.recording_tags import LEGACY_MOODS, UPLOAD_MOODS
from app.services.recordings import VISIBLE

# The mood words of the upload form (lib/kirtan/moods.ts), as ids: Dada's five of 9 Nov 2026
# (services/recording_tags.py). The person may choose several, and add an own word (a `mood` word of
# the team's queue, services/value_suggestions.py). The first six moods (8 Nov 2026) stay valid:
# a row or a vote that carries one is kept, and the recording page still shows a mood that has a
# row, but the form no longer offers them.
MOODS = (*UPLOAD_MOODS, *LEGACY_MOODS)

# Confirm: how many people must say "yes" ...
YES_NEEDED_UPLOADER = 3  # the uploader suggested the mood
YES_NEEDED_LISTENERS = 5  # nobody suggested it (a library recording, or a listener's own idea)
YES_SHARE = 0.7  # ... and which share of all votes must be "yes"
# Reject: after this many votes, under this share of "yes".
REJECT_AFTER_VOTES = 5
REJECT_BELOW_SHARE = 0.3
# Who may vote, and how much.
VOTER_MIN_AGE_DAYS = 7
VETERAN_AGE_DAYS = 30  # one "yes" of a confirmed mood must come from an account this old
VOTES_PER_DAY = 30
UPLOADER_MOODS_MAX = 5
# A listener may need a play from the last N days to count; with a rotating salt the key changes
# per period, so the check walks the days back (one key when the salt never rotates).
PLAY_LOOKBACK_DAYS = 90


class MoodError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _now() -> datetime:
    return datetime.now(UTC)


def age_days(member: UserAccount, now: datetime | None = None) -> float:
    created = _aware(member.created_at) or _now()
    return ((now or _now()) - created).total_seconds() / 86400


def check_mood(mood: str) -> str:
    if mood not in MOODS:
        raise MoodError(422, "bad_mood", "That is not one of the moods.")
    return mood


# --------------------------------------------------------------------------- the rules


def decide(source: str, yes: int, no: int, veteran_yes: bool) -> str:
    """The status the votes give. Pure: the tests pin it."""
    total = yes + no
    needed = YES_NEEDED_UPLOADER if source == "uploader" else YES_NEEDED_LISTENERS
    if total and yes >= needed and yes / total >= YES_SHARE and veteran_yes:
        return "confirmed"
    if total >= REJECT_AFTER_VOTES and yes / total < REJECT_BELOW_SHARE:
        return "rejected"
    return "suggested"


async def recompute(session: AsyncSession, row: RecordingMood) -> None:
    """Read the votes again and set counters and status. A locked mood only keeps its counters."""
    votes = (
        await session.execute(
            select(RecordingMoodVote.vote, UserAccount.created_at)
            .join(UserAccount, UserAccount.id == RecordingMoodVote.member_id)
            .where(
                RecordingMoodVote.recording_id == row.recording_id,
                RecordingMoodVote.mood == row.mood,
            )
        )
    ).all()
    now = _now()
    yes = sum(1 for v, _ in votes if v > 0)
    no = sum(1 for v, _ in votes if v < 0)
    veteran = any(
        v > 0 and (now - (_aware(c) or now)).total_seconds() / 86400 >= VETERAN_AGE_DAYS
        for v, c in votes
    )
    row.yes_count, row.no_count = yes, no
    if row.locked:
        return
    status = decide(row.source, yes, no, veteran)
    if status == "confirmed" and row.status != "confirmed":
        row.confirmed_at = now
    if status != "confirmed":
        row.confirmed_at = None
    row.status = status


async def recompute_all(session: AsyncSession) -> int:
    """After accounts were deleted (their votes went with them): every row from its votes."""
    rows = list((await session.scalars(select(RecordingMood))).all())
    for row in rows:
        await recompute(session, row)
    await session.commit()
    return len(rows)


# --------------------------------------------------------------------------- reading


async def visible(session: AsyncSession, recording_id: UUID) -> Recording:
    recording = await session.get(Recording, recording_id)
    if recording is None or recording.status not in VISIBLE:
        raise MoodError(404, "not_found", "Recording not found")
    return recording


async def confirmed_moods(session: AsyncSession) -> dict[UUID, list[str]]:
    """Recording id -> its confirmed moods (published or flagged recordings only)."""
    rows = (
        await session.execute(
            select(RecordingMood.recording_id, RecordingMood.mood)
            .join(Recording, Recording.id == RecordingMood.recording_id)
            .where(RecordingMood.status == "confirmed", Recording.status.in_(VISIBLE))
            .order_by(RecordingMood.recording_id, RecordingMood.mood)
        )
    ).all()
    found: dict[UUID, list[str]] = {}
    for rid, mood in rows:
        found.setdefault(rid, []).append(mood)
    return found


async def has_counted_play(
    session: AsyncSession, settings: Settings, member: UserAccount, recording_id: UUID
) -> bool:
    """Did this account hear the recording long enough to count (the same rule as the author
    numbers)? The play table holds only a short keyed hash, so the key is worked out here."""
    secret = pepper(settings)
    who = f"m:{member.id}"
    today = _now().date()
    days = 1 if LISTENER_SALT_ROTATION_DAYS <= 0 else PLAY_LOOKBACK_DAYS
    keys: set[str] = set()
    for back in range(days):
        day: date = today - timedelta(days=back)
        keys.add(listener_key(secret, who, day if LISTENER_SALT_ROTATION_DAYS > 0 else None))
    found = await session.scalar(
        select(func.count())
        .select_from(PlayEvent)
        .where(PlayEvent.recording_id == recording_id, PlayEvent.listener_key.in_(keys))
    )
    return bool(found)


async def votes_today(session: AsyncSession, member: UserAccount) -> int:
    since = _now() - timedelta(days=1)
    rows = await session.scalars(
        select(RecordingMoodVote.created_at).where(RecordingMoodVote.member_id == member.id)
    )
    return sum(1 for created in rows if (_aware(created) or since) >= since)


async def page(
    session: AsyncSession,
    settings: Settings,
    recording: Recording,
    member: UserAccount | None,
    *,
    team: bool,
) -> dict[str, object]:
    """What the recording page shows: each mood with its state, the member's own vote and why
    they cannot vote (if they cannot)."""
    rows = {
        r.mood: r
        for r in (
            await session.scalars(
                select(RecordingMood).where(RecordingMood.recording_id == recording.id)
            )
        ).all()
    }
    mine: dict[str, int] = {}
    if member is not None:
        mine = {
            v.mood: v.vote
            for v in (
                await session.scalars(
                    select(RecordingMoodVote).where(
                        RecordingMoodVote.recording_id == recording.id,
                        RecordingMoodVote.member_id == member.id,
                    )
                )
            ).all()
        }
    is_uploader = member is not None and recording.author_id == member.id
    why: str | None = None
    if member is None:
        why = "sign_in"
    elif is_uploader:
        why = "own"
    elif age_days(member) < VOTER_MIN_AGE_DAYS:
        why = "too_new"
    elif not await has_counted_play(session, settings, member, recording.id):
        why = "listen_first"
    items = []
    # the five of the form, then an older mood only when a row of it exists
    for mood in (*UPLOAD_MOODS, *(m for m in LEGACY_MOODS if m in rows)):
        row = rows.get(mood)
        if row is None:
            items.append({"mood": mood, "status": "none", "yes": 0, "no": 0, "mine": None})
            continue
        if row.status == "rejected" and not team:
            items.append({"mood": mood, "status": "none", "yes": 0, "no": 0, "mine": None})
            continue
        # A suggestion nobody confirmed is shown to people who can vote, to the uploader and to the
        # team, never as a fact: its status says "suggested".
        items.append(
            {
                "mood": mood,
                "status": row.status,
                "source": row.source,
                "locked": row.locked,
                "yes": row.yes_count,
                "no": row.no_count,
                "mine": {1: "yes", -1: "no"}.get(mine.get(mood, 0)),
            }
        )
    return {
        "recording_id": recording.id,
        "moods": items,
        "can_vote": why is None,
        "cannot_vote_because": why,
        "can_suggest": is_uploader,
        "needed": {"uploader": YES_NEEDED_UPLOADER, "listeners": YES_NEEDED_LISTENERS},
    }


# --------------------------------------------------------------------------- writing


async def suggest(
    session: AsyncSession, recording: Recording, member: UserAccount, moods: Iterable[str]
) -> None:
    """The uploader names the moods (up to `UPLOADER_MOODS_MAX`); none means "I am not sure" and
    takes back the earlier suggestions that no vote has confirmed. Only the uploader's own
    recordings: a person who did not upload it votes instead."""
    if recording.author_id is None or recording.author_id != member.id:
        raise MoodError(403, "not_uploader", "Only the person who added it can suggest a mood.")
    chosen = list(dict.fromkeys(check_mood(m) for m in moods))
    if len(chosen) > UPLOADER_MOODS_MAX:
        raise MoodError(
            422,
            "too_many",
            f"Name at most {UPLOADER_MOODS_MAX} moods, or none if you are not sure.",
        )
    existing = {
        r.mood: r
        for r in (
            await session.scalars(
                select(RecordingMood).where(RecordingMood.recording_id == recording.id)
            )
        ).all()
    }
    for mood, row in existing.items():
        if mood not in chosen and row.source == "uploader" and row.status == "suggested":
            await session.execute(
                delete(RecordingMoodVote).where(
                    RecordingMoodVote.recording_id == recording.id, RecordingMoodVote.mood == mood
                )
            )
            await session.delete(row)
    for mood in chosen:
        row = existing.get(mood)
        if row is None:
            row = RecordingMood(
                recording_id=recording.id,
                mood=mood,
                source="uploader",
                suggested_by=member.id,
                status="suggested",
            )
            session.add(row)
            await session.flush()
        elif row.source == "listeners" and not row.locked:
            row.source = "uploader"  # the uploader's word lowers the bar to three
            row.suggested_by = member.id
        await recompute(session, row)
    await session.commit()


async def vote(
    session: AsyncSession,
    settings: Settings,
    recording: Recording,
    member: UserAccount,
    mood: str,
    value: str,
) -> None:
    check_mood(mood)
    if recording.author_id is not None and recording.author_id == member.id:
        raise MoodError(409, "own_recording", "You added this recording, so you suggest instead.")
    if age_days(member) < VOTER_MIN_AGE_DAYS:
        raise MoodError(403, "too_new", "Voting opens when your account is a week old.")
    if not await has_counted_play(session, settings, member, recording.id):
        raise MoodError(403, "listen_first", "Listen to the recording first, then you can vote.")
    row = await session.get(RecordingMood, (recording.id, mood))
    if row is not None and row.locked:
        raise MoodError(409, "locked", "The team decided this one; votes do not change it.")
    existing = await session.get(RecordingMoodVote, (recording.id, mood, member.id))
    if value == "clear":
        if existing is not None:
            await session.delete(existing)
            await session.flush()
    else:
        if existing is None and await votes_today(session, member) >= VOTES_PER_DAY:
            raise MoodError(
                429, "vote_limit", "That is enough votes for today. Come back tomorrow."
            )
        if row is None:
            if value != "yes":
                raise MoodError(
                    409, "not_proposed", "Nobody proposed this mood for this recording."
                )
            row = RecordingMood(
                recording_id=recording.id,
                mood=mood,
                source="listeners",
                suggested_by=member.id,
                status="suggested",
            )
            session.add(row)
            await session.flush()
        number = 1 if value == "yes" else -1
        if existing is None:
            session.add(
                RecordingMoodVote(
                    recording_id=recording.id, mood=mood, member_id=member.id, vote=number
                )
            )
        else:
            existing.vote = number
        await session.flush()
    if row is not None:
        await recompute(session, row)
        # A mood only listeners proposed, with no vote left: nothing stands behind it any more.
        if row.source == "listeners" and row.yes_count + row.no_count == 0 and not row.locked:
            await session.delete(row)
    await session.commit()


async def team_decide(
    session: AsyncSession, recording: Recording, mood: str, decision: str, by: str
) -> None:
    """confirmed / rejected: the team's word, locked against votes. clear: back to the votes."""
    check_mood(mood)
    row = await session.get(RecordingMood, (recording.id, mood))
    if decision == "clear":
        if row is None:
            return
        row.locked = False
        row.decided_by = None
        await recompute(session, row)
        # a mood only the team had named leaves with its lock; one somebody proposed stays
        if row.source == "team" and row.yes_count + row.no_count == 0:
            await session.delete(row)
    else:
        if row is None:
            row = RecordingMood(recording_id=recording.id, mood=mood, source="team")
            session.add(row)
        row.locked = True
        row.status = decision
        row.decided_by = by
        row.confirmed_at = _now() if decision == "confirmed" else None
    await session.commit()
