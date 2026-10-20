from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.cache import AsyncTTLCache
from app.models import Song
from app.services.ai import select_provider
from app.services.google_translate import google_translate_configured, translate_texts
from app.services.meaning_translation import (
    audit_meaning_translation,
    build_central_idea_summary_prompt,
    build_localization_prompt,
    build_meaning_translation_prompt,
    pick_meaning_source,
    refine_meaning_translation,
)
from app.services.prose_normalize import normalize_prose_block
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
    # official | generated — how localized_explanation was produced
    explanation_kind: str | None = None
    provider: str | None = None


translation_cache: AsyncTTLCache[dict[str, object]] = AsyncTTLCache(
    ttl_seconds=86400,
    maxsize=512,
)
LOCALIZATION_PROMPT_VERSION = 7


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
        if not isinstance(value, str):
            return None
        cleaned = normalize_prose_block(value)
        return cleaned or None

    def _stored_explanation(self, song: Song, language_code: str) -> str | None:
        meta = song.metadata_json if isinstance(song.metadata_json, dict) else {}
        explanations = meta.get("localized_explanations")
        if not isinstance(explanations, dict):
            return None
        value = explanations.get(language_code)
        if not isinstance(value, str) or not value.strip():
            return None
        return normalize_prose_block(value) or None

    def _usable_localized_meaning(
        self,
        song: Song,
        language: str,
        candidate: str | None,
    ) -> str | None:
        """Keep only meanings that match the target language (reject English echoes)."""
        text = normalize_prose_block(candidate or "")
        if not text:
            return None
        english = normalize_prose_block(song.english_meaning or "")
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

    async def _translate_with_google(
        self,
        song: Song,
        language_code: str,
        explanation: str | None,
    ) -> LocalizedSongText | None:
        if not google_translate_configured():
            return None
        # Match the official site: translate from English meaning / central idea.
        # Unwrap soft line-breaks first so Google does not preserve catalog wrap artifacts.
        english = normalize_prose_block(song.english_meaning or "")
        if not english:
            return None
        meaning_source = english
        explanation_source = normalize_prose_block(explanation or "") or None
        texts = [meaning_source]
        if explanation_source and explanation_source != meaning_source:
            texts.append(explanation_source)

        translated = await translate_texts(
            texts,
            target_language=language_code,
            source_language="en",
        )
        if not translated:
            return None

        draft_meaning = translated[0].strip() if translated else ""
        meaning = self._usable_localized_meaning(song, language_code, draft_meaning)
        if meaning is None:
            return None

        localized_explanation: str | None = None
        if len(translated) > 1 and translated[1].strip():
            localized_explanation = self._usable_localized_explanation(
                song, translated[1], explanation_source
            )
        elif explanation_source and explanation_source == meaning_source:
            localized_explanation = meaning

        return LocalizedSongText(
            language=language_display_name(language_code),
            localized_title=song.title,
            localized_first_line=song.first_line,
            localized_meaning=meaning,
            localized_explanation=localized_explanation,
            explanation_kind="official" if localized_explanation and explanation_source else None,
            provider="google",
        )

    async def _persist_localized(
        self,
        session: AsyncSession | None,
        song: Song,
        language_code: str,
        result: LocalizedSongText,
    ) -> None:
        if session is None:
            return
        if not result.localized_meaning and not result.localized_explanation:
            return
        try:
            db_song = (
                await session.execute(select(Song).where(Song.number == song.number))
            ).scalar_one_or_none()
            if db_song is None:
                return
            meta = dict(db_song.metadata_json or {})
            if result.localized_meaning and result.localized_meaning.strip():
                meanings = dict(meta.get("localized_meanings") or {})
                meanings[language_code] = result.localized_meaning.strip()
                meta["localized_meanings"] = meanings
            if result.localized_explanation and result.localized_explanation.strip():
                explanations = dict(meta.get("localized_explanations") or {})
                explanations[language_code] = result.localized_explanation.strip()
                meta["localized_explanations"] = explanations
                if result.explanation_kind:
                    kinds = dict(meta.get("localized_explanation_kinds") or {})
                    kinds[language_code] = result.explanation_kind
                    meta["localized_explanation_kinds"] = kinds
            meta["localized_provider"] = {
                **dict(meta.get("localized_provider") or {}),
                language_code: result.provider or "llm",
            }
            db_song.metadata_json = meta
            db_song.updated_at = datetime.now(UTC)
            await session.commit()

            # Keep this request's song object aligned. Other replicas already merge
            # localized_* from Neon in CatalogService.get_song — skip a full catalog
            # refresh so language switches are not blocked on re-index work.
            song.metadata_json = dict(meta)
        except Exception:
            logger.exception(
                "Failed to persist localized meaning for song %s (%s)",
                song.number,
                language_code,
            )
            try:
                await session.rollback()
            except Exception:
                pass

    async def _localize_with_llm(
        self,
        song: Song,
        normalized: str,
        language_code: str,
        display_language: str,
        explanation: str | None,
    ) -> LocalizedSongText:
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
                return LocalizedSongText(
                    language=display_language,
                    localized_title=self._text(payload, "localized_title"),
                    localized_first_line=self._text(payload, "localized_first_line"),
                    localized_meaning=localized_meaning,
                    localized_explanation=self._text(payload, "localized_explanation"),
                    provider="llm",
                )
        except Exception:
            logger.exception("Localization failed for song %s in %s", song.number, normalized)
            fallback_meaning = await self._translate_meaning_fallback(song, normalized)
            return LocalizedSongText(
                language=display_language,
                localized_title=song.title,
                localized_first_line=song.first_line,
                localized_meaning=fallback_meaning,
                localized_explanation=explanation or None,
                provider="llm" if fallback_meaning else None,
            )

    def _usable_localized_explanation(
        self,
        song: Song,
        candidate: str | None,
        explanation_source: str | None,
    ) -> str | None:
        text = normalize_prose_block(candidate or "") or None
        if not text:
            return None
        source = normalize_prose_block(explanation_source or "") or None
        if source and text == source:
            return None
        # Reject old bad cache that mirrored the meaning as "Central idea".
        meaning_en = normalize_prose_block(song.english_meaning or "") or None
        meaning_hi = normalize_prose_block(song.hindi_meaning or "") or None
        if meaning_en and text == meaning_en:
            return None
        if meaning_hi and text == meaning_hi:
            return None
        return text

    async def _translate_explanation_with_google(
        self,
        song: Song,
        language_code: str,
        explanation: str | None,
    ) -> str | None:
        if not google_translate_configured():
            return None
        explanation_source = normalize_prose_block(explanation or "") or None
        if not explanation_source:
            return None
        translated = await translate_texts(
            [explanation_source],
            target_language=language_code,
            source_language="en",
        )
        if not translated or not translated[0].strip():
            return None
        return self._usable_localized_explanation(song, translated[0], explanation_source)

    async def _generate_central_idea_summary(
        self,
        song: Song,
        language: str,
        language_code: str,
    ) -> str | None:
        """LLM plain-language Central idea when the catalog has no official purport."""
        try:
            prompt = build_central_idea_summary_prompt(song, language)
        except ValueError:
            return None
        try:
            async with asyncio.timeout(55):
                draft = (await self.provider.complete(prompt)).strip()
        except Exception:
            logger.exception(
                "Central idea summary failed for song %s in %s",
                song.number,
                language,
            )
            return None
        return self._usable_localized_explanation(song, draft, explanation_source=None)

    async def _ensure_central_idea(
        self,
        song: Song,
        *,
        language: str,
        language_code: str,
        explanation_source: str | None,
        localized_explanation: str | None,
        session: AsyncSession | None,
        meaning: str | None,
        title: str | None,
        first_line: str | None,
        provider: str | None,
    ) -> tuple[str | None, str | None, str | None]:
        """Return (explanation, explanation_kind, provider)."""
        existing = self._usable_localized_explanation(
            song, localized_explanation, explanation_source
        )
        if existing:
            kind = "official" if explanation_source else "generated"
            return existing, kind, provider

        if explanation_source:
            translated = await self._translate_explanation_with_google(
                song, language_code, explanation_source
            )
            if translated:
                await self._persist_localized(
                    session,
                    song,
                    language_code,
                    LocalizedSongText(
                        language=language_display_name(language),
                        localized_title=title,
                        localized_first_line=first_line,
                        localized_meaning=meaning,
                        localized_explanation=translated,
                        explanation_kind="official",
                        provider="google",
                    ),
                )
                return translated, "official", "google"

        generated = await self._generate_central_idea_summary(song, language, language_code)
        if generated:
            await self._persist_localized(
                session,
                song,
                language_code,
                LocalizedSongText(
                    language=language_display_name(language),
                    localized_title=title,
                    localized_first_line=first_line,
                    localized_meaning=meaning,
                    localized_explanation=generated,
                    explanation_kind="generated",
                    provider="llm",
                ),
            )
            return generated, "generated", "llm"
        return None, None, provider

    async def localize(
        self,
        song: Song,
        language: str,
        explanation: str | None = None,
        session: AsyncSession | None = None,
    ) -> LocalizedSongText:
        normalized = language.strip()
        language_code = normalize_language_code(normalized) or normalized.casefold()
        display_language = language_display_name(normalized)
        explanation_source = normalize_prose_block(explanation or "") or None
        stored_meaning = stored_meaning_for_language(song, normalized)
        if stored_meaning:
            stored_meaning = normalize_prose_block(stored_meaning) or stored_meaning
        stored_explanation = self._usable_localized_explanation(
            song,
            self._stored_explanation(song, language_code),
            explanation_source,
        )
        if stored_meaning:
            expl, kind, provider = await self._ensure_central_idea(
                song,
                language=normalized,
                language_code=language_code,
                explanation_source=explanation_source,
                localized_explanation=stored_explanation,
                session=session,
                meaning=stored_meaning,
                title=song.title,
                first_line=song.first_line,
                provider="stored",
            )
            return LocalizedSongText(
                language=display_language,
                localized_title=song.title,
                localized_first_line=song.first_line,
                localized_meaning=stored_meaning,
                localized_explanation=expl,
                explanation_kind=kind,
                provider=provider,
            )

        cached = await translation_cache.get(self._cache_key(song, language_code))
        if isinstance(cached, dict) and not cached.get("fallback_error"):
            cached_explanation = self._usable_localized_explanation(
                song,
                self._text(cached, "localized_explanation"),
                explanation_source,
            )
            expl, kind, provider = await self._ensure_central_idea(
                song,
                language=normalized,
                language_code=language_code,
                explanation_source=explanation_source,
                localized_explanation=cached_explanation,
                session=session,
                meaning=self._text(cached, "localized_meaning"),
                title=self._text(cached, "localized_title") or song.title,
                first_line=self._text(cached, "localized_first_line") or song.first_line,
                provider=str(cached.get("provider") or "cache"),
            )
            return LocalizedSongText(
                language=str(cached.get("language", display_language)),
                localized_title=self._text(cached, "localized_title"),
                localized_first_line=self._text(cached, "localized_first_line"),
                localized_meaning=self._text(cached, "localized_meaning"),
                localized_explanation=expl,
                explanation_kind=kind,
                provider=provider,
            )

        result = await self._translate_with_google(song, language_code, explanation)
        if result is None:
            result = await self._localize_with_llm(
                song,
                normalized,
                language_code,
                display_language,
                explanation,
            )
            if result.localized_explanation:
                result.localized_explanation = self._usable_localized_explanation(
                    song,
                    result.localized_explanation,
                    explanation_source,
                )

        expl, kind, provider = await self._ensure_central_idea(
            song,
            language=normalized,
            language_code=language_code,
            explanation_source=explanation_source,
            localized_explanation=result.localized_explanation,
            session=session,
            meaning=result.localized_meaning,
            title=result.localized_title,
            first_line=result.localized_first_line,
            provider=result.provider,
        )
        result.localized_explanation = expl
        result.explanation_kind = kind
        result.provider = provider

        if result.localized_meaning:
            await translation_cache.set(
                self._cache_key(song, language_code),
                {
                    "language": result.language,
                    "localized_title": result.localized_title,
                    "localized_first_line": result.localized_first_line,
                    "localized_meaning": result.localized_meaning,
                    "localized_explanation": result.localized_explanation,
                    "explanation_kind": result.explanation_kind,
                    "provider": result.provider or "llm",
                },
            )
            await self._persist_localized(session, song, language_code, result)
        return result
