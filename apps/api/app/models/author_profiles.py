"""Author profiles: the public page of a person (or group) who adds Kiirtans, Bhajans and Prabhat
Samgiita recordings, and the listening statistics behind it. Design: docs/author-profiles.md.

Everything here is NEW tables. The recordings tables are only read (`recordings.author_id` says who
uploaded a recording; a profile shows the recordings of its owner and, for a team-verified known
artist,
the library recordings credited to the claimed name).

Personal-data rules that the shape of these tables carries:

* `play_events` holds no member id, no device id, no IP address. A listener is a SHORT keyed hash
  (`listener_key`, 24 bits, see services/author_stats.py) that is shared by about 500 people
  worldwide,
  so it cannot point at a person. Raw events are deleted after `PLAY_EVENT_RETENTION_DAYS`.
* `play_daily` is a plain counter per recording and day. It has no listener data and is kept.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

PROFILE_STATUSES = ("draft", "published", "suspended")
AUTHOR_TYPES = ("solo", "group")
INCLUDE_MODES = ("all", "chosen")
LINK_MODES = ("include", "exclude")
SLUG_HISTORY_KINDS = ("renamed", "deleted")
AUTHOR_REPORT_REASONS = ("impersonation", "offensive", "spam", "copyright", "wrong_info", "other")

# JSONB on Postgres, plain JSON elsewhere (the tests run on SQLite).
PortableJSON = JSON().with_variant(JSONB(), "postgresql")
# SQLite only auto-numbers an INTEGER primary key.
BigIntPk = BigInteger().with_variant(Integer(), "sqlite")


class AuthorProfile(Base, TimestampMixin):
    """One public author page. One per member (a group is a profile too)."""

    __tablename__ = "author_profiles"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'published', 'suspended')", name="ck_author_profiles_status"
        ),
        CheckConstraint("author_type IN ('solo', 'group')", name="ck_author_profiles_type"),
        CheckConstraint(
            "include_uploads IN ('all', 'chosen')", name="ck_author_profiles_include_uploads"
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    # One profile per member. The profile goes with the account (GDPR: deleting the account deletes
    # it).
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    # Lowercase ASCII, 3..30, unique. The address is /author/<slug>.
    slug: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(60), nullable=False)
    author_type: Mapped[str] = mapped_column(
        String(8), default="solo", server_default="solo", nullable=False
    )
    # Short line under the name (search result, link preview) and the long text of the About tab.
    bio: Mapped[str] = mapped_column(String(280), default="", server_default="", nullable=False)
    about: Mapped[str] = mapped_column(Text, default="", server_default="", nullable=False)
    country: Mapped[str | None] = mapped_column(String(80))
    city: Mapped[str | None] = mapped_column(String(80))
    languages: Mapped[list[str]] = mapped_column(PortableJSON, default=list, nullable=False)
    # [{kind, url}]; validated and normalised in services/author_rules.py
    links: Mapped[list[dict[str, str]]] = mapped_column(PortableJSON, default=list, nullable=False)

    # "I am the artist known as ..." (a known performer). Always goes to the team; only after the
    # team verifies the profile do library recordings credited to this name appear on it.
    claimed_name: Mapped[str | None] = mapped_column(String(120))

    status: Mapped[str] = mapped_column(
        String(12), default="draft", server_default="draft", index=True, nullable=False
    )
    # A suspicious name or slug, a claim, or reports: the team looks before the page can be
    # published.
    review_needed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", index=True, nullable=False
    )
    review_reason: Mapped[str | None] = mapped_column(String(200))
    # Set only by the team.
    verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_by: Mapped[str | None] = mapped_column(String(255))
    suspended_reason: Mapped[str | None] = mapped_column(Text)
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suspended_by: Mapped[str | None] = mapped_column(String(255))

    # Which of the owner's uploads the page shows: "all" (every one, minus the ones switched off) or
    # "chosen" (only the ones switched on). Rows in `author_recording_links` carry the exceptions.
    include_uploads: Mapped[str] = mapped_column(
        String(8), default="all", server_default="all", nullable=False
    )
    # The public page shows monthly listeners and total plays. The owner can switch that off.
    show_stats: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )
    reports_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )

    # Hash prefix of the stored photo (changes with every new picture); null when there is none.
    photo_version: Mapped[str | None] = mapped_column(String(16))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    slug_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthorSuspension(Base, TimestampMixin):
    """A suspension that belongs to the MEMBER, not to the page: deleting the suspended page does
    not lift it, and a new page cannot be made while it is active. Holds the reason, who set it and,
    once the page is deleted, the evidence the team acted on (address, name, the reports without
    the reporters' names). It goes with the account (cascade) and when the team lifts it."""

    __tablename__ = "author_suspensions"

    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="CASCADE"), primary_key=True
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    suspended_by: Mapped[str | None] = mapped_column(String(255))
    # Kept when the suspended page is deleted, so the team does not lose what it acted on:
    # {"slug", "display_name", "claimed_name", "deleted_at",
    # "reports": [{reason, comment, created_at}]}.
    # Reporters are not named. Removed with the suspension.
    evidence: Mapped[dict[str, Any]] = mapped_column(PortableJSON, default=dict, nullable=False)


class AuthorProfilePhoto(Base):
    """The picture, kept apart so listing profiles never loads image bytes (a 512 px JPEG, < 300
    KB)."""

    __tablename__ = "author_profile_photos"

    profile_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("author_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    mime: Mapped[str] = mapped_column(String(32), nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class AuthorSlugHistory(Base, TimestampMixin):
    """Old addresses. `renamed`: answers 301 to the profile's new slug. `deleted`: the profile is
    gone;
    the address answers 410 and is not given to anybody for a while (no taking over a famous
    address)."""

    __tablename__ = "author_slug_history"
    __table_args__ = (
        CheckConstraint("kind IN ('renamed', 'deleted')", name="ck_author_slug_history_kind"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    profile_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("author_profiles.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    kind: Mapped[str] = mapped_column(String(8), nullable=False)
    # `deleted` addresses can be taken again after this moment.
    quarantine_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthorRecordingLink(Base, TimestampMixin):
    """An exception to the profile's "show my uploads" rule, for one recording.

    mode `exclude`: the upload is NOT on the page although the rule is "all".
    mode `include`: the upload IS on the page although the rule is "chosen".
    """

    __tablename__ = "author_recording_links"
    __table_args__ = (
        UniqueConstraint("profile_id", "recording_id", name="uq_author_recording_links_pair"),
        CheckConstraint("mode IN ('include', 'exclude')", name="ck_author_recording_links_mode"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    profile_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("author_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    recording_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recordings.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    mode: Mapped[str] = mapped_column(String(8), nullable=False)


class AuthorReport(Base, TimestampMixin):
    """One report of one profile by one reporter (a member, or an anonymous device bucket)."""

    __tablename__ = "author_reports"
    __table_args__ = (
        UniqueConstraint("profile_id", "reporter_key", name="uq_author_reports_once"),
        CheckConstraint(
            "reason IN ('impersonation', 'offensive', 'spam', 'copyright', 'wrong_info', 'other')",
            name="ck_author_reports_reason",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    profile_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("author_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    reporter_key: Mapped[str] = mapped_column(String(80), nullable=False)
    reporter_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(16), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(16), default="new", server_default="new", nullable=False
    )


# --------------------------------------------------------------------------- statistics


class PlayEvent(Base):
    """One counted listen: one listener, one recording, one day. Raw rows, pruned after 13 months.

    `listener_key` is a SHORT keyed hash, never an id (services/author_stats.py `listener_key`). The
    unique key (recording, listener, day) is the "one count per listener per recording per day"
    rule,
    enforced by the database so two simultaneous requests cannot count twice.
    """

    __tablename__ = "play_events"
    __table_args__ = (
        UniqueConstraint("recording_id", "listener_key", "day", name="uq_play_events_once_a_day"),
        Index("ix_play_events_day_recording", "day", "recording_id"),
    )

    id: Mapped[int] = mapped_column(BigIntPk, primary_key=True, autoincrement=True)
    recording_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recordings.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    listener_key: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    # ISO 3166-1 alpha-2 from the device region, only when the app sent one. Coarse by design.
    country: Mapped[str | None] = mapped_column(String(2))
    listened_sec: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PlayDaily(Base):
    """Counted listens per recording and day. No listener data; kept after the raw rows are
    pruned."""

    __tablename__ = "play_daily"

    recording_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recordings.id", ondelete="CASCADE"),
        primary_key=True,
    )
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    plays: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)


class AuthorStatsSnapshot(Base):
    """The numbers of a profile, worked out at most every few minutes (directory sort, public
    page)."""

    __tablename__ = "author_stats_snapshots"

    profile_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("author_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    monthly_listeners: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_plays: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    recordings_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
