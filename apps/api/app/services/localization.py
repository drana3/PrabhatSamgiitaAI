from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import cast

from app.config import get_settings
from app.core.cache import AsyncTTLCache
from app.models import Song
from app.services.ai import select_provider

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


class LocalizationService:
    def __init__(self) -> None:
        self.provider = select_provider(get_settings())

    def _cache_key(self, song: Song, language: str) -> str:
        return json.dumps(
            {"song_number": song.number, "language": language.lower().strip()},
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
        cached = await translation_cache.get(self._cache_key(song, normalized))
        if isinstance(cached, dict):
            return LocalizedSongText(
                language=str(cached.get("language", normalized)),
                localized_title=self._text(cached, "localized_title"),
                localized_first_line=self._text(cached, "localized_first_line"),
                localized_meaning=self._text(cached, "localized_meaning"),
                localized_explanation=self._text(cached, "localized_explanation"),
            )

        source_prompt = "\n".join(
            part
            for part in (
                f"Song number: {song.number}",
                f"Title: {song.title}",
                f"First line: {song.first_line or ''}",
                f"English meaning: {song.english_meaning or ''}",
                f"Hindi meaning: {song.hindi_meaning or ''}",
                f"Grounded explanation: {explanation or ''}",
            )
            if part.strip()
        )
        prompt = "\n".join(
            [
                f"You translate Prabhat Samgiita content into {normalized}.",
                "Preserve the devotional meaning and tone.",
                "Do not add facts or interpret beyond the source.",
                "Keep the original song title and first line if translation feels unnatural.",
                "Return only valid JSON with these keys:",
                "localized_title, localized_first_line, localized_meaning, localized_explanation",
                "If a field cannot be translated cleanly, keep it as a faithful paraphrase.",
                "Source text:",
                source_prompt,
            ]
        )
        try:
            raw = await self.provider.complete(prompt)
            payload = self._extract_json(raw)
            result = LocalizedSongText(
                language=normalized,
                localized_title=self._text(payload, "localized_title"),
                localized_first_line=self._text(payload, "localized_first_line"),
                localized_meaning=self._text(payload, "localized_meaning"),
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
