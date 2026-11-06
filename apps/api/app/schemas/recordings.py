from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

Kind = Literal["kiirtan", "bhajan"]
Status = Literal["published", "removed", "flagged"]
ReportReason = Literal["copyright", "offensive", "wrong_info", "duplicate", "other"]
AdminFilter = Literal["new", "flagged", "removed", "all"]


class UploadRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=3, max_length=100)
    size_bytes: int = Field(gt=0)
    # Optional: lets the server refuse an exact duplicate before the bytes travel.
    sha256: str | None = Field(default=None, pattern=r"^[0-9a-fA-F]{64}$")


class UploadTargetResponse(BaseModel):
    key: str
    method: str
    url: str
    headers: dict[str, str]
    expires_at: datetime
    max_bytes: int


class RecordingCreate(BaseModel):
    key: str = Field(min_length=10, max_length=300)
    kind: Kind = "kiirtan"
    type: str = Field(default="other", max_length=16)
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(default="", max_length=200)
    by_author: bool = False
    terms_accepted: bool
    terms_version: str = Field(min_length=1, max_length=32)
    # The chant, as typed (the app suggests titles already in the library). Empty: no group.
    mantra: str | None = Field(default=None, max_length=200)
    year: int | None = Field(default=None, ge=1800, le=2200)
    # The uploader saw "Sounds like a recording already in the library" and said theirs is a
    # different performance. `confirm_similar` is the older name of the same flag.
    confirm_different: bool = False
    confirm_similar: bool = False
    duration_sec: int | None = Field(default=None, ge=1, le=60 * 60 * 6)


class RecordingBrief(BaseModel):
    id: str
    kind: Kind
    title: str
    author: str
    audio_url: str
    mantra: str | None = None
    mantra_id: str | None = None


class RecordingOut(BaseModel):
    id: str
    kind: Kind
    type: str
    title: str
    author: str
    added_by: str
    author_id: str | None
    by_author: bool
    status: Status
    duration_sec: int | None
    plays: int
    audio_url: str
    thumbnail_url: str | None
    published_at: datetime | None
    created_at: datetime
    mantra: str | None = None
    mantra_id: str | None = None
    year: int | None = None
    # Only filled for the owner (`/recordings/mine`) and for admins.
    removed_reason: str | None = None
    removed_at: datetime | None = None
    duplicate_of: str | None = None
    removed_duplicate_of: str | None = None


class RecordingList(BaseModel):
    items: list[RecordingOut]
    total: int


class DuplicateDetail(BaseModel):
    code: Literal["duplicate", "removed_duplicate", "similar_recording", "own_duplicate"]
    message: str
    duplicate_of: RecordingBrief | None = None
    similar: list[RecordingBrief] = Field(default_factory=list)


class ReportCreate(BaseModel):
    reason: ReportReason
    comment: str | None = Field(default=None, max_length=1500)


class ReportResponse(BaseModel):
    status: Literal["received", "already_reported"]
    message: str


class BlockCreate(BaseModel):
    author_id: str = Field(min_length=36, max_length=36)


class BlockList(BaseModel):
    author_ids: list[str]


class NoticeOut(BaseModel):
    id: str
    kind: str
    recording_id: str | None
    title: str
    body: str
    payload: dict[str, object]
    created_at: datetime
    read_at: datetime | None


class TermsOut(BaseModel):
    version: str


# --- admin ---------------------------------------------------------------------------------


class AdminRecordingOut(RecordingOut):
    reports_count: int
    reviewed_at: datetime | None
    reviewed_by: str | None
    flagged_at: datetime | None
    removed_by: str | None
    audio_sha256: str
    has_fingerprint: bool
    terms_accepted_at: datetime | None


class AdminReportOut(BaseModel):
    id: str
    reason: ReportReason
    comment: str | None
    reporter_is_member: bool
    created_at: datetime


class AdminRecordingDetail(AdminRecordingOut):
    reports: list[AdminReportOut]


class AdminRecordingList(BaseModel):
    items: list[AdminRecordingOut]
    total: int


class RemoveRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    reviewer: str | None = Field(default=None, max_length=255)


class ReviewRequest(BaseModel):
    reviewer: str | None = Field(default=None, max_length=255)


class DuplicateOfRequest(BaseModel):
    """Admin: this recording is a copy of `original_id`; remove it and tell the author."""

    original_id: UUID
    reviewer: str | None = Field(default=None, max_length=255)


class DiscardRequest(BaseModel):
    """The author gave up after the "similar recording" question: drop the stored file."""

    key: str = Field(min_length=10, max_length=300)


# --- mantras -------------------------------------------------------------------------------


class MantraOut(BaseModel):
    id: str
    kind: Kind
    title: str
    versions: int
    plays: int = 0


class MantraList(BaseModel):
    items: list[MantraOut]
    total: int


class MantraVersions(BaseModel):
    mantra: MantraOut
    items: list[RecordingOut]
    total: int


class MantraLookup(BaseModel):
    """What the upload form shows under the mantra field: how many versions exist already."""

    title: str
    mantra: MantraOut | None
    versions: int


class MantraMergeRequest(BaseModel):
    source_id: UUID
    target_id: UUID
    title: str | None = Field(default=None, max_length=200)
