"""Author profiles: create, publish, find, count, report, delete. Rules in docs/author-profiles.md.

Pure rules (slugs, names, links) are in `author_rules`; the listening numbers are in `author_stats`.
This module is the part that touches the database.

Visibility in one place:

* `draft`      only the owner sees it (`/authors/me`). No public page, no directory, no search.
* `published`  public page, directory, search. Search engines only when `indexable` (see below).
* `suspended`  the team took it down. The page answers "not found" to everybody except the owner,
               who sees the state and the reason. The recordings stay in the library.

`review_needed` always means "the owner wants this published and the team has to look first"
(a protected or look-alike name, a claim to be a known artist). It is only raised when the owner
asks
to publish, or edits a published page into something that needs a look. Reports raise it too, but
then
the page stays up (publish first, the team looks afterwards, as with recordings).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import and_, case, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import UserAccount
from app.models.author_profiles import (
    AuthorProfile,
    AuthorProfilePhoto,
    AuthorRecordingLink,
    AuthorReport,
    AuthorSlugHistory,
    AuthorStatsSnapshot,
    AuthorSuspension,
    PlayDaily,
)
from app.models.recordings import AuthorBlock, Recording, public_kind, stored_kinds
from app.schemas.author_profiles import (
    AdminAuthorOut,
    AuthorCard,
    AuthorProfileCreate,
    AuthorProfileOwner,
    AuthorProfilePatch,
    AuthorProfilePublic,
    CollectionBrief,
    CountryShare,
    DayPoint,
    KindCount,
    OwnerStats,
    PublicLink,
    PublicStats,
    TopRecording,
)
from app.services import author_rules as rules
from app.services import author_stats as stats
from app.services.recordings import VISIBLE

# ---- the knobs (one place each) --------------------------------------------------------------

# What a new page shows of the owner's uploads. "all": every upload (the owner switches single ones
# off); "chosen": only the ones the owner switches on. A Decision for Dada in the doc.
DEFAULT_INCLUDE_UPLOADS = "all"
PHOTO_MAX_BYTES = 300 * 1024
# Three different people reporting one page puts it in front of the team (it stays up meanwhile).
REPORT_REVIEW_THRESHOLD = 3
# Reports of these reasons go to the team on the first one.
URGENT_REPORT_REASONS = ("impersonation", "copyright")
# Free names for the "Become an author" suggestion.
SUGGESTION_SUFFIXES = ("music", "kiirtan", "sings")
DEV_PEPPER = "dev-only-author-stats-pepper-change-me"
DIRECTORY_MAX_LIMIT = 50


class AuthorError(Exception):
    """A rule was broken. `code` is for the app (it has a sentence for each), `status` the HTTP
    status."""

    def __init__(self, code: str, status: int = 422, message: str | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.status = status
        self.message = message or code.replace("_", " ")


def now_utc() -> datetime:
    return datetime.now(UTC)


def aware(moment: datetime | None) -> datetime | None:
    """SQLite hands back naive datetimes; Postgres aware ones. Compare them as UTC."""
    if moment is None:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def pepper(settings: Settings) -> str:
    """The server secret that keys listener hashes. Own variable first, then the recording signing
    secret, then the member proxy key. The last fallback only exists so a dev machine works."""
    import os

    return (
        os.environ.get("AUTHOR_STATS_PEPPER")
        or settings.recording_signing_secret
        or settings.member_proxy_key
        or DEV_PEPPER
    )


def share_path(slug: str) -> str:
    return f"/author/{slug}"


def photo_url(profile: AuthorProfile) -> str | None:
    if not profile.photo_version:
        return None
    return f"/api/v1/authors/{profile.slug}/photo?v={profile.photo_version}"


# --------------------------------------------------------------------------- which recordings


def attribution(profile: AuthorProfile) -> Any:
    """The WHERE clause of "recordings that belong on this page".

    1. The owner's own uploads, by the page's rule (all minus the switched off, or only the chosen).
    2. When the team has verified the page: library recordings credited to the claimed name.
    Only visible (published or flagged) recordings count.
    """
    link = AuthorRecordingLink
    excluded = select(link.recording_id).where(
        link.profile_id == profile.id, link.mode == "exclude"
    )
    included = select(link.recording_id).where(
        link.profile_id == profile.id, link.mode == "include"
    )
    if profile.include_uploads == "chosen":
        own = and_(Recording.author_id == profile.member_id, Recording.id.in_(included))
    else:
        own = and_(Recording.author_id == profile.member_id, Recording.id.not_in(excluded))
    options = [own]
    claimed = (profile.claimed_name or "").strip().lower()
    if profile.verified and claimed:
        options.append(and_(func.lower(Recording.author) == claimed, Recording.id.not_in(excluded)))
    return and_(Recording.status.in_(VISIBLE), or_(*options))


def recording_ids(profile: AuthorProfile) -> Any:
    return select(Recording.id).where(attribution(profile))


async def count_recordings(session: AsyncSession, profile: AuthorProfile) -> int:
    return int(
        await session.scalar(
            select(func.count()).select_from(Recording).where(attribution(profile))
        )
        or 0
    )


async def kind_counts(session: AsyncSession, profile: AuthorProfile) -> list[KindCount]:
    rows = (
        await session.execute(
            select(Recording.kind, func.count())
            .where(attribution(profile))
            .group_by(Recording.kind)
        )
    ).all()
    merged: dict[str, int] = {}
    for kind, count in rows:
        merged[public_kind(kind)] = merged.get(public_kind(kind), 0) + int(count)
    return [KindCount(kind=k, count=n) for k, n in sorted(merged.items())]


async def list_recordings(
    session: AsyncSession,
    profile: AuthorProfile,
    *,
    viewer_id: UUID | None,
    kind: str | None,
    collection_id: UUID | None,
    exclude: UUID | None,
    limit: int,
    offset: int,
) -> tuple[list[Recording], int]:
    conditions: list[Any] = [attribution(profile)]
    if kind:
        conditions.append(Recording.kind.in_(stored_kinds(kind)))
    if collection_id:
        conditions.append(Recording.collection_id == collection_id)
    if exclude:
        conditions.append(Recording.id != exclude)
    total = await session.scalar(select(func.count()).select_from(Recording).where(*conditions))
    rows = (
        await session.scalars(
            select(Recording)
            .where(*conditions)
            .order_by(Recording.published_at.desc().nulls_last(), Recording.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return list(rows), int(total or 0)


@dataclass
class OwnerRow:
    recording: Recording
    shown: bool
    exception: bool


async def owner_recordings(
    session: AsyncSession, profile: AuthorProfile, *, limit: int, offset: int
) -> tuple[list[OwnerRow], int]:
    """The owner's own uploads with "is it on my page" for each."""
    base = [Recording.author_id == profile.member_id, Recording.status.in_(VISIBLE)]
    total = int(await session.scalar(select(func.count()).select_from(Recording).where(*base)) or 0)
    rows = (
        await session.scalars(
            select(Recording)
            .where(*base)
            .order_by(Recording.published_at.desc().nulls_last(), Recording.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    modes = {
        link.recording_id: link.mode
        for link in (
            await session.scalars(
                select(AuthorRecordingLink).where(AuthorRecordingLink.profile_id == profile.id)
            )
        ).all()
    }
    out: list[OwnerRow] = []
    for recording in rows:
        mode = modes.get(recording.id)
        if profile.include_uploads == "chosen":
            shown = mode == "include"
            out.append(OwnerRow(recording, shown, exception=shown))
        else:
            shown = mode != "exclude"
            out.append(OwnerRow(recording, shown, exception=not shown))
    return out, total


async def set_shown(
    session: AsyncSession, profile: AuthorProfile, recording_id: UUID, shown: bool
) -> None:
    recording = await session.get(Recording, recording_id)
    if recording is None or recording.author_id != profile.member_id:
        raise AuthorError("recording_not_yours", 404, "Recording not found")
    chosen = profile.include_uploads == "chosen"
    wanted_mode = "include" if chosen else "exclude"
    want_row = shown if chosen else not shown
    existing = await session.scalar(
        select(AuthorRecordingLink).where(
            AuthorRecordingLink.profile_id == profile.id,
            AuthorRecordingLink.recording_id == recording_id,
        )
    )
    if want_row and existing is None:
        session.add(
            AuthorRecordingLink(profile_id=profile.id, recording_id=recording_id, mode=wanted_mode)
        )
    elif want_row and existing is not None:
        existing.mode = wanted_mode
    elif not want_row and existing is not None:
        await session.delete(existing)
    await session.commit()
    await refresh_snapshot(session, profile, force=True)


async def _switch_include_mode(session: AsyncSession, profile: AuthorProfile, new: str) -> None:
    """all -> chosen keeps what is on the page now (the exceptions turn into explicit choices);
    chosen -> all clears the exceptions (all means all)."""
    if new == profile.include_uploads:
        return
    if new == "chosen":
        excluded = set(
            (
                await session.scalars(
                    select(AuthorRecordingLink.recording_id).where(
                        AuthorRecordingLink.profile_id == profile.id,
                        AuthorRecordingLink.mode == "exclude",
                    )
                )
            ).all()
        )
        await session.execute(
            delete(AuthorRecordingLink).where(AuthorRecordingLink.profile_id == profile.id)
        )
        own = (
            await session.scalars(
                select(Recording.id).where(
                    Recording.author_id == profile.member_id, Recording.status.in_(VISIBLE)
                )
            )
        ).all()
        for recording_id in own:
            if recording_id not in excluded:
                session.add(
                    AuthorRecordingLink(
                        profile_id=profile.id, recording_id=recording_id, mode="include"
                    )
                )
    else:
        await session.execute(
            delete(AuthorRecordingLink).where(AuthorRecordingLink.profile_id == profile.id)
        )
    profile.include_uploads = new


# --------------------------------------------------------------------------- slugs and names


async def slug_problem(
    session: AsyncSession, slug: str, *, own: AuthorProfile | None = None
) -> str | None:
    """None when `slug` (already normalised) can be used by this member right now."""
    problem = rules.slug_problem(slug)
    if problem:
        return problem
    taken = await session.scalar(select(AuthorProfile).where(AuthorProfile.slug == slug))
    if taken is not None and (own is None or taken.id != own.id):
        return "taken"
    history = await session.scalar(select(AuthorSlugHistory).where(AuthorSlugHistory.slug == slug))
    if history is not None:
        if own is not None and history.profile_id == own.id and history.kind == "renamed":
            return None  # going back to one of my own old addresses
        if history.kind == "deleted":
            until = aware(history.quarantine_until)
            if until is not None and until > now_utc():
                return "quarantined"
            return None  # the quarantine is over
        return "taken"  # somebody's old address still redirects there
    return None


async def suggest_slugs(session: AsyncSession, base: str) -> list[str]:
    out: list[str] = []
    candidates = [f"{base}-{suffix}" for suffix in SUGGESTION_SUFFIXES] + [
        f"{base}-{n}" for n in (2, 3, 7)
    ]
    for candidate in candidates:
        if len(out) >= 3:
            break
        if candidate and await slug_problem(session, candidate) is None:
            out.append(candidate)
    return out


async def check_slug(
    session: AsyncSession, raw: str, *, own: AuthorProfile | None = None
) -> dict[str, Any]:
    slug = rules.normalize_slug(raw)
    problem = await slug_problem(session, slug, own=own)
    held = problem is None and rules.protected_hit(slug)
    suggestions: list[str] = []
    if problem in ("taken", "quarantined") and slug:
        suggestions = await suggest_slugs(session, slug[: rules.SLUG_MAX - 8])
    return {
        "slug": slug,
        "available": problem is None,
        "problem": problem,
        "held_for_review": held,
        "suggestions": suggestions,
    }


async def review_reason_for(
    session: AsyncSession,
    *,
    member_id: UUID,
    slug: str,
    display_name: str,
    claimed_name: str | None,
    own_id: UUID | None,
) -> str | None:
    """Why the team has to look before this page goes public, or None. Checked in this order:
    a protected name (founder, organisation, app), a claim to be a known artist, a name that looks
    like
    a name already in the library or on another page."""
    if rules.protected_hit(slug) or rules.protected_name_hit(display_name):
        return "protected_name"
    if claimed_name and rules.clean_line(claimed_name, 120):
        return "artist_claim"
    others = (
        await session.scalars(
            select(AuthorProfile.display_name).where(
                AuthorProfile.member_id != member_id, AuthorProfile.status != "suspended"
            )
        )
    ).all()
    for name in others:
        if rules.names_alike(display_name, name):
            return "look_alike_page"
    library = (
        await session.scalars(
            select(Recording.author)
            .where(
                Recording.status.in_(VISIBLE),
                or_(Recording.author_id.is_(None), Recording.author_id != member_id),
            )
            .distinct()
            .limit(5000)
        )
    ).all()
    for name in library:
        if name and rules.names_alike(display_name, name):
            return "look_alike_artist"
    return None


# --------------------------------------------------------------------------- reading a profile


async def profile_of_member(session: AsyncSession, member_id: UUID) -> AuthorProfile | None:
    found: AuthorProfile | None = await session.scalar(
        select(AuthorProfile).where(AuthorProfile.member_id == member_id)
    )
    return found


@dataclass
class Resolved:
    kind: str  # "profile", "redirect", "gone", "missing"
    profile: AuthorProfile | None = None
    slug: str | None = None


async def resolve_slug(session: AsyncSession, raw: str) -> Resolved:
    """What a public address means: a page, a 301 to a new address, a 410 (deleted), or nothing."""
    slug = rules.normalize_slug(raw)
    if not slug:
        return Resolved("missing")
    profile = await session.scalar(select(AuthorProfile).where(AuthorProfile.slug == slug))
    if profile is not None:
        if profile.status != "published":
            return Resolved("missing")
        return Resolved("profile", profile)
    history = await session.scalar(select(AuthorSlugHistory).where(AuthorSlugHistory.slug == slug))
    if history is None:
        return Resolved("missing")
    if history.kind == "deleted":
        return Resolved("gone")
    if history.profile_id is None:
        return Resolved("gone")
    target = await session.get(AuthorProfile, history.profile_id)
    if target is None or target.status != "published":
        return Resolved("missing")
    return Resolved("redirect", target, target.slug)


def is_indexable(profile: AuthorProfile, recordings_count: int) -> bool:
    return profile.status == "published" and not profile.review_needed and recordings_count >= 1


def slug_change_wait_days(profile: AuthorProfile) -> int:
    if profile.published_at is None or profile.slug_changed_at is None:
        return 0
    changed = aware(profile.slug_changed_at)
    assert changed is not None
    left = changed + timedelta(days=rules.SLUG_CHANGE_COOLDOWN_DAYS) - now_utc()
    return max(0, int(left.total_seconds() // 86400) + (1 if left.total_seconds() % 86400 else 0))


async def owner_out(session: AsyncSession, profile: AuthorProfile) -> AuthorProfileOwner:
    # server-set columns (created_at, updated_at) are expired after a write; an async session cannot
    # load them lazily, so read them back here
    await session.refresh(profile)
    count = await count_recordings(session, profile)
    return AuthorProfileOwner(
        id=str(profile.id),
        slug=profile.slug,
        display_name=profile.display_name,
        author_type=profile.author_type,  # type: ignore[arg-type]
        bio=profile.bio,
        about=profile.about,
        country=profile.country,
        city=profile.city,
        languages=list(profile.languages or []),
        links=list(profile.links or []),  # type: ignore[arg-type]
        claimed_name=profile.claimed_name,
        status=profile.status,  # type: ignore[arg-type]
        review_needed=profile.review_needed,
        review_reason=profile.review_reason,
        verified=profile.verified,
        suspended_reason=profile.suspended_reason if profile.status == "suspended" else None,
        include_uploads=profile.include_uploads,  # type: ignore[arg-type]
        show_stats=profile.show_stats,
        photo_url=photo_url(profile),
        published_at=profile.published_at,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
        recordings_count=count,
        indexable=is_indexable(profile, count),
        slug_change_wait_days=slug_change_wait_days(profile),
        reports_count=profile.reports_count,
        share_path=share_path(profile.slug),
    )


def public_stats(
    profile: AuthorProfile, snapshot: AuthorStatsSnapshot, since: date | None
) -> PublicStats | None:
    """None = the owner switched the numbers off. Otherwise numbers only once there are enough
    plays:
    before that `enough_data` is false and the page says "counting since <date>"."""
    if not profile.show_stats:
        return None
    if snapshot.total_plays < stats.MIN_PUBLIC_PLAYS:
        return PublicStats(enough_data=False, counting_since=since)
    return PublicStats(
        enough_data=True,
        counting_since=since,
        monthly_listeners=snapshot.monthly_listeners,
        total_plays=snapshot.total_plays,
    )


async def public_out(session: AsyncSession, profile: AuthorProfile) -> AuthorProfilePublic:
    await session.refresh(profile)
    snapshot = await refresh_snapshot(session, profile)
    since = await stats.stats_since(session)
    collections = await collections_of(session, profile)
    return AuthorProfilePublic(
        slug=profile.slug,
        display_name=profile.display_name,
        author_type=profile.author_type,  # type: ignore[arg-type]
        bio=profile.bio,
        about=profile.about,
        country=profile.country,
        city=profile.city,
        languages=list(profile.languages or []),
        links=[PublicLink(kind=link["kind"], url=link["url"]) for link in profile.links or []],  # type: ignore[arg-type]
        verified=profile.verified,
        kinds=await kind_counts(session, profile),
        recordings_count=snapshot.recordings_count,
        collections_count=len(collections),
        photo_url=photo_url(profile),
        published_at=profile.published_at,
        updated_at=profile.updated_at,
        stats=public_stats(profile, snapshot, since),
        indexable=is_indexable(profile, snapshot.recordings_count),
    )


def card_of(profile: AuthorProfile, snapshot: AuthorStatsSnapshot | None) -> AuthorCard:
    listeners: int | None = None
    if snapshot and profile.show_stats and snapshot.total_plays >= stats.MIN_PUBLIC_PLAYS:
        listeners = snapshot.monthly_listeners
    return AuthorCard(
        slug=profile.slug,
        display_name=profile.display_name,
        author_type=profile.author_type,  # type: ignore[arg-type]
        bio=profile.bio,
        verified=profile.verified,
        photo_url=photo_url(profile),
        country=profile.country,
        monthly_listeners=listeners,
        recordings_count=snapshot.recordings_count if snapshot else 0,
    )


# --------------------------------------------------------------------------- snapshots, directory

_last_bulk_refresh: datetime | None = None
BULK_REFRESH_EVERY_SECONDS = 60
BULK_REFRESH_BATCH = 100


async def refresh_snapshot(
    session: AsyncSession, profile: AuthorProfile, *, force: bool = False
) -> AuthorStatsSnapshot:
    """The profile's numbers, worked out at most every SNAPSHOT_TTL_SECONDS unless `force`."""
    snapshot = await session.get(AuthorStatsSnapshot, profile.id)
    now = now_utc()
    if snapshot is not None and not force:
        computed = aware(snapshot.computed_at)
        if computed and (now - computed).total_seconds() < stats.SNAPSHOT_TTL_SECONDS:
            return snapshot
    numbers = await stats.numbers_for(session, recording_ids(profile), today=now.date())
    count = await count_recordings(session, profile)
    if snapshot is None:
        snapshot = AuthorStatsSnapshot(profile_id=profile.id)
        session.add(snapshot)
    snapshot.monthly_listeners = numbers.monthly_listeners
    snapshot.total_plays = numbers.total_plays
    snapshot.recordings_count = count
    snapshot.computed_at = now
    await session.commit()
    return snapshot


async def refresh_stale_snapshots(session: AsyncSession, *, force: bool = False) -> int:
    """Bring the snapshots of published pages up to date (the directory sorts by them)."""
    global _last_bulk_refresh
    now = now_utc()
    if (
        not force
        and _last_bulk_refresh
        and (now - _last_bulk_refresh).total_seconds() < BULK_REFRESH_EVERY_SECONDS
    ):
        return 0
    _last_bulk_refresh = now
    cutoff = now - timedelta(seconds=stats.SNAPSHOT_TTL_SECONDS)
    due = (
        await session.scalars(
            select(AuthorProfile)
            .outerjoin(AuthorStatsSnapshot, AuthorStatsSnapshot.profile_id == AuthorProfile.id)
            .where(
                AuthorProfile.status == "published",
                or_(
                    AuthorStatsSnapshot.profile_id.is_(None),
                    AuthorStatsSnapshot.computed_at < cutoff,
                ),
            )
            .limit(BULK_REFRESH_BATCH)
        )
    ).all()
    for profile in due:
        await refresh_snapshot(session, profile, force=True)
    return len(due)


def reset_refresh_clock() -> None:
    global _last_bulk_refresh
    _last_bulk_refresh = None


def _like(text: str) -> str:
    cleaned = text.strip().lower().replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
    return f"%{cleaned}%"


async def directory(
    session: AsyncSession,
    *,
    viewer_id: UUID | None,
    query: str | None,
    sort: str,
    limit: int,
    offset: int,
) -> tuple[list[AuthorCard], int]:
    await refresh_stale_snapshots(session)
    snap = AuthorStatsSnapshot
    conditions: list[Any] = [
        AuthorProfile.status == "published",
        func.coalesce(snap.recordings_count, 0) >= 1,
    ]
    if viewer_id is not None:
        blocked = (
            await session.scalars(
                select(AuthorBlock.blocked_id).where(AuthorBlock.blocker_id == viewer_id)
            )
        ).all()
        if blocked:
            conditions.append(AuthorProfile.member_id.not_in(blocked))
    if query and query.strip():
        like = _like(query)
        conditions.append(
            or_(
                func.lower(AuthorProfile.display_name).like(like, escape="\\"),
                func.lower(AuthorProfile.slug).like(like, escape="\\"),
                func.lower(AuthorProfile.bio).like(like, escape="\\"),
            )
        )
    joined = select(AuthorProfile, snap).outerjoin(snap, snap.profile_id == AuthorProfile.id)
    counted = (
        select(func.count())
        .select_from(AuthorProfile)
        .outerjoin(snap, snap.profile_id == AuthorProfile.id)
    )
    total = int(await session.scalar(counted.where(*conditions)) or 0)
    public_listeners = case(
        (
            and_(AuthorProfile.show_stats.is_(True), snap.total_plays >= stats.MIN_PUBLIC_PLAYS),
            snap.monthly_listeners,
        ),
        else_=0,
    )
    if sort == "new":
        order: list[Any] = [AuthorProfile.published_at.desc().nulls_last(), AuthorProfile.slug]
    elif sort == "name":
        order = [func.lower(AuthorProfile.display_name), AuthorProfile.slug]
    else:
        order = [
            public_listeners.desc(),
            func.lower(AuthorProfile.display_name),
            AuthorProfile.slug,
        ]
    rows = (
        await session.execute(
            joined.where(*conditions).order_by(*order).limit(limit).offset(offset)
        )
    ).all()
    return [card_of(profile, snapshot) for profile, snapshot in rows], total


async def line_for_recording(session: AsyncSession, recording: Recording) -> AuthorCard | None:
    """The author line under a recording: the published page this recording is on, if any."""
    candidates: list[AuthorProfile] = []
    if recording.author_id is not None:
        profile = await profile_of_member(session, recording.author_id)
        if profile is not None:
            candidates.append(profile)
    name = (recording.author or "").strip().lower()
    if name:
        claimed = (
            await session.scalars(
                select(AuthorProfile).where(
                    AuthorProfile.verified.is_(True),
                    func.lower(AuthorProfile.claimed_name) == name,
                )
            )
        ).all()
        candidates.extend(p for p in claimed if p not in candidates)
    for profile in candidates:
        if profile.status != "published":
            continue
        on_page = await session.scalar(
            select(func.count())
            .select_from(Recording)
            .where(Recording.id == recording.id, attribution(profile))
        )
        if on_page:
            snapshot = await refresh_snapshot(session, profile)
            return card_of(profile, snapshot)
    return None


async def collections_of(session: AsyncSession, profile: AuthorProfile) -> list[CollectionBrief]:
    """Playlists from an event made by the owner (read-only: they belong to the recording sets)."""
    try:
        from app.models.recording_collections import RecordingCollection
    except ImportError:  # the sets feature is not in this build
        return []
    sets = (
        await session.scalars(
            select(RecordingCollection)
            .where(
                RecordingCollection.owner_id == profile.member_id,
                RecordingCollection.status == "active",
            )
            .order_by(RecordingCollection.starts_on.desc())
        )
    ).all()
    if not sets:
        return []
    counts = {
        cid: int(n)
        for cid, n in (
            await session.execute(
                select(Recording.collection_id, func.count())
                .where(
                    Recording.collection_id.in_([s.id for s in sets]),
                    Recording.status.in_(VISIBLE),
                )
                .group_by(Recording.collection_id)
            )
        ).all()
    }
    return [
        CollectionBrief(
            id=str(s.id),
            title=s.title,
            place=s.place,
            starts_on=s.starts_on,
            ends_on=s.ends_on,
            cover_url=s.cover_url,
            tracks_count=counts[s.id],
        )
        for s in sets
        if counts.get(s.id)
    ]


# --------------------------------------------------------------------------- writing a profile


def _clean_fields(data: dict[str, Any]) -> dict[str, Any]:
    """Validate and clean the text fields that are present in `data`. Raises AuthorError."""
    out: dict[str, Any] = {}
    if "display_name" in data:
        name = rules.clean_line(data["display_name"], rules.NAME_MAX)
        if len(name) < rules.NAME_MIN:
            raise AuthorError("name_too_short")
        if rules.contains_link(name):
            raise AuthorError("text_has_link")
        out["display_name"] = name
    if "bio" in data:
        bio = rules.clean_line(data["bio"], rules.BIO_MAX)
        if rules.contains_link(bio):
            raise AuthorError("text_has_link")
        out["bio"] = bio
    if "about" in data:
        about = rules.clean_paragraphs(data["about"], rules.ABOUT_MAX)
        if rules.contains_link(about):
            raise AuthorError("text_has_link")
        out["about"] = about
    for key in ("country", "city"):
        if key in data:
            value = rules.clean_line(data[key], rules.PLACE_MAX)
            out[key] = value or None
    if "claimed_name" in data:
        claimed = rules.clean_line(data["claimed_name"], 120)
        if claimed and rules.contains_link(claimed):
            raise AuthorError("text_has_link")
        out["claimed_name"] = claimed or None
    if "languages" in data:
        langs: list[str] = []
        for item in data["languages"] or []:
            if item not in rules.PROFILE_LANGUAGES:
                raise AuthorError("language_unknown")
            if item not in langs:
                langs.append(item)
        out["languages"] = langs
    if "links" in data:
        try:
            out["links"] = rules.normalize_links(
                [{"kind": link["kind"], "url": link["url"]} for link in data["links"] or []]
            )
        except rules.LinkError as exc:
            raise AuthorError(f"link_{exc.code}") from exc
    if "author_type" in data:
        out["author_type"] = data["author_type"]
    if "show_stats" in data:
        out["show_stats"] = bool(data["show_stats"])
    return out


async def _claim_slug(
    session: AsyncSession, profile: AuthorProfile, new_slug: str, *, was_public: bool
) -> None:
    """Move `profile` to `new_slug` (already checked). The old address keeps redirecting when the
    page
    was ever public; a leftover history row for the new address is removed."""
    old = profile.slug
    if old == new_slug:
        return
    stale = await session.scalar(
        select(AuthorSlugHistory).where(AuthorSlugHistory.slug == new_slug)
    )
    if stale is not None:
        await session.delete(stale)
        await session.flush()
    if was_public:
        session.add(AuthorSlugHistory(slug=old, profile_id=profile.id, kind="renamed"))
        profile.slug_changed_at = now_utc()
    profile.slug = new_slug


async def suspension_of(session: AsyncSession, member_id: UUID) -> AuthorSuspension | None:
    return await session.get(AuthorSuspension, member_id)


async def create_profile(
    session: AsyncSession, member: UserAccount, payload: AuthorProfileCreate
) -> AuthorProfile:
    if await profile_of_member(session, member.id) is not None:
        raise AuthorError("already_exists", 409, "You already have an author page")
    # A suspension belongs to the member: deleting the suspended page does not make a clean start.
    if await suspension_of(session, member.id) is not None:
        raise AuthorError("suspended", 403, "Your author page was suspended by the team")
    slug = rules.normalize_slug(payload.slug)
    problem = await slug_problem(session, slug)
    if problem:
        raise AuthorError(f"slug_{problem}", 409 if problem in ("taken", "quarantined") else 422)
    fields = _clean_fields(
        {
            "display_name": payload.display_name,
            "bio": payload.bio,
            "about": payload.about,
            "country": payload.country,
            "city": payload.city,
            "languages": payload.languages,
            "links": [link.model_dump() for link in payload.links],
            "claimed_name": payload.claimed_name,
            "author_type": payload.author_type,
            "show_stats": payload.show_stats,
        }
    )
    fresh = await session.scalar(select(AuthorSlugHistory).where(AuthorSlugHistory.slug == slug))
    if fresh is not None:
        await session.delete(fresh)  # an expired quarantine
        await session.flush()
    profile = AuthorProfile(
        member_id=member.id,
        slug=slug,
        include_uploads=payload.include_uploads or DEFAULT_INCLUDE_UPLOADS,
        status="draft",
        **fields,
    )
    session.add(profile)
    await session.flush()
    if payload.publish:
        await _publish(session, profile)
    await session.commit()
    return profile


async def _publish(session: AsyncSession, profile: AuthorProfile) -> None:
    """Publish now, or park the page for the team when its name needs a look."""
    if profile.status == "suspended":
        raise AuthorError("suspended", 403, "This page was suspended by the team")
    reason = await review_reason_for(
        session,
        member_id=profile.member_id,
        slug=profile.slug,
        display_name=profile.display_name,
        claimed_name=profile.claimed_name,
        own_id=profile.id,
    )
    if reason and not (profile.verified and reason == "artist_claim"):
        profile.review_needed = True
        profile.review_reason = reason
        profile.status = "draft"
        return
    profile.review_needed = False
    profile.review_reason = None
    profile.status = "published"
    if profile.published_at is None:
        profile.published_at = now_utc()


async def publish_profile(session: AsyncSession, profile: AuthorProfile) -> AuthorProfile:
    await _publish(session, profile)
    await session.commit()
    await refresh_snapshot(session, profile, force=True)
    return profile


async def unpublish_profile(session: AsyncSession, profile: AuthorProfile) -> AuthorProfile:
    if profile.status == "suspended":
        raise AuthorError("suspended", 403, "This page was suspended by the team")
    profile.status = "draft"
    profile.review_needed = False
    profile.review_reason = None
    await session.commit()
    return profile


async def update_profile(
    session: AsyncSession, profile: AuthorProfile, payload: AuthorProfilePatch
) -> AuthorProfile:
    data = payload.model_dump(exclude_unset=True)
    include = data.pop("include_uploads", None)
    new_slug = data.pop("slug", None)
    if "links" in data and data["links"] is not None:
        data["links"] = [dict(link) for link in data["links"]]
    for key in ("display_name", "bio", "about", "languages", "links", "author_type", "show_stats"):
        if key in data and data[key] is None:
            data.pop(key)  # null means "leave it", these have no empty state
    fields = _clean_fields(data)

    was_public = profile.published_at is not None
    identity_changed = False
    if new_slug is not None:
        normal = rules.normalize_slug(new_slug)
        if normal != profile.slug:
            wait = slug_change_wait_days(profile)
            if wait > 0:
                raise AuthorError(
                    "slug_cooldown", 429, f"The address can change again in {wait} days"
                )
            problem = await slug_problem(session, normal, own=profile)
            if problem:
                raise AuthorError(
                    f"slug_{problem}", 409 if problem in ("taken", "quarantined") else 422
                )
            await _claim_slug(session, profile, normal, was_public=was_public)
            identity_changed = True
    if "display_name" in fields and fields["display_name"] != profile.display_name:
        identity_changed = True
    if "claimed_name" in fields and (fields["claimed_name"] or None) != profile.claimed_name:
        identity_changed = True
        profile.verified = False  # a new claim is a new question for the team
        profile.verified_at = None
        profile.verified_by = None
    for key, value in fields.items():
        setattr(profile, key, value)
    if include is not None:
        await _switch_include_mode(session, profile, include)

    if identity_changed and profile.status == "published":
        reason = await review_reason_for(
            session,
            member_id=profile.member_id,
            slug=profile.slug,
            display_name=profile.display_name,
            claimed_name=profile.claimed_name,
            own_id=profile.id,
        )
        if reason:
            # pulled from public until the team has looked; approving publishes it again
            profile.review_needed = True
            profile.review_reason = reason
            profile.status = "draft"
    await session.commit()
    await refresh_snapshot(session, profile, force=True)
    return profile


# --------------------------------------------------------------------------- photo


def sniff_image(data: bytes) -> str | None:
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


async def set_photo(session: AsyncSession, profile: AuthorProfile, data: bytes) -> None:
    if not data:
        raise AuthorError("photo_empty")
    if len(data) > PHOTO_MAX_BYTES:
        raise AuthorError("photo_too_big", 413, "The picture is too big")
    mime = sniff_image(data)
    if mime is None:
        raise AuthorError("photo_type", 415, "Use a JPEG, PNG or WebP picture")
    digest = hashlib.sha256(data).hexdigest()
    row = await session.get(AuthorProfilePhoto, profile.id)
    if row is None:
        row = AuthorProfilePhoto(
            profile_id=profile.id, mime=mime, data=data, sha256=digest, updated_at=now_utc()
        )
        session.add(row)
    else:
        row.mime, row.data, row.sha256, row.updated_at = mime, data, digest, now_utc()
    profile.photo_version = digest[:16]
    await session.commit()


async def remove_photo(session: AsyncSession, profile: AuthorProfile) -> None:
    await session.execute(
        delete(AuthorProfilePhoto).where(AuthorProfilePhoto.profile_id == profile.id)
    )
    profile.photo_version = None
    await session.commit()


# --------------------------------------------------------------------------- delete, export


async def delete_profile(session: AsyncSession, profile: AuthorProfile) -> None:
    """Remove the page. The address (and every old address of it) answers 410 and is held for
    SLUG_QUARANTINE_DAYS, so nobody can take a known address over. Recordings stay in the
    library."""
    quarantine = now_utc() + timedelta(days=rules.SLUG_QUARANTINE_DAYS)
    was_public = profile.published_at is not None
    old_rows = (
        await session.scalars(
            select(AuthorSlugHistory).where(AuthorSlugHistory.profile_id == profile.id)
        )
    ).all()
    for row in old_rows:
        row.kind, row.profile_id, row.quarantine_until = "deleted", None, quarantine
    pid, slug = profile.id, profile.slug
    suspension = await suspension_of(session, profile.member_id)
    if profile.status == "suspended" or suspension is not None:
        # the page was taken down by the team: keep what it acted on (not the reporters' names)
        reports = (
            await session.scalars(
                select(AuthorReport)
                .where(AuthorReport.profile_id == pid)
                .order_by(AuthorReport.created_at)
            )
        ).all()
        evidence = {
            "slug": slug,
            "display_name": profile.display_name,
            "claimed_name": profile.claimed_name,
            "deleted_at": now_utc().isoformat(),
            "reports": [
                {
                    "reason": r.reason,
                    "comment": r.comment,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in reports
            ],
        }
        if suspension is None:
            suspension = AuthorSuspension(
                member_id=profile.member_id,
                reason=profile.suspended_reason or "suspended",
                suspended_by=profile.suspended_by,
            )
            session.add(suspension)
        suspension.evidence = evidence
    for table in (AuthorRecordingLink, AuthorReport, AuthorProfilePhoto, AuthorStatsSnapshot):
        column = table.profile_id
        await session.execute(delete(table).where(column == pid))
    await session.delete(profile)
    await session.flush()
    if was_public:
        gone = await session.scalar(select(AuthorSlugHistory).where(AuthorSlugHistory.slug == slug))
        if gone is None:
            session.add(
                AuthorSlugHistory(
                    slug=slug, profile_id=None, kind="deleted", quarantine_until=quarantine
                )
            )
    await session.commit()


async def erase_member(session: AsyncSession, member: UserAccount, settings: Settings) -> None:
    """Called when a member deletes their account: the page and the raw listening rows go too."""
    profile = await profile_of_member(session, member.id)
    if profile is not None:
        await delete_profile(session, profile)
    await stats.erase_listener(session, pepper=pepper(settings), who_values=[f"m:{member.id}"])


async def export_member(session: AsyncSession, member: UserAccount) -> dict[str, Any]:
    """Everything this feature holds about a member (GDPR access/portability)."""
    profile = await profile_of_member(session, member.id)
    reports = (
        await session.scalars(select(AuthorReport).where(AuthorReport.reporter_id == member.id))
    ).all()
    out: dict[str, Any] = {
        "profile": None,
        "recording_choices": [],
        "reports_i_made": [
            {"reason": r.reason, "comment": r.comment, "created_at": r.created_at.isoformat()}
            for r in reports
        ],
        "listening": (
            "Your own listening is not stored against your account. Counted plays keep only a "
            "short "
            "anonymous code that about 500 other people share, so they cannot be exported."
        ),
    }
    if profile is not None:
        owner = await owner_out(session, profile)
        out["profile"] = owner.model_dump(mode="json")
        links = (
            await session.scalars(
                select(AuthorRecordingLink).where(AuthorRecordingLink.profile_id == profile.id)
            )
        ).all()
        out["recording_choices"] = [
            {"recording_id": str(link.recording_id), "mode": link.mode} for link in links
        ]
    return out


# --------------------------------------------------------------------------- reports


def reporter_key(settings: Settings, member: UserAccount | None, host: str) -> str:
    if member is not None:
        return f"m:{member.id}"
    digest = hashlib.sha256(f"{pepper(settings)}|ip|{host}".encode()).hexdigest()[:24]
    return f"i:{digest}"


async def report_profile(
    session: AsyncSession,
    profile: AuthorProfile,
    *,
    key: str,
    reporter_id: UUID | None,
    reason: str,
    comment: str | None,
) -> bool:
    """True when the report is new, False when this reporter reported this page before."""
    if reporter_id is not None and reporter_id == profile.member_id:
        raise AuthorError("own_profile", 400, "You cannot report your own page")
    exists = await session.scalar(
        select(AuthorReport.id).where(
            AuthorReport.profile_id == profile.id, AuthorReport.reporter_key == key
        )
    )
    if exists is not None:
        return False
    session.add(
        AuthorReport(
            profile_id=profile.id,
            reporter_key=key,
            reporter_id=reporter_id,
            reason=reason,
            comment=rules.clean_paragraphs(comment, 1000) or None,
        )
    )
    profile.reports_count = int(profile.reports_count or 0) + 1
    if not profile.review_needed and (
        reason in URGENT_REPORT_REASONS or profile.reports_count >= REPORT_REVIEW_THRESHOLD
    ):
        profile.review_needed = True
        profile.review_reason = f"reported:{reason}"
    await session.commit()
    return True


# --------------------------------------------------------------------------- team


def admin_out(profile: AuthorProfile, count: int) -> AdminAuthorOut:
    return AdminAuthorOut(
        id=str(profile.id),
        slug=profile.slug,
        display_name=profile.display_name,
        claimed_name=profile.claimed_name,
        status=profile.status,  # type: ignore[arg-type]
        review_needed=profile.review_needed,
        review_reason=profile.review_reason,
        verified=profile.verified,
        reports_count=profile.reports_count,
        suspended_reason=profile.suspended_reason,
        created_at=profile.created_at,
        published_at=profile.published_at,
        recordings_count=count,
    )


async def admin_list(
    session: AsyncSession,
    *,
    status: str | None,
    needs_review: bool | None,
    reported: bool | None,
    query: str | None,
    limit: int,
    offset: int,
) -> tuple[list[AdminAuthorOut], int]:
    conditions: list[Any] = []
    if status:
        conditions.append(AuthorProfile.status == status)
    if needs_review is not None:
        conditions.append(AuthorProfile.review_needed.is_(needs_review))
    if reported:
        conditions.append(AuthorProfile.reports_count > 0)
    if query and query.strip():
        like = _like(query)
        conditions.append(
            or_(
                func.lower(AuthorProfile.display_name).like(like, escape="\\"),
                func.lower(AuthorProfile.slug).like(like, escape="\\"),
            )
        )
    total = int(
        await session.scalar(select(func.count()).select_from(AuthorProfile).where(*conditions))
        or 0
    )
    rows = (
        await session.scalars(
            select(AuthorProfile)
            .where(*conditions)
            .order_by(
                AuthorProfile.review_needed.desc(),
                AuthorProfile.reports_count.desc(),
                AuthorProfile.created_at.desc(),
            )
            .limit(limit)
            .offset(offset)
        )
    ).all()
    out = [admin_out(p, await count_recordings(session, p)) for p in rows]
    return out, total


async def admin_approve(session: AsyncSession, profile: AuthorProfile, by: str) -> AuthorProfile:
    """The team has looked: the name is fine. A page that was waiting goes public."""
    profile.review_needed = False
    profile.review_reason = None
    if profile.status == "draft":
        profile.status = "published"
        if profile.published_at is None:
            profile.published_at = now_utc()
    await session.commit()
    await refresh_snapshot(session, profile, force=True)
    return profile


async def admin_verify(
    session: AsyncSession, profile: AuthorProfile, by: str, verified: bool
) -> AuthorProfile:
    profile.verified = verified
    profile.verified_at = now_utc() if verified else None
    profile.verified_by = by if verified else None
    if verified:
        profile.review_needed = False
        profile.review_reason = None
    await session.commit()
    await refresh_snapshot(session, profile, force=True)
    return profile


async def admin_suspend(
    session: AsyncSession, profile: AuthorProfile, by: str, reason: str
) -> AuthorProfile:
    profile.status = "suspended"
    profile.suspended_reason = rules.clean_paragraphs(reason, 1000)
    profile.suspended_at = now_utc()
    profile.suspended_by = by
    profile.review_needed = False
    profile.review_reason = None
    record = await suspension_of(session, profile.member_id)
    if record is None:
        session.add(
            AuthorSuspension(
                member_id=profile.member_id,
                reason=profile.suspended_reason,
                suspended_by=by,
                evidence={},
            )
        )
    else:
        record.reason, record.suspended_by = profile.suspended_reason, by
    await session.commit()
    return profile


async def lift_member_suspension(session: AsyncSession, member_id: UUID) -> bool:
    """Lift a suspension that outlived its page (the page was deleted). True when there was one."""
    record = await suspension_of(session, member_id)
    if record is None:
        return False
    await session.delete(record)
    await session.commit()
    return True


async def list_suspensions(session: AsyncSession) -> list[AuthorSuspension]:
    return list(
        (
            await session.scalars(
                select(AuthorSuspension).order_by(AuthorSuspension.created_at.desc()).limit(200)
            )
        ).all()
    )


async def admin_unsuspend(session: AsyncSession, profile: AuthorProfile) -> AuthorProfile:
    profile.status = "published" if profile.published_at else "draft"
    profile.suspended_reason = None
    profile.suspended_at = None
    profile.suspended_by = None
    record = await suspension_of(session, profile.member_id)
    if record is not None:
        await session.delete(record)
    await session.commit()
    await refresh_snapshot(session, profile, force=True)
    return profile


async def sitemap_entries(session: AsyncSession) -> list[tuple[str, datetime]]:
    """Addresses a search engine may list: published, not waiting for the team, at least one
    recording."""
    await refresh_stale_snapshots(session)
    rows = (
        await session.execute(
            select(AuthorProfile.slug, AuthorProfile.updated_at)
            .join(AuthorStatsSnapshot, AuthorStatsSnapshot.profile_id == AuthorProfile.id)
            .where(
                AuthorProfile.status == "published",
                AuthorProfile.review_needed.is_(False),
                AuthorStatsSnapshot.recordings_count >= 1,
            )
            .order_by(AuthorProfile.slug)
            .limit(50000)
        )
    ).all()
    return [(slug, updated) for slug, updated in rows]


# --------------------------------------------------------------------------- owner statistics


async def owner_stats(session: AsyncSession, profile: AuthorProfile, *, days: int) -> OwnerStats:
    today = now_utc().date()
    ids = recording_ids(profile)
    numbers = await stats.numbers_for(session, ids, today=today)
    since = await stats.stats_since(session)
    series = await stats.daily_series(session, ids, today=today, days=days)
    start = today - timedelta(days=days - 1)
    in_period = sum(point["plays"] for point in series)
    top_rows = (
        await session.execute(
            select(
                Recording.id, Recording.title, Recording.kind, func.sum(PlayDaily.plays).label("n")
            )
            .join(PlayDaily, PlayDaily.recording_id == Recording.id)
            .where(Recording.id.in_(ids), PlayDaily.day >= start)
            .group_by(Recording.id, Recording.title, Recording.kind)
            .order_by(func.sum(PlayDaily.plays).desc(), Recording.title)
            .limit(5)
        )
    ).all()
    kind_rows = (
        await session.execute(
            select(Recording.kind, func.sum(PlayDaily.plays))
            .join(PlayDaily, PlayDaily.recording_id == Recording.id)
            .where(Recording.id.in_(ids), PlayDaily.day >= start)
            .group_by(Recording.kind)
        )
    ).all()
    by_kind: dict[str, int] = {}
    for kind, n in kind_rows:
        by_kind[public_kind(kind)] = by_kind.get(public_kind(kind), 0) + int(n or 0)
    countries = stats.visible_countries(await stats.country_counts(session, ids, today=today))
    enough = numbers.total_plays >= stats.MIN_PUBLIC_PLAYS
    notes = ["counting_rule", "own_plays_excluded", "listener_estimate"]
    if since is None:
        notes.append("no_data_yet")
    elif not enough:
        notes.append("not_enough_data")
    if countries is None:
        notes.append("countries_hidden")
    return OwnerStats(
        period_days=days,
        counting_since=since,
        monthly_listeners=numbers.monthly_listeners,
        total_plays=numbers.total_plays,
        plays_in_period=in_period,
        public_enough_data=enough,
        public_visible=profile.status == "published" and profile.show_stats and enough,
        series=[DayPoint(**p) for p in series],
        top_recordings=[
            TopRecording(recording_id=str(rid), title=title, kind=public_kind(kind), plays=int(n))
            for rid, title, kind, n in top_rows
        ],
        by_kind=[KindCount(kind=k, count=n) for k, n in sorted(by_kind.items())],
        countries=[CountryShare(country=c["country"], listeners=c["listeners"]) for c in countries]
        if countries
        else None,
        notes=notes,
    )
