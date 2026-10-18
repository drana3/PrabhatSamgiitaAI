from __future__ import annotations

import re
from dataclasses import dataclass

from app.models import Song
from app.services.catalog import (
    catalog_media_snapshot,
    catalog_notation_snapshot,
    catalog_song_snapshot,
)


@dataclass(frozen=True, slots=True)
class DirectAnswer:
    text: str
    source_label: str = "Prabhat Samgiita catalog"


def _contains(query: str, *phrases: str) -> bool:
    return any(phrase in query for phrase in phrases)


def _language_answer() -> DirectAnswer:
    languages = sorted({song.language for song in catalog_song_snapshot() if song.language})
    return DirectAnswer(
        f"The structured catalog currently identifies {len(languages)} language labels: "
        f"{', '.join(languages)}. 'Roman' means a Roman-script transliteration; it is not "
        "the original language of every song."
    )


def _coverage_answer(kind: str) -> DirectAnswer:
    media = catalog_media_snapshot()
    if kind == "audio":
        audio_rows = [item for item in media if item.kind == "audio"]
        covered = {item.song_number for item in audio_rows if item.song_number is not None}
        return DirectAnswer(
            f"The catalog has {len(audio_rows):,} audio renditions covering {len(covered):,} of "
            "5,018 songs. Multiple renditions are kept under the same song number."
        )
    if kind == "video":
        video_rows = [item for item in media if item.kind == "video"]
        covered = {item.song_number for item in video_rows if item.song_number is not None}
        return DirectAnswer(
            f"The catalog has {len(video_rows):,} matched videos covering {len(covered):,} songs. "
            "Videos play from their verified YouTube source."
        )
    notation_rows = catalog_notation_snapshot()
    covered = {item.song_number for item in notation_rows if item.song_number is not None}
    learner_ready = {item.song_number for item in notation_rows if item.notation_text}
    return DirectAnswer(
        f"Canonical harmonium-notation source pages are available for {len(covered):,} songs. "
        f"Learner-readable practice drafts are currently available for {len(learner_ready):,} "
        "songs; drafts remain clearly marked until human review."
    )


def try_direct_answer(query: str, song: Song | None = None) -> DirectAnswer | None:
    cleaned = " ".join(query.casefold().split())
    if _contains(cleaned, "how many song", "total song", "number of song", "5018"):
        return DirectAnswer(
            "Prabhat Samgiita contains 5,018 songs, composed between 14 September 1982 "
            "and 20 October 1990."
        )
    if _contains(cleaned, "how many language", "which language", "what language", "languages"):
        return _language_answer()
    if _contains(cleaned, "how many audio", "audio coverage", "audio available"):
        return _coverage_answer("audio")
    if _contains(cleaned, "how many video", "video coverage", "videos available"):
        return _coverage_answer("video")
    if _contains(
        cleaned,
        "how many notation",
        "how many harmonium notation",
        "notation coverage",
        "harmonium notation available",
    ):
        return _coverage_answer("notation")
    if _contains(cleaned, "which raga", "what raga", "how many raga", "ragas"):
        return DirectAnswer(
            "Raga names are not yet consistently structured in the catalog. There are 1,100 "
            "canonical notation sources, but I should not invent raga labels until those pages "
            "have been extracted and reviewed."
        )
    if _contains(cleaned, "which tala", "what tala", "how many tala", "talas"):
        return DirectAnswer(
            "Tala names are not yet consistently structured in the catalog. They will be listed "
            "as each canonical notation source is extracted and reviewed."
        )
    if _contains(cleaned, "who composed", "composer", "who wrote", "who created"):
        return DirectAnswer(
            "Prabhat Samgiita was composed by Shrii Shrii Anandamurti, also known as "
            "Prabhat Ranjan Sarkar."
        )
    if _contains(cleaned, "when was", "date composed", "first given", "period"):
        return DirectAnswer(
            "The first Prabhat Samgiita was given on 14 September 1982 and the 5,018th on "
            "20 October 1990."
        )
    if _contains(cleaned, "what is prabhat", "about prabhat"):
        return DirectAnswer(
            "Prabhat Samgiita, meaning Songs of the New Dawn, is a collection of 5,018 songs "
            "by Shrii Shrii Anandamurti. The songs explore devotion, mysticism, nature, "
            "humanism, social awakening, and universal welfare."
        )
    if song and re.search(r"\b(?:title|first line|language|number)\b", cleaned):
        return DirectAnswer(
            f"Song {song.number} is '{song.title}'. Its opening line is "
            f"'{song.first_line or song.title}', and its catalog language label is "
            f"{song.language or 'not yet identified'}."
        )
    return None
