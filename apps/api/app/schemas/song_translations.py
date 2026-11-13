"""Shapes of the song translations (design: docs/ps-translations.md).

`TranslationOut` is the PUBLIC shape: only what a reader may see (the text, the kind, the label, the
credit, the commentary). It never carries the license note, the doubts, the checker's name or an
unpublished row. The team's shape (`AdminTranslationOut`) carries all of that.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.recordings import PS_SONG_COUNT

Kind = Literal["official", "poetic", "literal"]
Alignment = Literal["whole", "stanza", "line"]
Trust = Literal["unchecked", "reviewed", "verified", "official", "machine"]
Status = Literal["draft", "pending", "published", "rejected", "archived"]
AuthorKind = Literal["official", "team", "member", "import"]
# What the team may set when adding a text. "verified" is its own step; "machine" is never typed.
SettableTrust = Literal["unchecked", "reviewed", "official"]
# The label a reader sees. `unchecked` and `machine` rows are never served, so they have none.
Label = Literal["official", "checked", "reviewed"]
AdminFilter = Literal["all", "published", "unchecked", "checked", "archived"]

MAX_SEGMENTS = 400
MAX_TEXT = 20000


class Segment(BaseModel):
    """Lines `from` to `to` (0-based, inclusive) of the lyrics as the app draws them. `to` is null
    for "to the end of the song"."""

    model_config = ConfigDict(populate_by_name=True)

    from_: int = Field(alias="from", ge=0, le=2000)
    to: int | None = Field(default=None, ge=0, le=2000)
    text: str = Field(min_length=1, max_length=MAX_TEXT)
    doubt: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _ordered(self) -> Segment:
        if self.to is not None and self.to < self.from_:
            raise ValueError("a segment cannot end before it begins")
        return self


class TranslationOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    song_id: int
    kind: Kind
    language: str
    position: int
    alignment: Alignment
    segments: list[Segment]
    text: str
    label: Label
    checked: bool
    credit_line: str | None
    commentary: str | None
    updated_at: datetime | None


class TranslationList(BaseModel):
    song_id: int
    language: str
    # The kinds this song has, in the order the page shows them: official, poetic, literal.
    kinds: list[Kind]
    items: list[TranslationOut]


class Availability(BaseModel):
    language: str
    # song numbers that have a published, publicly visible translation of the kind
    official: list[int]
    poetic: list[int]
    literal: list[int]


class AdminTranslationOut(TranslationOut):
    status: Status
    trust: Trust
    author_kind: AuthorKind
    author_label: str | None
    source_key: str
    source_ref: str
    license_note: str | None
    doubts: list[dict[str, object]] | None
    reviewed_by: str | None
    reviewed_at: datetime | None
    verified_by: str | None
    verified_at: datetime | None
    verified_note: str | None
    rejected_reason: str | None
    replaces_id: UUID | None
    created_at: datetime | None


class AdminTranslationList(BaseModel):
    items: list[AdminTranslationOut]
    total: int


class TranslationCreate(BaseModel):
    """The team adds a text. Give `segments`, or just `text` for one segment over the whole song."""

    song_id: int = Field(ge=1, le=PS_SONG_COUNT)
    language: str = Field(
        default="en", min_length=2, max_length=12, pattern=r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$"
    )
    kind: Kind
    text: str | None = Field(default=None, min_length=1, max_length=MAX_TEXT)
    segments: list[Segment] | None = Field(default=None, max_length=MAX_SEGMENTS)
    trust: SettableTrust = "reviewed"
    author_label: str | None = Field(default=None, max_length=120)
    credit_line: str | None = Field(default=None, max_length=200)
    commentary: str | None = Field(default=None, max_length=MAX_TEXT)
    license_note: str | None = Field(default=None, max_length=2000)
    source_ref: str = Field(default="", max_length=512)
    publish: bool = True
    # A new version of a live text: the old one is archived when this one goes live.
    replaces_id: UUID | None = None
    reviewer: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def _text_or_segments(self) -> TranslationCreate:
        if (self.text is None) == (self.segments is None):
            raise ValueError("give either `text` or `segments`")
        if self.trust == "official" and self.kind != "official":
            raise ValueError("only an official text can carry the official label")
        return self


class VerifyRequest(BaseModel):
    reviewer: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=2000)


class ImportReport(BaseModel):
    dry_run: bool
    songs_with_text: int
    created: int
    updated: int
    unchanged: int
    skipped_team_edited: int
    songs_with_two_versions: int
    songs_with_more_than_two: int
