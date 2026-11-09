from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.recordings import (
    DANCES,
    KIND_LANGUAGE_RULE,
    KINDS_WITH_DANCE,
    KINDS_WITH_DISCOURSE,
    PS_SONG_COUNT,
    public_kind,
)
from app.services.recording_info import (
    TITLE_IN_ENGLISH,
    clean_info,
    has_non_latin_letters,
    info_problem,
    keeps_by_author,
    normalize_performance,
    normalize_recording_type,
    normalize_tempo,
)
from app.services.recording_instruments import (
    keeps_instrument,
    normalize_instrument,
)
from app.services.recording_languages import (
    OTHER,
    clean_language_other,
    normalize_language,
)
from app.services.recording_practice import normalize_practice
from app.services.recording_styles import (
    KINDS_NEEDING_STYLE,
    clean_style_other,
    clean_styles_other,
    keeps_style,
    normalize_style,
    normalize_styles,
)
from app.services.recording_tags import (
    MOOD_MESSAGE,
    UPLOAD_MOODS,
    check_counts,
    clean_own_words,
    legacy_single,
    normalize_listed,
)
from app.services.value_suggestions import (
    INSTRUMENT,
    LANGUAGE,
    MOOD,
    STYLE,
    clean_word,
    listed_code,
    max_length,
)

# The category of a recording. "kiirtan" is Baba Nam Kevalam (the only mantra of the library),
# "prabhat_samgiita" is a performance of one Prabhat Samgiita song (`ps_song_number`),
# "spiritual_song" is a song in the language the uploader names (required), "dance_song" is a song
# for Tandava or Kaoshiki (`dance`, required), "baba_audio" is a spoken discourse of Baba (language
# required, no performer), "other_mantra" is a mantra of Ananda Marga that is not Baba Nam Kevalam
# (Guru Puja, Pitriyajina ...; its `type` names which). `devotional_song` is gone: it reads as
# "bhajan".
Kind = Literal[
    "kiirtan",
    "bhajan",
    "prabhat_samgiita",
    "spiritual_song",
    "dance_song",
    "baba_audio",
    "other_mantra",
]
# An ISO 639 code from app/services/recording_languages.py, or "other" (named in `language_other`).
Language = str
FIRST_YEAR = 1900
Status = Literal["published", "removed", "flagged"]
ReportReason = Literal["copyright", "offensive", "wrong_info", "duplicate", "other"]
AdminFilter = Literal["new", "flagged", "removed", "all"]


def _legacy_kind_is_a_bhajan(value: object) -> object:
    """Reads only: a row stored as the old `devotional_song` is answered as `bhajan`."""
    return public_kind(value) if isinstance(value, str) else value


def kind_field_problem(
    kind: str,
    *,
    language: str | None,
    language_other: str | None,
    dance: str | None,
    ps_song_number: int | None,
) -> str | None:
    """What is missing or wrong for this category, as one sentence for the person; None if fine.

    ONE place for the per-category rules, used by the schema (a plain upload) and by the set
    service (a track whose language or dance comes from its playlist). The rules:
    Bhajan and spiritual song = language required; dance music = dance required (from DANCES),
    language optional; Prabhat Samgiita = song number, language optional; Kiirtan = no language.
    """
    if kind == "prabhat_samgiita" and ps_song_number is None:
        return "Choose the Prabhat Samgiita song this is a performance of."
    if kind != "prabhat_samgiita" and ps_song_number is not None:
        return "A song number belongs to the Prabhat Samgiita category only."
    if KIND_LANGUAGE_RULE.get(kind) == "required" and not language:
        return (
            "Choose the language of this discourse."
            if kind == "baba_audio"
            else "Choose the language of this song."
        )
    if language == OTHER and not language_other:
        return "Write the name of the language."
    if kind in KINDS_WITH_DANCE:
        if not dance:
            return "Choose the dance: " + " or ".join(d.title() for d in DANCES) + "."
        if dance not in DANCES:
            return "Choose one of the dances: " + ", ".join(DANCES) + "."
    elif dance:
        return "A dance belongs to the Dance music category only."
    return None


class UploadRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=3, max_length=100)
    size_bytes: int = Field(gt=0)
    # Optional: lets the server refuse an exact duplicate before the bytes travel.
    sha256: str | None = Field(default=None, pattern=r"^[0-9a-fA-F]{64}$")
    # The file is a track of this playlist from an event: its own, larger allowance applies.
    collection_id: UUID | None = None


class UploadTargetResponse(BaseModel):
    key: str
    method: str
    url: str
    headers: dict[str, str]
    expires_at: datetime
    max_bytes: int


def _split_own_words(
    field: str, listed: list[str], own: list[str]
) -> tuple[list[str], list[str]]:
    """The own words of a list field: a word that IS a listed value moves to the ids (and is
    never queued), the others are cleaned (2 to 40 characters) and stay words."""
    ids = list(listed)
    words: list[str] = []
    for text in own:
        word = clean_word(text, max_length(field))
        code = listed_code(field, word)
        if code:
            if code not in ids:
                ids.append(code)
        elif word.casefold() not in {w.casefold() for w in words}:
            words.append(word)
    return ids, words


def _custom_word(field: str, text: str | None, empty_message: str | None) -> tuple[str, str | None]:
    """("other", word) for a new word, or (code, None) when the word is a listed value."""
    if not (text or "").strip():
        if empty_message is None:
            return OTHER, None  # the style rule above already asks for the name
        raise ValueError(empty_message)
    word = clean_word(text, max_length(field))
    code = listed_code(field, word)
    return (code, None) if code else (OTHER, word)


class RecordingCreate(BaseModel):
    key: str = Field(min_length=10, max_length=300)
    kind: Kind = "kiirtan"
    type: str = Field(default="other", max_length=16)
    # The uploader types the title.
    title: str = Field(min_length=1, max_length=200)
    # Performer or group: required (the form prefills it with the member's name).
    # Not asked for Baba's Audio Discourses (the speaker is Baba); a playlist track may leave it out
    # too (the service then uses the uploader's name). Every other single upload names it.
    author: str = Field(default="", max_length=200)
    by_author: bool = False
    terms_accepted: bool
    terms_version: str = Field(min_length=1, max_length=32)
    # Language: an ISO code, "other" (then `language_other`), or one of the five old words.
    # Required for a Bhajan and a spiritual song, optional for Prabhat Samgiita and dance music,
    # dropped for a Kiirtan.
    language: str | None = Field(default=None, max_length=16)
    language_other: str | None = Field(default=None, max_length=200)
    # Required for a dance music (one of DANCES), refused for every other category.
    dance: str | None = Field(default=None, max_length=16)
    # How it is sung or played: SEVERAL ids of STYLES (`styles`) and the person's own words
    # (`styles_other`, 2 to 40 characters each). REQUIRED for a Kiirtan (one of either), optional
    # for the other categories, dropped for Baba's Audio Discourses. `style` / `style_other` are
    # the older single field: sent alone (an older phone) they read as a list of one, and after
    # validation they mirror the first of the lists.
    styles: list[str] | None = Field(default=None, max_length=12)
    styles_other: list[str] | None = Field(default=None, max_length=12)
    style: str | None = Field(default=None, max_length=16)
    style_other: str | None = Field(default=None, max_length=200)
    # How it feels: SEVERAL ids of the five moods of the form, plus own words. Optional; the listed
    # ones become suggestions the listeners can confirm (services/recording_moods.py).
    moods: list[str] | None = Field(default=None, max_length=12)
    moods_other: list[str] | None = Field(default=None, max_length=12)
    # Optional, Kiirtan only: "avarta" marks an Avarta Kiirtan (the special practice, sung facing
    # six directions in turn). Dropped for the others. See services/recording_practice.py.
    practice: str | None = Field(default=None, max_length=16)
    # How it was recorded: studio, live or ai (services/recording_info.py; the old "home" reads as
    # studio). REQUIRED for a Kiirtan, optional for the other categories that carry it, dropped for
    # the others. An AI recording is stored and shown as such, never hidden.
    recording_type: str | None = Field(default=None, max_length=16)
    # Optional: slow / medium / fast / mix (Dance music only); solo / group (Kiirtan, Bhajan, Other
    # mantras).
    tempo: str | None = Field(default=None, max_length=8)
    performance: str | None = Field(default=None, max_length=8)
    # The main (lead) instrument: a code of services/recording_instruments.py, or "other" with its
    # name (`lead_instrument_other`, 2 to 40 characters; it goes to the team's suggestion queue).
    # Optional; dropped for Baba's Audio Discourses.
    lead_instrument: str | None = Field(default=None, max_length=32)
    lead_instrument_other: str | None = Field(default=None, max_length=200)
    # Optional details ("More details" in the app).
    credits: str | None = Field(default=None, max_length=300)
    year: int | None = Field(default=None, ge=FIRST_YEAR)
    notes: str | None = Field(default=None, max_length=500)
    # Where it was recorded or performed (every category, optional); Baba's Audio Discourses also
    # name the discourse (dropped for the other kinds).
    place: str | None = Field(default=None, max_length=200)
    discourse: str | None = Field(default=None, max_length=200)
    # Required for a Prabhat Samgiita recording (1..5018), not allowed for the other categories.
    ps_song_number: int | None = Field(default=None, ge=1, le=PS_SONG_COUNT)
    # The uploader saw "Sounds like a recording already in the library" and said theirs is a
    # different performance. `confirm_similar` is the older name of the same flag.
    confirm_different: bool = False
    confirm_similar: bool = False
    duration_sec: int | None = Field(default=None, ge=1, le=60 * 60 * 6)
    # A track of a playlist from an event: the set, the place in it, the day it was recorded.
    collection_id: UUID | None = None
    position: int | None = Field(default=None, ge=1, le=1000)
    recorded_on: date | None = None
    # The recording of an ended live broadcast (docs/broadcasts.md): the broadcast it belongs to.
    # The author of the broadcast and the team link it at once, anybody else suggests it.
    broadcast_id: UUID | None = None

    @field_validator("language", mode="before")
    @classmethod
    def _language_is_a_known_code(cls, value: object) -> str | None:
        if value is None or isinstance(value, str):
            return normalize_language(value)
        raise ValueError("Choose a language from the list.")

    @field_validator("style", mode="before")
    @classmethod
    def _style_is_a_known_id(cls, value: object) -> str | None:
        if value is None or isinstance(value, str):
            return normalize_style(value)
        raise ValueError("Choose a style from the list.")

    @field_validator("styles", mode="before")
    @classmethod
    def _styles_are_known_ids(cls, value: object) -> list[str] | None:
        return None if value is None else normalize_styles(value)

    @field_validator("styles_other", mode="before")
    @classmethod
    def _styles_other_are_words(cls, value: object) -> list[str] | None:
        return None if value is None else clean_styles_other(value)

    @field_validator("moods", mode="before")
    @classmethod
    def _moods_are_known_ids(cls, value: object) -> list[str] | None:
        if value is None:
            return None
        if not isinstance(value, list | tuple):
            raise ValueError(MOOD_MESSAGE)
        return normalize_listed(value, UPLOAD_MOODS, MOOD_MESSAGE)

    @field_validator("moods_other", mode="before")
    @classmethod
    def _moods_other_are_words(cls, value: object) -> list[str] | None:
        if value is None:
            return None
        if not isinstance(value, list | tuple):
            raise ValueError(MOOD_MESSAGE)
        return clean_own_words(value, MOOD_MESSAGE)

    @field_validator("practice", mode="before")
    @classmethod
    def _practice_is_a_known_id(cls, value: object) -> str | None:
        if value is None or isinstance(value, str):
            return normalize_practice(value)
        raise ValueError("Choose a practice from the list.")

    @field_validator("recording_type", mode="before")
    @classmethod
    def _recording_type_is_a_known_id(cls, value: object) -> str | None:
        if value is None or isinstance(value, str):
            return normalize_recording_type(value)
        raise ValueError("Choose how this was recorded from the list.")

    @field_validator("tempo", mode="before")
    @classmethod
    def _tempo_is_a_known_id(cls, value: object) -> str | None:
        if value is None or isinstance(value, str):
            return normalize_tempo(value)
        raise ValueError("Choose a tempo from the list.")

    @field_validator("performance", mode="before")
    @classmethod
    def _performance_is_a_known_id(cls, value: object) -> str | None:
        if value is None or isinstance(value, str):
            return normalize_performance(value)
        raise ValueError("Choose solo or group from the list.")

    @field_validator("lead_instrument", mode="before")
    @classmethod
    def _lead_instrument_is_a_known_code(cls, value: object) -> str | None:
        if value is None or isinstance(value, str):
            return normalize_instrument(value)
        raise ValueError("Choose the main instrument from the list.")

    @field_validator("dance", mode="before")
    @classmethod
    def _dance_in_lower_case(cls, value: object) -> object:
        return value.strip().lower() or None if isinstance(value, str) else value

    @field_validator("recorded_on")
    @classmethod
    def _recorded_not_in_the_future(cls, value: date | None) -> date | None:
        if value is not None and value > datetime.now(UTC).date() + timedelta(days=1):
            raise ValueError("The date cannot be in the future.")
        if value is not None and value.year < FIRST_YEAR:
            raise ValueError(f"The date cannot be before {FIRST_YEAR}.")
        return value

    @field_validator("year")
    @classmethod
    def _year_not_in_the_future(cls, value: int | None) -> int | None:
        if value is not None and value > datetime.now(UTC).year:
            raise ValueError("The year cannot be in the future.")
        return value

    @model_validator(mode="after")
    def _fields_match_the_category(self) -> Self:
        # A Kiirtan has no language field (it is always Baba Nam Kevalam): a language sent with
        # one is dropped, so a Kiirtan never carries one.
        # (Inside a playlist a track that did not name its kind takes the playlist's, so its
        # language is kept until the service knows the kind.)
        kind_unsaid = self.collection_id is not None and "kind" not in self.model_fields_set
        if KIND_LANGUAGE_RULE.get(self.kind) == "none" and not kind_unsaid:
            self.language = None
        # Styles and moods: every category but Baba's spoken discourses keeps them. The older single
        # `style` (an older phone) reads as a list of one; "other" without a name is refused.
        if not kind_unsaid and not keeps_style(self.kind):
            self.styles = self.styles_other = None
            self.style = self.style_other = None
            self.moods = self.moods_other = None
        if self.style == OTHER:
            self.style_other = clean_style_other(self.style_other)
            if not self.style_other and not self.styles and not self.styles_other:
                raise ValueError("Write the name of the style.")
        if not self.styles and not self.styles_other and self.style:
            if self.style == OTHER:
                self.styles_other = [self.style_other] if self.style_other else []
            else:
                self.styles = [self.style]
        self.styles, self.styles_other = _split_own_words(
            STYLE, self.styles or [], self.styles_other or []
        )
        check_counts(self.styles, self.styles_other, "styles")
        self.moods, self.moods_other = _split_own_words(
            MOOD, self.moods or [], self.moods_other or []
        )
        check_counts(self.moods, self.moods_other, "moods")
        # A Kiirtan must say how it is sung (a listed style or its own word). A playlist track takes
        # the playlist's kind, so the service checks it once the kind is known.
        if (
            self.kind in KINDS_NEEDING_STYLE
            and not kind_unsaid
            and not (self.styles or self.styles_other)
        ):
            raise ValueError("Choose the style of the Kiirtan.")
        # The old single field mirrors the first of the lists (an older phone, the search shelves).
        self.style, self.style_other = legacy_single(self.styles, self.styles_other)
        if self.kind != "kiirtan" and not kind_unsaid:
            self.practice = None
        # How it was recorded, the tempo and solo/group: each category keeps the ones it carries.
        # A Kiirtan must say how it was recorded; an AI recording is refused where it is not taken
        # (it is never quietly turned into an ordinary one).
        if self.kind == "kiirtan" and not kind_unsaid and has_non_latin_letters(self.title):
            raise ValueError(TITLE_IN_ENGLISH)
        if not kind_unsaid:
            self.recording_type, self.tempo, self.performance = clean_info(
                self.kind, self.recording_type, self.tempo, self.performance
            )
            problem = info_problem(self.kind, self.recording_type, self.performance)
            if problem:
                raise ValueError(problem)
        # "I composed it myself": not for Prabhat Samgiita (one author) or Baba's discourses.
        if not kind_unsaid:
            self.by_author = keeps_by_author(self.kind, self.by_author)
        # The place is asked for every category; the discourse name only for Baba's talks.
        if self.kind not in KINDS_WITH_DISCOURSE and not kind_unsaid:
            self.discourse = None
        # The main instrument: a listed code, or "other" with a name of 2 to 40 characters. A name
        # that IS a listed instrument ("Piano") becomes its code; the queue never sees it.
        if not kind_unsaid and not keeps_instrument(self.kind):
            self.lead_instrument = None
        if self.lead_instrument == OTHER:
            self.lead_instrument, self.lead_instrument_other = _custom_word(
                INSTRUMENT, self.lead_instrument_other, "Write the name of the instrument."
            )
        else:
            self.lead_instrument_other = None
        # The performer is named by every single upload except an audio discourse of Baba.
        if self.collection_id is None and self.kind != "baba_audio" and not self.author.strip():
            raise ValueError("Add who performs it.")
        # The free-text name only goes with "other", and is cleaned before it is stored.
        # A written language goes through the same queue as an instrument: a name that IS a listed
        # language ("Russian") becomes its code, the rest is cleaned and stays "other" + the name.
        if self.language == OTHER and (self.language_other or "").strip():
            self.language, self.language_other = _custom_word(LANGUAGE, self.language_other, None)
        else:
            self.language_other = (
                clean_language_other(self.language_other) if self.language == OTHER else None
            )
        # A track of a playlist may take its language or dance from the playlist, so the service
        # checks it after the defaults are in; a plain upload is checked here.
        if self.collection_id is None:
            problem = kind_field_problem(
                self.kind,
                language=self.language,
                language_other=self.language_other,
                dance=self.dance,
                ps_song_number=self.ps_song_number,
            )
            if problem:
                raise ValueError(problem)
        return self


class PracticeSet(BaseModel):
    """`PATCH /recordings/{id}/practice`: mark a Kiirtan as an Avarta Kiirtan, or clear it."""

    practice: str | None = None

    @field_validator("practice", mode="before")
    @classmethod
    def _known_practice(cls, value: object) -> str | None:
        if value is None or isinstance(value, str):
            return normalize_practice(value)
        raise ValueError("Choose a practice from the list.")


class LanguageSet(BaseModel):
    """`PATCH /recordings/{id}/language`: the language of a recording stored without one (an old
    Bhajan or Spiritual song). Same rules as an upload: a catalog code, or "other" with its name."""

    language: str = Field(min_length=1, max_length=16)
    language_other: str | None = Field(default=None, max_length=200)

    @field_validator("language", mode="before")
    @classmethod
    def _known_code(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("Choose a language from the list.")
        code = normalize_language(value)
        if code is None:
            raise ValueError("Choose a language from the list.")
        return code

    @model_validator(mode="after")
    def _other_has_its_name(self) -> Self:
        # A written language goes through the same queue as an instrument: a name that IS a listed
        # language ("Russian") becomes its code, the rest is cleaned and stays "other" + the name.
        if self.language == OTHER and (self.language_other or "").strip():
            self.language, self.language_other = _custom_word(LANGUAGE, self.language_other, None)
        else:
            self.language_other = (
                clean_language_other(self.language_other) if self.language == OTHER else None
            )
        if self.language == OTHER and not self.language_other:
            raise ValueError("Write the name of the language.")
        return self


class RecordingBrief(BaseModel):
    id: str
    kind: Kind
    title: str
    author: str
    audio_url: str
    # For the question "is this the song you want to upload?": how long it is, and which layers of
    # the check matched (title, duration, sound; services/recording_matches.py). Empty elsewhere.
    duration_sec: int | None = None
    reasons: list[str] = Field(default_factory=list)

    _kind_read = field_validator("kind", mode="before")(_legacy_kind_is_a_bhajan)


class FromBroadcast(BaseModel):
    """The mark "From a live broadcast: <title>, <date>" of a recording made from one."""

    id: str
    title: str
    date: date


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
    year: int | None = None
    language: Language | None = None
    credits: str | None = None
    notes: str | None = None
    ps_song_number: int | None = None
    # Baba's Audio Discourses: where it was given, and the name or number of the discourse.
    place: str | None = None
    discourse: str | None = None
    # Dance music: "tandava" or "kaoshiki". Language: the ISO code ("other" + `language_other`).
    dance: str | None = None
    language_other: str | None = None
    # How it is sung or played: the listed ids and the author's own words (a row from before the
    # lists reads as a list of one), and the old single value, which mirrors the first of them.
    styles: list[str] = Field(default_factory=list)
    styles_other: list[str] = Field(default_factory=list)
    style: str | None = None
    style_other: str | None = None
    # How it feels, as the uploader said it (the listener-confirmed moods are another endpoint).
    moods: list[str] = Field(default_factory=list)
    moods_other: list[str] = Field(default_factory=list)
    # Kiirtan only: "avarta" for an Avarta Kiirtan, else null.
    practice: str | None = None
    # How it was recorded (studio, live, ai), the tempo (Dance music only) and solo/group; null when
    # not said.
    recording_type: str | None = None
    tempo: str | None = None
    performance: str | None = None
    # The main (lead) instrument: a listed code, or "other" (then the word, which only its author
    # sees until the team accepts it; `lead_instrument_checked` says it was accepted).
    lead_instrument: str | None = None
    lead_instrument_other: str | None = None
    lead_instrument_checked: bool = False
    # How loud the file is, measured on the server (integrated loudness in LUFS, true peak in
    # dBTP); the phone levels playback with them. Null until measured.
    loudness_lufs: float | None = Field(default=None, ge=-70.0, le=0.0)
    true_peak_db: float | None = Field(default=None, ge=-120.0, le=6.0)
    # Playlist from an event: its id, the place in it, the day this track was recorded.
    collection_id: str | None = None
    position: int | None = None
    recorded_on: date | None = None
    # Only filled for the owner (`/recordings/mine`) and for admins.
    removed_reason: str | None = None
    removed_at: datetime | None = None
    duplicate_of: str | None = None
    removed_duplicate_of: str | None = None
    # Only on the page of ONE recording: the live broadcast it was recorded from, if any.
    from_broadcast: FromBroadcast | None = None

    _kind_read = field_validator("kind", mode="before")(_legacy_kind_is_a_bhajan)


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
