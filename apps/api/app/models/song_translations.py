"""Translations of a Prabhat Samgiita song: official, poetic and literal.

Design: docs/ps-translations.md. One row is one translation of one song, in one language and one
kind. Kind, language and version are VALUES, not columns of `songs`, so a new language or a new
kind needs no migration.

Who may write: only the team. Members do NOT offer translations (Dada's decision, 2026-11-08).
The official English texts come from `songs.english_meaning` by an import
(`app/services/song_translations.py`); every other kind is added by the team.

What a reader is told comes from `trust`:

- `official`: the official English translation of the lyrics page. Label "Official".
- `verified`: the team compared it with the Bengali text. Label "Checked". Only the team can set
  it (`/admin/song-translations/{id}/verify`), and only with a named checker and a time.
- `reviewed`: an editor read it. Label "Read by an editor".
- `unchecked`: nobody on the team has looked at it. NEVER shown to the public.
- `machine`: produced by a machine. Poetic only, never literal, never official, never checked.

The table itself refuses what must never exist (see the CHECK constraints below): a machine
literal translation, a machine text under any trust but `machine`, and a "checked" text without
the name of the checker.

`song_id` is the song NUMBER (1..5018), like `song_chord_proposals.song_id`: the number is the
public key of a song everywhere in the app.

`segments` is `[{"from": 0, "to": 1, "text": "...", "doubt": null}]`: 0-based inclusive indexes of
the lyric lines as the app draws them (repeats included). `to` is null for "to the end of the
song". A person places the segments; the code never splits or joins a translation on its own. A
translation without marking is ONE segment over the whole song (`alignment = 'whole'`).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.recordings import PS_SONG_COUNT, PortableJSON

TRANSLATION_KINDS = ("official", "poetic", "literal")
TRANSLATION_ALIGNMENTS = ("whole", "stanza", "line")
TRANSLATION_TRUSTS = ("unchecked", "reviewed", "verified", "official", "machine")
TRANSLATION_STATUSES = ("draft", "pending", "published", "rejected", "archived")
TRANSLATION_AUTHOR_KINDS = ("official", "team", "member", "import")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class SongTranslation(Base, TimestampMixin):
    __tablename__ = "song_translations"
    __table_args__ = (
        CheckConstraint(
            f"song_id >= 1 AND song_id <= {PS_SONG_COUNT}", name="ck_song_translations_song"
        ),
        CheckConstraint(_in("kind", TRANSLATION_KINDS), name="ck_song_translations_kind"),
        CheckConstraint(
            _in("alignment", TRANSLATION_ALIGNMENTS), name="ck_song_translations_alignment"
        ),
        CheckConstraint(_in("trust", TRANSLATION_TRUSTS), name="ck_song_translations_trust"),
        CheckConstraint(_in("status", TRANSLATION_STATUSES), name="ck_song_translations_status"),
        CheckConstraint(
            _in("author_kind", TRANSLATION_AUTHOR_KINDS), name="ck_song_translations_author_kind"
        ),
        # A machine literal translation cannot exist.
        CheckConstraint(
            "NOT (kind = 'literal' AND trust = 'machine')",
            name="ck_song_translations_no_machine_literal",
        ),
        # Machine text is poetic only: never the official text, never presented as checked.
        CheckConstraint(
            "trust <> 'machine' OR kind = 'poetic'", name="ck_song_translations_machine_poetic"
        ),
        # "Checked" is a person's word: a named checker and the time.
        CheckConstraint(
            "trust <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)",
            name="ck_song_translations_checked_has_checker",
        ),
        # The official label belongs to the official import only.
        CheckConstraint(
            "trust <> 'official' OR author_kind = 'official'",
            name="ck_song_translations_official_author",
        ),
        UniqueConstraint(
            "song_id",
            "language",
            "kind",
            "source_key",
            "source_ref",
            "position",
            name="uq_song_translations_import_key",
        ),
        Index("ix_song_translations_song", "song_id", "language", "kind", "status", "position"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    song_id: Mapped[int] = mapped_column(Integer, nullable=False)
    language: Mapped[str] = mapped_column(
        String(12), default="en", server_default="en", nullable=False
    )
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    # 0 is shown first; the others are "Other versions" (91 songs hold two official versions).
    position: Mapped[int] = mapped_column(
        SmallInteger, default=0, server_default="0", nullable=False
    )
    segments: Mapped[list[dict[str, Any]]] = mapped_column(PortableJSON, nullable=False)
    alignment: Mapped[str] = mapped_column(
        String(8), default="whole", server_default="whole", nullable=False
    )
    plain_text: Mapped[str] = mapped_column(Text, nullable=False)
    # sha256 of the text: an import that finds the same hash does nothing.
    text_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    author_kind: Mapped[str] = mapped_column(String(10), nullable=False)
    author_label: Mapped[str | None] = mapped_column(String(120))
    # The key of the source ("official-lyrics-page", "team") and where to find it again.
    source_key: Mapped[str] = mapped_column(String(40), nullable=False)
    source_ref: Mapped[str] = mapped_column(
        String(512), default="", server_default="", nullable=False
    )
    # What readers see as the credit under the text.
    credit_line: Mapped[str | None] = mapped_column(String(200))
    # Internal: the basis for using the text (who allowed it, when). Never served.
    license_note: Mapped[str | None] = mapped_column(Text)
    trust: Mapped[str] = mapped_column(
        String(10), default="unchecked", server_default="unchecked", nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(10), default="draft", server_default="draft", nullable=False
    )
    # The explanation of and the comments on the translation. Empty: the block is not shown.
    commentary: Mapped[str | None] = mapped_column(Text)
    # [{"line": 3, "note": "..."}]: carries the doubts of whoever prepared the text.
    doubts: Mapped[list[dict[str, Any]] | None] = mapped_column(PortableJSON)
    reviewed_by: Mapped[str | None] = mapped_column(String(255))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_by: Mapped[str | None] = mapped_column(String(255))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_note: Mapped[str | None] = mapped_column(Text)
    rejected_reason: Mapped[str | None] = mapped_column(Text)
    # Editing a published row creates a new row; the old one is archived. A checked row is never
    # changed in place.
    replaces_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("song_translations.id", ondelete="SET NULL"),
        nullable=True,
    )
    based_on_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("song_translations.id", ondelete="SET NULL"),
        nullable=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
