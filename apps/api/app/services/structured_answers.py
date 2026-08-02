from __future__ import annotations

import re

from app.models import Song
from app.services.chat_language import detect_response_language
from app.services.stories import STORIES_INDEX_PATH, InspirationStory


def split_verse_lines(text: str | None) -> list[str]:
    if not text:
        return []
    return [line.strip() for line in text.splitlines() if line.strip()]


def pick_meaning(song: Song, language: str) -> str | None:
    if language == "hi":
        return song.hindi_meaning or song.english_meaning
    return song.english_meaning or song.hindi_meaning


def pair_lyrics_with_meaning(
    lyrics: list[str],
    meanings: list[str],
) -> list[tuple[str, str]]:
    if not lyrics or not meanings:
        return []
    if len(lyrics) == len(meanings):
        return list(zip(lyrics, meanings, strict=True))
    if len(meanings) == 1:
        return [(lyric, meanings[0]) for lyric in lyrics]
    pairs: list[tuple[str, str]] = []
    for index, lyric in enumerate(lyrics):
        meaning_index = min(int(index * len(meanings) / len(lyrics)), len(meanings) - 1)
        pairs.append((lyric, meanings[meaning_index]))
    return pairs


def requests_line_by_line(query: str) -> bool:
    return re.search(r"\bline[ -]by[ -]line\b", query, re.IGNORECASE) is not None


def requests_related_songs(query: str) -> bool:
    return re.search(
        r"\b(?:related|similar|recommend|another\s+song|other\s+songs?|songs?\s+like)\b",
        query,
        re.IGNORECASE,
    ) is not None


def requests_song_explanation(query: str) -> bool:
    cleaned = query.casefold()
    return any(
        term in cleaned
        for term in (
            "explain",
            "meaning",
            "mean",
            "message",
            "about this song",
            "what is this song",
            "understand",
            "arth",
            "matlab",
            "batao",
            "samjha",
            "imagery",
            "spiritual",
            "overview",
        )
    )


def build_line_by_line_answer(song: Song, language: str = "en") -> str | None:
    lyrics = split_verse_lines(song.lyrics_original or song.transliteration)
    meaning_lines = split_verse_lines(pick_meaning(song, language))
    pairs = pair_lyrics_with_meaning(lyrics, meaning_lines)
    if not pairs:
        return None

    if language == "hi":
        intro = (
            f"गीत {song.number} «{song.title}» का प्रत्येक पंक्ति-स्तर पर आधारित अर्थ "
            "नीचे दिया गया है।"
        )
        meaning_label = "अर्थ"
    else:
        intro = (
            f"Here is a grounded line-by-line reading of song {song.number}, "
            f"«{song.title}», drawn from the canonical meaning."
        )
        meaning_label = "Meaning"

    body = []
    for index, (lyric, meaning) in enumerate(pairs, start=1):
        body.append(f"{index}. Lyric: {lyric}")
        body.append(f"{meaning_label}: {meaning}")
    return f"{intro}\n\n" + "\n".join(body)


def build_overview_answer(song: Song, language: str = "en") -> str | None:
    meaning = pick_meaning(song, language)
    if not meaning:
        return None

    details = []
    if song.theme:
        details.append(f"Theme: {song.theme}.")
    if song.occasion:
        details.append(f"Occasion: {song.occasion}.")
    if song.meditation_context:
        details.append(f"Meditation context: {song.meditation_context}.")

    if language == "hi":
        opener = f"गीत {song.number} «{song.title}» का सार इस प्रकार है:"
    else:
        opener = f"Song {song.number}, «{song.title}», expresses the following grounded meaning:"

    sections = [opener, " ".join(details).strip(), meaning]
    return "\n\n".join(part for part in sections if part.strip())


def build_meditation_answer(song: Song, language: str = "en") -> str | None:
    meaning = pick_meaning(song, language)
    context = song.meditation_context or song.theme or song.mood
    if not meaning and not context:
        return None
    if language == "hi":
        opener = f"गीत {song.number} «{song.title}» पर ध्यान के लिए:"
    else:
        opener = f"To reflect on song {song.number}, «{song.title}», in meditation:"
    parts = [opener]
    if context:
        parts.append(f"Hold the feeling of {context.lower()} as you read or sing the song quietly.")
    if meaning:
        parts.append(f"Ground your reflection in this meaning:\n{meaning}")
    parts.append(
        "Sit comfortably, follow your breath, and let one line settle in the heart "
        "before moving on."
        if language != "hi"
        else "आराम से बैठें, श्वास पर ध्यान रखें, और एक-एक पंक्ति को हृदय में उतरने दें।"
    )
    return "\n\n".join(parts)


def build_related_songs_answer(
    song: Song,
    related: list[Song],
    language: str = "en",
) -> str | None:
    if not related:
        return None
    if language == "hi":
        opener = f"गीत {song.number} «{song.title}» से जुड़े कुछ Prabhat Samgiita:"
    else:
        opener = (
            f"Here are related Prabhat Samgiita songs connected to song {song.number}, "
            f"«{song.title}»:"
        )
    lines = []
    for item in related[:5]:
        detail = f" — {item.theme}" if item.theme else ""
        lines.append(f"• Song {item.number}: {item.title}{detail}")
    return f"{opener}\n\n" + "\n".join(lines)


def requests_stories_inspiration(query: str) -> bool:
    return re.search(
        r"\b(?:stor(?:y|ies)|inspiration|memor(?:y|ies)|devotee\s+experience|touching\s+story|who\s+wrote|ink\s+of\s+the\s+heart)\b",
        query,
        re.IGNORECASE,
    ) is not None


def build_stories_answer(
    song: Song | None,
    stories: list[InspirationStory],
    language: str = "en",
) -> str | None:
    if not stories:
        return None

    if language == "hi":
        opener = (
            f"गीत {song.number} «{song.title}» से जुड़ी कुछ प्रेरणादायक कथाएँ:"
            if song
            else "Prabhat Samgiita से जुड़ी कुछ प्रेरणादायक कथाएँ और अनुभव:"
        )
        read_label = "पढ़ें"
    else:
        opener = (
            f"Here are inspiration stories connected to song {song.number}, «{song.title}»:"
            if song
            else "Here are verified inspiration stories and devotee experiences:"
        )
        read_label = "Read"

    lines = [opener, ""]
    for item in stories[:5]:
        detail = f" — {item.teaser}" if item.teaser else ""
        lines.append(f"• {item.title} by {item.author}{detail}")
        lines.append(f"  {read_label}: {item.read_path}")
    lines.append("")
    lines.append(f"Browse all stories: {STORIES_INDEX_PATH}")
    return "\n".join(lines)


def try_structured_answer(
    query: str,
    song: Song,
    history: list[tuple[str, str]] | None = None,
    related: list[Song] | None = None,
) -> str | None:
    language = detect_response_language(query, history)
    cleaned = query.casefold()
    if requests_line_by_line(query):
        return build_line_by_line_answer(song, language)
    if requests_stories_inspiration(query):
        from app.services.stories import (
            load_stories_from_seed,
            stories_for_song,
            stories_matching_query,
        )

        catalog = load_stories_from_seed()
        matched = stories_for_song(catalog, song.number)
        if not matched:
            matched = stories_matching_query(catalog, query, song.number)
        if not matched:
            matched = catalog[:5]
        return build_stories_answer(song, matched, language)
    if requests_related_songs(query):
        return build_related_songs_answer(song, related or [], language)
    if re.search(r"\b(?:meditation|meditate|dhyan|reflect)\b", cleaned):
        return build_meditation_answer(song, language)
    if requests_song_explanation(query):
        return build_overview_answer(song, language)
    return None
