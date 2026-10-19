"""Shared helpers so admin Devanagari review always shows current text.

Production DB may lag behind packaged ``songs.json`` after catalogue import.
Admin load (web + mobile) and optional lazy hydrate fill missing Devanagari
from the catalogue so editors see Roman + editable Devanagari together.

Also computes a Roman→Devanagari conversion confidence % using the
deterministic engine + language/regional grammar agents, plus triage reasons.
"""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Song
from app.schemas.admin import AdminDevanagariSong
from app.services.catalog import songs_by_number
from app.services.transliteration import review_deterministic, transliterate, verify
from app.services.transliteration.language_agents import ReviewLanguage, language_note
from app.services.transliteration.verification import VerificationStatus

_REGIONAL_KEY_TO_LANG: list[tuple[str, str, ReviewLanguage]] = [
    ("magahi", "Magahi", ReviewLanguage.MAGAHI),
    ("magahii", "Magahi", ReviewLanguage.MAGAHI),
    ("maithil", "Maithili", ReviewLanguage.MAITHILI),
    ("aungika", "Angika", ReviewLanguage.ANGIKA),
    ("angika", "Angika", ReviewLanguage.ANGIKA),
    ("bhojpuri", "Bhojpuri", ReviewLanguage.BHOJPURI),
]


def catalog_devanagari(number: int) -> tuple[str | None, str]:
    seeded = songs_by_number().get(number)
    if seeded is None:
        return None, "none"
    text = (getattr(seeded, "lyrics_devanagari", None) or "").strip() or None
    status = (getattr(seeded, "devanagari_status", None) or "none").strip() or "none"
    return text, status


def catalog_roman(number: int) -> str:
    seeded = songs_by_number().get(number)
    if seeded is None:
        return ""
    return (seeded.lyrics_original or seeded.transliteration or "").strip()


async def ensure_song_devanagari_loaded(
    session: AsyncSession, song: Song, *, persist: bool = True
) -> Song:
    """If DB Devanagari is empty, fill from packaged catalogue (optionally persist)."""
    if (song.lyrics_devanagari or "").strip():
        return song
    text, status = catalog_devanagari(song.number)
    if not text:
        return song
    song.lyrics_devanagari = text
    if (song.devanagari_status or "none") == "none":
        song.devanagari_status = status if status != "none" else "provisional"
    if persist:
        await session.commit()
        await session.refresh(song)
    return song


def _category_blob(song: Song) -> str:
    parts = [
        song.language or "",
        song.theme or "",
        song.title or "",
    ]
    meta = song.metadata_json if isinstance(song.metadata_json, dict) else {}
    for key in ("category", "language", "purport", "anchor"):
        val = meta.get(key)
        if isinstance(val, str):
            parts.append(val)
    return " ".join(parts)


def detect_song_language_profile(song: Song) -> tuple[str, ReviewLanguage, str | None]:
    """Return (display label, agent language, optional regional grammar note)."""
    blob = unicodedata.normalize("NFKC", _category_blob(song)).lower()
    flat = "".join(
        ch for ch in unicodedata.normalize("NFKD", blob) if not unicodedata.combining(ch)
    )

    for key, label, lang in _REGIONAL_KEY_TO_LANG:
        if key in flat:
            return label, lang, language_note(lang)

    if re.search(r"\bbangla\b|\bbengali\b|bangla dialect", flat):
        return "Bengali", ReviewLanguage.BENGALI, None
    if re.search(r"samskrta|saṃskṛta|sanskrit", flat):
        return "Saṃskṛta", ReviewLanguage.SAMSKRTA, None
    if re.search(r"\burdu\b", flat):
        return "Urdu", ReviewLanguage.URDU, None
    if re.search(r"\bhindi\b", flat):
        return "Hindi", ReviewLanguage.HINDI, None

    lang = (song.language or "").strip()
    if lang and not re.fullmatch(r"roman", lang, flags=re.IGNORECASE):
        return lang, ReviewLanguage.HINDI, None
    return "Roman (catalogue)", ReviewLanguage.HINDI, None


def _norm_dev(text: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", text or ""))


def _review_reasons(
    *,
    engine_ambiguous: list[str],
    engine_unsupported: list[str],
    engine_warnings: list[str],
    verify_issues: list[str],
    suggestion_count: int,
) -> list[str]:
    reasons: list[str] = []
    if engine_unsupported:
        reasons.append(
            "unsupported tokens: " + ", ".join(engine_unsupported[:12])
        )
    if engine_ambiguous:
        reasons.append(
            "ambiguous tokens: " + ", ".join(engine_ambiguous[:12])
        )
    for warn in engine_warnings[:4]:
        reasons.append(warn)
    for issue in verify_issues[:6]:
        reasons.append(issue)
    if suggestion_count:
        reasons.append(f"{suggestion_count} language-agent suggestion(s) pending review")
    return reasons


def conversion_confidence(
    roman: str,
    stored_devanagari: str | None,
    *,
    review_language: ReviewLanguage,
) -> tuple[int | None, str | None, list[str], list[str], list[str]]:
    """Heuristic confidence + triage token lists for admin review.

    Returns
    -------
    percent, notes, review_reasons, ambiguous_tokens, unsupported_tokens
    """
    roman = (roman or "").strip()
    if not roman:
        return None, None, [], [], []
    engine = transliterate(roman)
    if not engine.devanagari:
        return (
            0,
            "Engine produced no Devanagari for this Roman text.",
            ["engine produced no Devanagari"],
            list(engine.ambiguous_tokens),
            list(engine.unsupported_tokens),
        )

    report = verify(engine, reference_devanagari=stored_devanagari)
    review = review_deterministic(review_language, roman, engine.devanagari)

    score = 90.0
    if engine.unsupported_tokens:
        score -= min(30.0, 8.0 * len(engine.unsupported_tokens))
    if engine.ambiguous_tokens:
        score -= min(18.0, 4.0 * len(engine.ambiguous_tokens))
    error_n = sum(1 for i in report.issues if i.severity == "error")
    warn_n = sum(1 for i in report.issues if i.severity == "warning")
    score -= 12.0 * error_n
    score -= 4.0 * warn_n
    if review.suggestions:
        score -= min(28.0, 5.0 * len(review.suggestions))

    stored = (stored_devanagari or "").strip()
    if stored:
        sim = SequenceMatcher(
            None, _norm_dev(stored), _norm_dev(engine.devanagari)
        ).ratio()
        score = 0.5 * score + 0.5 * (sim * 100.0)
        if report.status is VerificationStatus.REFERENCE_MATCHED:
            score = max(score, 96.0)

    percent = int(max(0, min(100, round(score))))
    bits: list[str] = [
        f"Triage aid (not measured accuracy) · {review_language.value} grammar agent",
    ]
    if review.suggestions:
        bits.append(f"{len(review.suggestions)} language suggestion(s)")
    if engine.ambiguous_tokens:
        bits.append(f"{len(engine.ambiguous_tokens)} ambiguous token(s)")
    if error_n:
        bits.append(f"{error_n} verification error(s)")

    reasons = _review_reasons(
        engine_ambiguous=list(engine.ambiguous_tokens),
        engine_unsupported=list(engine.unsupported_tokens),
        engine_warnings=list(engine.warnings),
        verify_issues=[f"{i.code}: {i.message}" for i in report.issues],
        suggestion_count=len(review.suggestions),
    )
    return (
        percent,
        "; ".join(bits),
        reasons,
        list(engine.ambiguous_tokens),
        list(engine.unsupported_tokens),
    )


def admin_devanagari_payload(song: Song) -> AdminDevanagariSong:
    roman = (song.lyrics_original or song.transliteration or "").strip()
    if not roman:
        roman = catalog_roman(song.number)
    dev = (song.lyrics_devanagari or "").strip()
    status = (song.devanagari_status or "none").strip() or "none"
    if not dev:
        cat_dev, cat_status = catalog_devanagari(song.number)
        if cat_dev:
            dev = cat_dev
            if status == "none":
                status = cat_status if cat_status != "none" else "provisional"

    lang_label, review_lang, regional = detect_song_language_profile(song)
    confidence, conf_note, reasons, ambiguous, unsupported = conversion_confidence(
        roman, dev or None, review_language=review_lang
    )

    return AdminDevanagariSong(
        song_number=song.number,
        title=song.title,
        lyrics_original=roman or None,
        lyrics_devanagari=dev or None,
        devanagari_status=status,
        line_count_roman=len(roman.split("\n")) if roman else 0,
        line_count_devanagari=len(dev.split("\n")) if dev else 0,
        song_language=lang_label,
        review_language=review_lang.value,
        conversion_confidence_percent=confidence,
        conversion_notes=conf_note,
        regional_grammar_notes=regional,
        review_reasons=reasons,
        ambiguous_tokens=ambiguous,
        unsupported_tokens=unsupported,
    )
