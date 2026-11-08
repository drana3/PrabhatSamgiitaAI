"""Request and response shapes of the author profiles (docs/author-profiles.md).

Two shapes of a profile, on purpose:

* `AuthorProfileOwner`: what the owner sees about their own page (status, review state, settings).
* `AuthorProfilePublic`: what anybody sees. It has no member id, no e-mail, no review or report
  data,
  no suspension reason. A test walks the whole JSON for those words.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.recordings import RecordingOut

AuthorType = Literal["solo", "group"]
IncludeMode = Literal["all", "chosen"]
ProfileStatus = Literal["draft", "published", "suspended"]
LinkKind = Literal[
    "youtube",
    "instagram",
    "facebook",
    "telegram",
    "spotify",
    "soundcloud",
    "bandcamp",
    "apple_music",
    "x",
    "website",
]
ReportReason = Literal["impersonation", "offensive", "spam", "copyright", "wrong_info", "other"]
Period = Literal[7, 30, 90]


class AuthorLink(BaseModel):
    kind: LinkKind
    url: str = Field(min_length=1, max_length=300)


class AuthorProfileCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=60)
    display_name: str = Field(min_length=1, max_length=120)
    author_type: AuthorType = "solo"
    bio: str = Field(default="", max_length=1000)
    about: str = Field(default="", max_length=20000)
    country: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=200)
    languages: list[str] = Field(default_factory=list, max_length=10)
    links: list[AuthorLink] = Field(default_factory=list, max_length=12)
    # "I am the artist known as ..." Goes to the team (docs: claims).
    claimed_name: str | None = Field(default=None, max_length=200)
    include_uploads: IncludeMode = "all"
    show_stats: bool = True
    # true = publish at once when nothing needs the team; false = save as a draft
    publish: bool = False


class AuthorProfilePatch(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=60)
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    author_type: AuthorType | None = None
    bio: str | None = Field(default=None, max_length=1000)
    about: str | None = Field(default=None, max_length=20000)
    country: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=200)
    languages: list[str] | None = Field(default=None, max_length=10)
    links: list[AuthorLink] | None = Field(default=None, max_length=12)
    claimed_name: str | None = Field(default=None, max_length=200)
    include_uploads: IncludeMode | None = None
    show_stats: bool | None = None


class SlugCheck(BaseModel):
    slug: str
    available: bool
    # too_short, too_long, characters, needs_letter, reserved, taken, quarantined, cooldown
    problem: str | None = None
    # true: the address is free but contains a protected name, so publishing waits for the team
    held_for_review: bool = False
    suggestions: list[str] = Field(default_factory=list)


class WeekPlays(BaseModel):
    """Plays of a page in one week of seven days (`start` is its first day): a total only."""

    start: date
    plays: int


class PublicStats(BaseModel):
    """The numbers on a public page. `enough_data` false: the app shows "counting since <date>"
    and no numbers at all (never a zero that looks like a measurement). `weeks` is the line under
    the big number: up to 12 weeks, oldest first, only with enough data; null otherwise."""

    enough_data: bool
    counting_since: date | None = None
    monthly_listeners: int | None = None
    total_plays: int | None = None
    weeks: list[WeekPlays] | None = None


class AuthorCard(BaseModel):
    """A line of the directory, the search block and the author line of a recording."""

    slug: str
    display_name: str
    author_type: AuthorType
    bio: str
    verified: bool
    photo_url: str | None
    country: str | None = None
    monthly_listeners: int | None = None
    recordings_count: int = 0


class AuthorList(BaseModel):
    items: list[AuthorCard]
    total: int
    limit: int
    offset: int
    has_more: bool


class KindCount(BaseModel):
    kind: str
    count: int


class CollectionBrief(BaseModel):
    id: str
    title: str
    place: str | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    cover_url: str | None = None
    tracks_count: int


class PublicLink(BaseModel):
    kind: LinkKind
    url: str
    # Always "nofollow ugc noopener": the text is written by a member, not by us.
    rel: str = "nofollow ugc noopener noreferrer"


class AuthorProfilePublic(BaseModel):
    slug: str
    display_name: str
    author_type: AuthorType
    bio: str
    about: str
    country: str | None
    city: str | None
    languages: list[str]
    links: list[PublicLink]
    verified: bool
    # a recording count per kind (only kinds that have any), so the tabs can hide empty ones
    kinds: list[KindCount]
    recordings_count: int
    collections_count: int
    photo_url: str | None
    published_at: datetime | None
    updated_at: datetime
    stats: PublicStats | None
    # Search engines: true only when the page is published, not suspended, not waiting for the team
    # and
    # has at least one published recording. The web page sets robots noindex from this.
    indexable: bool


class AuthorProfileOwner(BaseModel):
    id: str
    slug: str
    display_name: str
    author_type: AuthorType
    bio: str
    about: str
    country: str | None
    city: str | None
    languages: list[str]
    links: list[AuthorLink]
    claimed_name: str | None
    status: ProfileStatus
    review_needed: bool
    review_reason: str | None
    verified: bool
    suspended_reason: str | None
    include_uploads: IncludeMode
    show_stats: bool
    photo_url: str | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    recordings_count: int
    indexable: bool
    # seconds until the address can change again (0 = now)
    slug_change_wait_days: int = 0
    reports_count: int = 0
    # the public address to share, relative to the site root
    share_path: str


class OwnerResponse(BaseModel):
    """`profile` is null when the member has no author page yet (the app shows "Become an
    author")."""

    profile: AuthorProfileOwner | None
    can_create: bool = True
    # set when the team suspended this member's author page, also after the page was deleted
    suspended_reason: str | None = None


class OwnerRecordingOut(BaseModel):
    recording: RecordingOut
    # on the public page right now (published, and in the member's "which uploads" choice)
    shown: bool
    # true when the rule says "all" and this one is switched off, or "chosen" and this one is on
    exception: bool


class OwnerRecordingList(BaseModel):
    items: list[OwnerRecordingOut]
    total: int


class ShownWrite(BaseModel):
    shown: bool


class AuthorRecordingOut(RecordingOut):
    """A recording on a public author page. `plays` is null when the author hides the listening
    statistics: then the page shows no count at all."""

    plays: int | None = None  # type: ignore[assignment]


class AuthorRecordingList(BaseModel):
    items: list[AuthorRecordingOut]
    total: int
    limit: int
    offset: int
    has_more: bool


class CollectionList(BaseModel):
    items: list[CollectionBrief]


class AuthorLine(BaseModel):
    """ "By <name>" under a recording. `profile` is null when the uploader has no published page."""

    profile: AuthorCard | None


class ReportCreate(BaseModel):
    reason: ReportReason
    comment: str | None = Field(default=None, max_length=1000)


class ReportResponse(BaseModel):
    status: Literal["received", "already_reported"]
    message: str


# --------------------------------------------------------------------------- statistics


class DayPoint(BaseModel):
    day: date
    plays: int
    listeners: int


class TopRecording(BaseModel):
    recording_id: str
    title: str
    kind: str
    plays: int


class CountryShare(BaseModel):
    country: str
    listeners: int


class OwnerStats(BaseModel):
    period_days: int
    counting_since: date | None
    monthly_listeners: int
    total_plays: int
    plays_in_period: int
    # false: fewer plays than the public threshold, so the public page shows no numbers yet
    public_enough_data: bool
    public_visible: bool
    series: list[DayPoint]
    top_recordings: list[TopRecording]
    by_kind: list[KindCount]
    # null = hidden for privacy (too few listeners to show a country without singling someone out)
    countries: list[CountryShare] | None
    notes: list[str]


# --------------------------------------------------------------------------- plays


class PlayEventIn(BaseModel):
    # A recording, or a song of the Prabhat Samgiita catalogue (1..5018): exactly one of the two.
    recording_id: UUID | None = None
    song_number: int | None = Field(default=None, ge=1, le=5018)
    played_at: datetime
    listened_sec: int = Field(ge=0, le=86400)
    duration_sec: int | None = Field(default=None, ge=0, le=86400)

    @model_validator(mode="after")
    def _one_target(self) -> PlayEventIn:
        if (self.recording_id is None) == (self.song_number is None):
            raise ValueError("Send either recording_id or song_number")
        return self


class PlayBatchIn(BaseModel):
    events: list[PlayEventIn] = Field(min_length=1, max_length=200)
    # A random id the app made once; never an advertising id. Used only for signed-out listening.
    device_id: str | None = Field(default=None, min_length=8, max_length=64)
    # ISO 3166-1 alpha-2 device region, or empty.
    region: str | None = Field(default=None, max_length=8)


class PlayBatchOut(BaseModel):
    accepted: int
    duplicates: int
    rejected: dict[str, int]


# --------------------------------------------------------------------------- team


class AdminAuthorOut(BaseModel):
    id: str
    slug: str
    display_name: str
    claimed_name: str | None
    status: ProfileStatus
    review_needed: bool
    review_reason: str | None
    verified: bool
    reports_count: int
    suspended_reason: str | None
    created_at: datetime
    published_at: datetime | None
    recordings_count: int


class AdminAuthorList(BaseModel):
    items: list[AdminAuthorOut]
    total: int


class SuspendRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class AdminReportOut(BaseModel):
    id: str
    reason: ReportReason
    comment: str | None
    status: str
    created_at: datetime


class SuspensionOut(BaseModel):
    member_id: str
    reason: str
    suspended_by: str | None
    created_at: datetime
    # what was kept when the page was deleted (empty while the page still exists)
    evidence: dict[str, object] = Field(default_factory=dict)
