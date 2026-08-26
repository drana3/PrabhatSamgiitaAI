from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import cast

from app.config import get_settings
from app.core.cache import AsyncTTLCache
from app.models import Song
from app.services.ai import select_provider
from app.services.meaning_translation import (
    audit_meaning_translation,
    build_localization_prompt,
    build_meaning_translation_prompt,
    pick_meaning_source,
    refine_meaning_translation,
)
from app.services.song_meanings import (
    language_display_name,
    normalize_language_code,
    stored_meaning_for_language,
)

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class LocalizedSongText:
    language: str
    localized_title: str | None = None
    localized_first_line: str | None = None
    localized_meaning: str | None = None
    localized_explanation: str | None = None


translation_cache: AsyncTTLCache[dict[str, object]] = AsyncTTLCache(
    ttl_seconds=86400,
    maxsize=512,
)
LOCALIZATION_PROMPT_VERSION = 5


class LocalizationService:
    def __init__(self) -> None:
        self.provider = select_provider(get_settings())

    def _cache_key(self, song: Song, language: str) -> str:
        return json.dumps(
            {
                "song_number": song.number,
                "language": language.lower().strip(),
                "prompt_version": LOCALIZATION_PROMPT_VERSION,
            },
            sort_keys=True,
        )

    def _extract_json(self, raw: str) -> dict[str, object]:
        try:
            return cast(dict[str, object], json.loads(raw))
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
            if not match:
                raise
            return cast(dict[str, object], json.loads(match.group(0)))

    def _text(self, payload: dict[str, object], key: str) -> str | None:
        value = payload.get(key)
        return value if isinstance(value, str) else None

    def _usable_localized_meaning(
        self,
        song: Song,
        language: str,
        candidate: str | None,
    ) -> str | None:
        """Keep only meanings that match the target language (reject English echoes)."""
        text = (candidate or "").strip()
        if not text:
            return None
        english = (song.english_meaning or "").strip()
        if english and text == english:
            return None
        audit = audit_meaning_translation(
            pick_meaning_source(song, language)[0] or english or text,
            text,
            language,
        )
        if not audit.passed:
            # Script / language mismatch → treat as unavailable rather than showing English.
            if any("does not appear to match" in issue for issue in audit.issues):
                return None
            if any("Unsupported language" in issue for issue in audit.issues):
                return None
        return text

    async def _translate_meaning_fallback(
        self,
        song: Song,
        language: str,
    ) -> str | None:
        """Second-pass meaning-only translation when the JSON localize path fails quality checks."""
        try:
            prompt = build_meaning_translation_prompt(song, language)
        except ValueError:
            return None
        try:
            async with asyncio.timeout(70):
                draft = (await self.provider.complete(prompt)).strip()
                if not draft:
                    return None
                source_text, source_code = pick_meaning_source(song, language)
                if not source_text:
                    return self._usable_localized_meaning(song, language, draft)
                refined = await refine_meaning_translation(
                    self.provider,
                    song=song,
                    target_language=language,
                    source_text=source_text,
                    source_code=source_code,
                    draft_text=draft,
                )
                return self._usable_localized_meaning(song, language, refined)
        except Exception:
            logger.exception(
                "Meaning fallback translation failed for song %s in %s",
                song.number,
                language,
            )
            return None

    async def localize(
        self,
        song: Song,
        language: str,
        explanation: str | None = None,
    ) -> LocalizedSongText:
        normalized = language.strip()
        language_code = normalize_language_code(normalized) or normalized.casefold()
        display_language = language_display_name(normalized)
        stored_meaning = stored_meaning_for_language(song, normalized)
        if stored_meaning:
            return LocalizedSongText(
                language=display_language,
                localized_title=song.title,
                localized_first_line=song.first_line,
                localized_meaning=stored_meaning,
                localized_explanation=explanation,
            )

        cached = await translation_cache.get(self._cache_key(song, language_code))
        if isinstance(cached, dict) and not cached.get("fallback_error"):
            return LocalizedSongText(
                language=str(cached.get("language", display_language)),
                localized_title=self._text(cached, "localized_title"),
                localized_first_line=self._text(cached, "localized_first_line"),
                localized_meaning=self._text(cached, "localized_meaning"),
                localized_explanation=self._text(cached, "localized_explanation"),
            )

        source_prompt = build_localization_prompt(song, normalized, explanation)
        try:
            async with asyncio.timeout(70):
                raw = await self.provider.complete(source_prompt)
                payload = self._extract_json(raw)
                localized_meaning = self._text(payload, "localized_meaning")
                source_text, source_code = pick_meaning_source(song, normalized)
                if localized_meaning and source_text:
                    localized_meaning = await refine_meaning_translation(
                        self.provider,
                        song=song,
                        target_language=normalized,
                        source_text=source_text,
                        source_code=source_code,
                        draft_text=localized_meaning,
                    )
                localized_meaning = self._usable_localized_meaning(
                    song, normalized, localized_meaning
                )
                if not localized_meaning:
                    localized_meaning = await self._translate_meaning_fallback(song, normalized)
                result = LocalizedSongText(
                    language=display_language,
                    localized_title=self._text(payload, "localized_title"),
                    localized_first_line=self._text(payload, "localized_first_line"),
                    localized_meaning=localized_meaning,
                    localized_explanation=self._text(payload, "localized_explanation"),
                )
        except Exception:
            logger.exception("Localization failed for song %s in %s", song.number, normalized)
            fallback_meaning = await self._translate_meaning_fallback(song, normalized)
            result = LocalizedSongText(
                language=display_language,
                localized_title=song.title,
                localized_first_line=song.first_line,
                localized_meaning=fallback_meaning,
                localized_explanation=explanation or None,
            )
            if not fallback_meaning:
                return result

        await translation_cache.set(
            self._cache_key(song, language_code),
            {
                "language": result.language,
                "localized_title": result.localized_title,
                "localized_first_line": result.localized_first_line,
                "localized_meaning": result.localized_meaning,
                "localized_explanation": result.localized_explanation,
            },
        )
        return result
