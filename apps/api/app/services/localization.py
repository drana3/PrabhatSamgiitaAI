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
    build_localization_prompt,
    pick_meaning_source,
    refine_meaning_translation,
)
from app.services.song_meanings import language_display_name, stored_meaning_for_language

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
LOCALIZATION_PROMPT_VERSION = 3


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

    async def localize(
        self,
        song: Song,
        language: str,
        explanation: str | None = None,
    ) -> LocalizedSongText:
        normalized = language.strip()
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

        cached = await translation_cache.get(self._cache_key(song, normalized))
        if isinstance(cached, dict):
            return LocalizedSongText(
                language=str(cached.get("language", normalized)),
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
                result = LocalizedSongText(
                    language=normalized,
                    localized_title=self._text(payload, "localized_title"),
                    localized_first_line=self._text(payload, "localized_first_line"),
                    localized_meaning=localized_meaning,
                    localized_explanation=self._text(payload, "localized_explanation"),
                )
        except Exception as exc:
            logger.exception("Localization failed for song %s in %s", song.number, normalized)
            result = LocalizedSongText(
                language=normalized,
                localized_title=song.title,
                localized_first_line=song.first_line,
                localized_meaning=song.english_meaning or song.hindi_meaning,
                localized_explanation=explanation or None,
            )
            await translation_cache.set(
                self._cache_key(song, normalized),
                {
                    "language": result.language,
                    "localized_title": result.localized_title,
                    "localized_first_line": result.localized_first_line,
                    "localized_meaning": result.localized_meaning,
                    "localized_explanation": result.localized_explanation,
                    "fallback_error": str(exc),
                },
            )
            return result

        await translation_cache.set(
            self._cache_key(song, normalized),
            {
                "language": result.language,
                "localized_title": result.localized_title,
                "localized_first_line": result.localized_first_line,
                "localized_meaning": result.localized_meaning,
                "localized_explanation": result.localized_explanation,
            },
        )
        return result
