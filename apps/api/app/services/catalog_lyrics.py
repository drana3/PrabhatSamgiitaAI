"""Sanitize catalogue lyrics: language labels, scrape padding, stanza gaps."""

from __future__ import annotations

import re
from typing import Any

from app.services.lyrics_theme import (
    extract_trailing_english_theme,
    is_english_theme_line,
    looks_like_converted_theme_line,
    strip_trailing_theme_from_devanagari,
)

_LANGUAGE_ALIASES: dict[str, frozenset[str]] = {
    "sanskrit": frozenset({"sanskrit", "samskrta", "samskrt", "samskrto"}),
    "bengali": frozenset({"bengali", "bangla"}),
    "hindi": frozenset({"hindi"}),
    "english": frozenset({"english"}),
    "urdu": frozenset({"urdu"}),
    "maithili": frozenset({"maithili", "maethili"}),
    "angika": frozenset({"angika"}),
    "magahi": frozenset({"magahi"}),
    "roman": frozenset({"roman"}),
}

_ALL_LANGUAGE_LABEL_FOLDS: frozenset[str] = frozenset(
    list(_LANGUAGE_ALIASES.keys())
    + [alias for aliases in _LANGUAGE_ALIASES.values() for alias in aliases]
)


def _fold_label(value: str) -> str:
    import unicodedata

    text = unicodedata.normalize("NFKD", value or "")
    out = []
    for character in text:
        if unicodedata.combining(character):
            continue
        if character.isalpha():
            out.append(character.casefold())
    return "".join(out)


def _expand_language_folds(language: str | None, extra: list[str]) -> set[str]:
    folds: set[str] = set()
    tokens = [part.strip() for part in re.split(r"[,;/]+", language or "") if part.strip()]
    tokens.extend(extra)
    for token in tokens:
        folded = _fold_label(token)
        if not folded:
            continue
        folds.add(folded)
        for canonical, aliases in _LANGUAGE_ALIASES.items():
            if folded == canonical or folded in aliases:
                folds.add(canonical)
                folds.update(aliases)
    return folds


def is_corrupt_lyric_padding_line(line: str) -> bool:
    text = (line or "").strip()
    if len(text) < 8:
        return False
    import unicodedata

    letters = []
    for character in unicodedata.normalize("NFKD", text):
        if unicodedata.combining(character):
            continue
        if character.isalpha():
            letters.append(character)
    if len(letters) < 8:
        return False
    compact = re.sub(r"\s", "", text)
    if len(letters) < len(compact) * 0.5:
        return False
    upper = "".join(letters).upper()
    if upper and all(character == "A" for character in upper):
        return True
    # Devanagari / scrape padding: one letter repeated (e.g. आआआआ… from Roman Á runs).
    if len(set(letters)) == 1:
        return True
    counts: dict[str, int] = {}
    for letter in letters:
        counts[letter] = counts.get(letter, 0) + 1
    top = max(counts.values())
    return top >= 8 and top >= len(letters) * 0.85


def is_catalog_language_label_line(
    line: str,
    language: str | None,
    extra_languages: list[str] | None = None,
) -> bool:
    text = (line or "").strip()
    if not text or len(text) > 48:
        return False
    if is_english_theme_line(text):
        return False
    folded = _fold_label(text)
    if not folded:
        return False
    folds = _expand_language_folds(language, list(extra_languages or []))
    if folded in folds:
        return True
    if folded == "samskrta" and "sanskrit" in folds:
        return True
    if folded == "sanskrit" and "samskrta" in folds:
        return True
    words = text.split()
    if len(words) > 2:
        return False
    # Official pages put language headers in the lyric block (e.g. SAMSKRTA) even when
    # catalogue language is Roman and metadata lacks Sanskrit.
    if len(words) == 1 and folded in _ALL_LANGUAGE_LABEL_FOLDS:
        return True
    for candidate in folds:
        if folded == candidate:
            return True
        if len(folded) >= 4 and len(candidate) >= 4:
            if folded.startswith(candidate) or candidate.startswith(folded):
                return True
    return False


def _max_consecutive_blank_run(lines: list[str]) -> int:
    best = 0
    index = 0
    while index < len(lines):
        if lines[index].strip():
            index += 1
            continue
        run = 0
        while index + run < len(lines) and not lines[index + run].strip():
            run += 1
        best = max(best, run)
        index += run
    return best


def _needs_official_br_normalization(lines: list[str]) -> bool:
    """Raw HTML scrape uses multi-<br> runs; already-normalized lyrics use single blank gaps."""
    max_run = _max_consecutive_blank_run(lines)
    if max_run >= 3:
        return True
    gap_count = sum(1 for line in lines if not line.strip())
    # Pairs of <br> between lines plus stanza runs in large scrapes
    return max_run >= 2 and gap_count >= 8


def normalize_official_br_paragraph_gaps(lines: list[str]) -> list[str]:
    """Pair &lt;br&gt; = line break; 3+ blanks = stanza gap (prabhatasamgiita.net)."""
    out: list[str] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        if line.strip():
            out.append(line)
            index += 1
            continue
        blank_run = 0
        while index + blank_run < len(lines) and not lines[index + blank_run].strip():
            blank_run += 1
        if blank_run >= 3:
            if out and out[-1].strip():
                out.append("")
        index += blank_run
    return out


def _has_preserved_stanza_gaps(lines: list[str]) -> bool:
    return any(not line.strip() for line in lines)


def _find_best_repeating_pair(lines: list[str]) -> tuple[str, str] | None:
    counts: dict[str, int] = {}
    for index in range(len(lines) - 1):
        left = lines[index].strip()
        right = lines[index + 1].strip()
        if not left or not right:
            continue
        key = f"{left}\x00{right}"
        counts[key] = counts.get(key, 0) + 1
    best: tuple[str, str] | None = None
    best_count = 0
    for key, count in counts.items():
        if count < 2 or count <= best_count:
            continue
        split_at = key.index("\x00")
        best = (key[:split_at], key[split_at + 1 :])
        best_count = count
    return best


def _insert_blanks_before_repeating_pair(
    lines: list[str], pair: tuple[str, str]
) -> list[str]:
    left, right = pair
    seen_first = False
    out: list[str] = []
    for index, line in enumerate(lines):
        is_pair_start = (
            line.strip() == left
            and index + 1 < len(lines)
            and lines[index + 1].strip() == right
        )
        if is_pair_start and seen_first and out and out[-1].strip():
            out.append("")
        if is_pair_start:
            seen_first = True
        out.append(line)
    return out


def _insert_blanks_before_refrain_line(lines: list[str], refrain: str) -> list[str]:
    out: list[str] = []
    for index, line in enumerate(lines):
        trimmed = line.strip()
        if (
            index > 0
            and trimmed
            and trimmed == refrain
            and out
            and out[-1].strip()
            and out[-1].strip() != refrain
        ):
            out.append("")
        out.append(line)
    return out


def infer_stanza_blank_lines(lines: list[str]) -> list[str]:
    if len(lines) < 3:
        return list(lines)
    if _has_preserved_stanza_gaps(lines):
        return list(lines)
    pair = _find_best_repeating_pair(lines)
    if pair:
        with_pair = _insert_blanks_before_repeating_pair(lines, pair)
        if any(not line.strip() for line in with_pair):
            return with_pair
    refrain = next((line.strip() for line in lines if line.strip()), "")
    if refrain:
        return _insert_blanks_before_refrain_line(lines, refrain)
    return list(lines)


_DEVANAGARI_LANGUAGE_HEADERS: frozenset[str] = frozenset(
    {
        "संस्कृत",
        "संस्क्र्त",
        "हिन्दी",
        "हिंदी",
        "बंगला",
        "बन्ग्ला",
        "मैथिली",
        "उर्दू",
        "अंगिका",
        "मगही",
    }
)


def _devanagari_header_token(line: str) -> str:
    return (line or "").strip().rstrip(":：").strip()


def is_devanagari_language_header_line(line: str) -> bool:
    token = _devanagari_header_token(line)
    if not token or len(token) > 48:
        return False
    if token in _DEVANAGARI_LANGUAGE_HEADERS:
        return True
    return is_catalog_language_label_line(token, None, [])


def devanagari_content_lines(
    devanagari: str,
    *,
    language: str | None = None,
    language_labels: list[str] | None = None,
) -> list[str]:
    lines = [
        line
        for line in devanagari.split("\n")
        if line.strip() and not is_corrupt_lyric_padding_line(line)
    ]
    while lines and (
        is_catalog_language_label_line(lines[0], language, language_labels)
        or is_devanagari_language_header_line(lines[0])
    ):
        lines.pop(0)
    return lines


def _align_devanagari_by_roman_stanzas(
    roman_lines: list[str], dev_content: list[str]
) -> str:
    """Walk Roman (with stanza blanks); emit Devanagari lines in order, reusing Roman gaps."""
    out: list[str] = []
    dev_index = 0
    for roman_line in roman_lines:
        if not roman_line.strip():
            if out and out[-1].strip():
                out.append("")
            continue
        if dev_index < len(dev_content):
            out.append(dev_content[dev_index])
            dev_index += 1
    return "\n".join(out).strip()


def _is_devanagari_non_lyric_line(
    line: str,
    *,
    language: str | None = None,
    language_labels: list[str] | None = None,
) -> bool:
    text = (line or "").strip()
    if not text:
        return False
    if looks_like_converted_theme_line(text) or is_english_theme_line(text):
        return True
    if is_catalog_language_label_line(text, language, language_labels):
        return True
    return is_devanagari_language_header_line(text)


def sanitize_devanagari_catalog_text(
    devanagari: str | None,
    *,
    roman: str | None = None,
    language: str | None = None,
    language_labels: list[str] | None = None,
    known_theme: str | None = None,
) -> str:
    """Drop language headers, themes, and scrape padding from rule-converted Devanagari."""
    raw_dev = devanagari or ""
    if not raw_dev.strip():
        return ""
    ends_with_newline = raw_dev.endswith("\n")
    lines = [
        line
        for line in raw_dev.split("\n")
        if not is_corrupt_lyric_padding_line(line)
    ]
    while lines and lines[0].strip() and _is_devanagari_non_lyric_line(
        lines[0], language=language, language_labels=language_labels
    ):
        lines.pop(0)
        while lines and not lines[0].strip():
            lines.pop(0)
    lines = [
        line
        for line in lines
        if not line.strip()
        or not _is_devanagari_non_lyric_line(
            line, language=language, language_labels=language_labels
        )
    ]
    collapsed: list[str] = []
    for line in lines:
        if not line.strip() and collapsed and not collapsed[-1].strip():
            continue
        collapsed.append(line)
    cleaned = "\n".join(collapsed).strip()
    if not cleaned:
        return ""
    peeled = strip_trailing_theme_from_devanagari(
        roman, cleaned, known_theme=known_theme
    )
    cleaned = (peeled or "").strip()
    if not cleaned:
        return ""
    if ends_with_newline:
        cleaned += "\n"
    return cleaned


def align_devanagari_stanza_gaps(
    roman_with_gaps: str,
    devanagari: str,
    *,
    language: str | None = None,
    language_labels: list[str] | None = None,
) -> str:
    roman_lines = roman_with_gaps.split("\n")
    dev_content = devanagari_content_lines(
        devanagari, language=language, language_labels=language_labels
    )
    if not dev_content:
        return ""
    roman_content_count = len([line for line in roman_lines if line.strip()])
    has_roman_stanza_gaps = any(not line.strip() for line in roman_lines)
    if len(dev_content) == roman_content_count:
        out: list[str] = []
        dev_index = 0
        for roman_line in roman_lines:
            if not roman_line.strip():
                out.append("")
                continue
            out.append(dev_content[dev_index])
            dev_index += 1
        return "\n".join(out).strip()
    if has_roman_stanza_gaps and len(dev_content) <= roman_content_count:
        return _align_devanagari_by_roman_stanzas(roman_lines, dev_content)
    return "\n".join(infer_stanza_blank_lines(dev_content)).strip()


def sanitize_catalog_lyrics_text(
    lyrics: str | None,
    *,
    language: str | None = None,
    language_labels: list[str] | None = None,
) -> str:
    if not (lyrics or "").strip():
        return ""
    text = lyrics or ""
    ends_with_newline = text.endswith("\n")
    lines = [line for line in text.split("\n") if not is_corrupt_lyric_padding_line(line)]
    while lines and lines[0].strip() and is_catalog_language_label_line(
        lines[0], language, language_labels
    ):
        lines.pop(0)
        while lines and not lines[0].strip():
            lines.pop(0)
    lines = [line for line in lines if not line.strip() or not is_english_theme_line(line)]
    if _needs_official_br_normalization(lines):
        lines = normalize_official_br_paragraph_gaps(lines)
    elif any(not line.strip() for line in lines):
        lines = list(lines)
    else:
        lines = infer_stanza_blank_lines(lines)
    collapsed: list[str] = []
    for line in lines:
        if not line.strip() and collapsed and not collapsed[-1].strip():
            continue
        collapsed.append(line)
    cleaned = "\n".join(collapsed).strip()
    if not cleaned:
        return ""
    if ends_with_newline:
        cleaned += "\n"
    return cleaned


def language_labels_from_metadata(metadata: dict[str, Any] | None) -> list[str]:
    meta = metadata or {}
    labels: list[str] = []
    assignment = meta.get("canonical_theme_assignments")
    if isinstance(assignment, dict):
        languages = assignment.get("languages")
        if isinstance(languages, list):
            labels.extend(str(item) for item in languages if isinstance(item, str))
    category = meta.get("category")
    if isinstance(category, str) and category.strip():
        labels.append(category.strip())
    return labels


def resolve_catalog_song_heading(
    *,
    title: str | None,
    first_line: str | None,
    lyrics: str | None,
    language: str | None,
    language_labels: list[str],
) -> tuple[str, str] | None:
    first_lyric = next((line.strip() for line in (lyrics or "").split("\n") if line.strip()), "")
    if not first_lyric:
        return None
    title_bad = (
        not (title or "").strip()
        or is_corrupt_lyric_padding_line(title or "")
        or is_catalog_language_label_line(title or "", language, language_labels)
    )
    first_bad = not (first_line or "").strip() or is_corrupt_lyric_padding_line(
        first_line or ""
    ) or is_catalog_language_label_line(first_line or "", language, language_labels)
    if not title_bad and not first_bad:
        return None
    return first_lyric, first_lyric


def prepare_catalog_lyrics_fields(row: dict[str, Any]) -> dict[str, Any]:
    language_labels = language_labels_from_metadata(row.get("metadata_json"))
    raw = row.get("lyrics_original") or ""
    without_theme, theme = extract_trailing_english_theme(raw if isinstance(raw, str) else None)
    lyrics = sanitize_catalog_lyrics_text(
        without_theme,
        language=row.get("language") if isinstance(row.get("language"), str) else None,
        language_labels=language_labels,
    )
    heading = resolve_catalog_song_heading(
        title=row.get("title") if isinstance(row.get("title"), str) else None,
        first_line=row.get("first_line") if isinstance(row.get("first_line"), str) else None,
        lyrics=lyrics,
        language=row.get("language") if isinstance(row.get("language"), str) else None,
        language_labels=language_labels,
    )
    updates: dict[str, Any] = {"lyrics_original": lyrics or None, "peeled_theme": theme}
    if heading:
        updates["title"] = heading[0]
        updates["first_line"] = heading[1]
    return updates