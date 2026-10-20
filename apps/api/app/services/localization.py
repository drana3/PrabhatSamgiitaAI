from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, cast

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
    format_central_idea_prose,
    pick_meaning_source,
    refine_meaning_translation,
)
from app.services.prose_normalize import is_near_duplicate_prose, normalize_prose_block
from app.services.song_meanings import (
    language_display_name,
    normalize_language_code,
    stored_meaning_for_language,
)

# Schedule Neon persist after the HTTP response (FastAPI BackgroundTasks.add_task).
PersistScheduler = Callable[[int, str, "LocalizedSongText"], None]

logger = logging.getLogger(__name__)

# Bump when the Central idea LLM prompt/format changes so old generated cache refreshes.
CENTRAL_IDEA_SUMMARY_VERSION = 6

CENTRAL_IDEA_SYSTEM_PROMPT = (
    "You write short Central idea / purport prose for Prabhat Samgiita devotees. "
    "The song meaning provided in the user message is canonical source material — "
    "summarize and crystallize it faithfully. Do not refuse for lack of a separate "
    "purport field. Return only the Central idea prose."
)


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
# Fast /localized responses (meaning only — never LLM generate).
localized_response_cache: AsyncTTLCache[dict[str, object]] = AsyncTTLCache(
    ttl_seconds=600,
    maxsize=1024,
)
LOCALIZATION_PROMPT_VERSION = 7


class LocalizationService:
    def __init__(self) -> None:
        self.provider = select_provider(get_settings())

    @staticmethod
    async def persist_localized_detached(
        song_number: int,
        language_code: str,
        result: LocalizedSongText,
    ) -> None:
        """Write localized_* into Neon using a fresh session (post-response)."""
        if not result.localized_meaning and not result.localized_explanation:
            return
        from app.core.db import SessionLocal

        try:
            async with SessionLocal() as session:
                db_song = (
                    await session.execute(select(Song).where(Song.number == song_number))
                ).scalar_one_or_none()
                if db_song is None:
                    return
                meta = LocalizationService._merge_localized_metadata(
                    dict(db_song.metadata_json or {}),
                    language_code,
                    result,
                )
                db_song.metadata_json = meta
                db_song.updated_at = datetime.now(UTC)
                await session.commit()
        except Exception:
            logger.exception(
                "Background persist failed for song %s (%s)",
                song_number,
                language_code,
            )

    @staticmethod
    def _merge_localized_metadata(
        meta: dict[str, Any],
        language_code: str,
        result: LocalizedSongText,
    ) -> dict[str, Any]:
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
                if result.explanation_kind == "generated":
                    versions = dict(meta.get("localized_explanation_versions") or {})
                    versions[language_code] = CENTRAL_IDEA_SUMMARY_VERSION
                    meta["localized_explanation_versions"] = versions
        meta["localized_provider"] = {
            **dict(meta.get("localized_provider") or {}),
            language_code: result.provider or "llm",
        }
        return meta

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
        kinds = meta.get("localized_explanation_kinds")
        versions = meta.get("localized_explanation_versions")
        if isinstance(kinds, dict) and kinds.get(language_code) == "generated":
            version = 1
            if isinstance(versions, dict) and isinstance(versions.get(language_code), int):
                version = versions[language_code]
            if version < CENTRAL_IDEA_SUMMARY_VERSION:
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
                song,
                translated[1],
                explanation_source,
                language=language_code,
                localized_meaning=meaning,
            )
        # Never use the meaning text itself as Central idea.

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
        *,
        schedule_persist: PersistScheduler | None = None,
    ) -> None:
        if not result.localized_meaning and not result.localized_explanation:
            return
        # Align in-memory song immediately so this request / cache stay consistent.
        song.metadata_json = self._merge_localized_metadata(
            dict(song.metadata_json or {}),
            language_code,
            result,
        )
        if schedule_persist is not None:
            schedule_persist(song.number, language_code, result)
            return
        if session is None:
            return
        try:
            db_song = (
                await session.execute(select(Song).where(Song.number == song.number))
            ).scalar_one_or_none()
            if db_song is None:
                return
            meta = self._merge_localized_metadata(
                dict(db_song.metadata_json or {}),
                language_code,
                result,
            )
            db_song.metadata_json = meta
            db_song.updated_at = datetime.now(UTC)
            await session.commit()
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

    def _meaning_mirrors(self, song: Song, language: str | None = None) -> list[str]:
        mirrors: list[str] = []
        for raw in (song.english_meaning, song.hindi_meaning):
            prose = normalize_prose_block(raw or "")
            if prose:
                mirrors.append(prose)
        if language:
            stored = stored_meaning_for_language(song, language)
            if stored:
                prose = normalize_prose_block(stored)
                if prose:
                    mirrors.append(prose)
        return mirrors

    def _usable_localized_explanation(
        self,
        song: Song,
        candidate: str | None,
        explanation_source: str | None,
        *,
        language: str | None = None,
        localized_meaning: str | None = None,
    ) -> str | None:
        text = normalize_prose_block(candidate or "") or None
        if not text:
            return None
        source = normalize_prose_block(explanation_source or "") or None
        if source and is_near_duplicate_prose(text, source):
            return None
        # Reject only true meaning dumps (very high similarity). Length alone is a
        # bad proxy across languages and caused empty-state UX for Marathi/etc.
        mirrors = self._meaning_mirrors(song, language)
        same_lang = normalize_prose_block(localized_meaning or "") or None
        if same_lang:
            mirrors.append(same_lang)
        for meaning in mirrors:
            if meaning and is_near_duplicate_prose(text, meaning, threshold=0.92):
                return None
        # English only: keep generated Central idea clearly shorter than meaning.
        lang = (language or "").casefold()
        if lang in {"en", "english"}:
            for meaning in mirrors:
                if meaning and len(meaning) >= 160 and len(text) >= int(len(meaning) * 0.9):
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
        return self._usable_localized_explanation(
            song, translated[0], explanation_source, language=language_code
        )

    async def _generate_central_idea_summary(
        self,
        song: Song,
        language: str,
        language_code: str,
        *,
        localized_meaning: str | None = None,
    ) -> str | None:
        """LLM Central idea when the catalog has no official purport — polished + grounded."""
        try:
            prompt = build_central_idea_summary_prompt(song, language)
        except ValueError:
            return None
        try:
            async with asyncio.timeout(95):
                draft = (
                    await self.provider.complete(
                        prompt, system=CENTRAL_IDEA_SYSTEM_PROMPT
                    )
                ).strip()
        except Exception:
            logger.exception(
                "Central idea summary failed for song %s in %s",
                song.number,
                language,
            )
            return None
        formatted = format_central_idea_prose(draft)
        usable = self._usable_localized_explanation(
            song,
            formatted,
            explanation_source=None,
            language=language,
            localized_meaning=localized_meaning,
        )
        if usable:
            return usable
        # One retry when the draft was a meaning mirror or too long for a purport.
        max_chars = 220
        if localized_meaning and len(localized_meaning) >= 120:
            max_chars = max(140, int(len(localized_meaning) * 0.55))
        else:
            for mirror in self._meaning_mirrors(song, language):
                if mirror and len(mirror) >= 120:
                    max_chars = max(140, int(len(mirror) * 0.7))
                    break
        retry_prompt = "\n".join(
            [
                prompt,
                "",
                "CRITICAL REVISION: Your previous draft was too close to the meaning",
                "or too long for a Central idea.",
                f"Rewrite as a SHORT purport — at most {max_chars} characters,",
                "still exactly 2 short paragraphs.",
                "Do NOT reuse whole sentences from the PRIMARY meaning.",
                "Crystallize the longing and the promise into fresh simple words.",
            ]
        )
        try:
            async with asyncio.timeout(75):
                draft2 = (
                    await self.provider.complete(
                        retry_prompt, system=CENTRAL_IDEA_SYSTEM_PROMPT
                    )
                ).strip()
        except Exception:
            logger.exception(
                "Central idea summary retry failed for song %s in %s",
                song.number,
                language,
            )
            return None
        usable2 = self._usable_localized_explanation(
            song,
            format_central_idea_prose(draft2),
            explanation_source=None,
            language=language,
            localized_meaning=localized_meaning,
        )
        if usable2:
            return usable2
        # Last resort: accept a non-empty draft that is not an exact meaning copy.
        # Prefer showing a Central idea over the client empty-state for every language.
        for draft_text in (format_central_idea_prose(draft2), formatted):
            soft = normalize_prose_block(draft_text or "") or None
            if not soft or len(soft) < 40:
                continue
            mirrors = self._meaning_mirrors(song, language)
            if localized_meaning:
                mirrors.append(normalize_prose_block(localized_meaning))
            if any(
                m and is_near_duplicate_prose(soft, m, threshold=0.95) for m in mirrors if m
            ):
                continue
            return soft
        return None

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
        generate_missing: bool,
        schedule_persist: PersistScheduler | None = None,
    ) -> tuple[str | None, str | None, str | None]:
        """Return (explanation, explanation_kind, provider).

        Official purport is always translated (Google, fast). LLM generation for
        songs without purport runs only when generate_missing=True so meaning
        responses are not blocked on a slow summary.
        """
        existing = self._usable_localized_explanation(
            song,
            localized_explanation,
            explanation_source,
            language=language,
            localized_meaning=meaning,
        )
        if existing:
            kind = "official" if explanation_source else "generated"
            return existing, kind, provider

        if explanation_source:
            translated = await self._translate_explanation_with_google(
                song, language_code, explanation_source
            )
            translated = self._usable_localized_explanation(
                song,
                translated,
                explanation_source,
                language=language,
                localized_meaning=meaning,
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
                    schedule_persist=schedule_persist,
                )
                return translated, "official", "google"

        if not generate_missing:
            return None, None, provider

        generated = await self._generate_central_idea_summary(
            song,
            language,
            language_code,
            localized_meaning=meaning,
        )
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
                schedule_persist=schedule_persist,
            )
            return generated, "generated", "llm"
        return None, None, provider

    async def localize(
        self,
        song: Song,
        language: str,
        explanation: str | None = None,
        session: AsyncSession | None = None,
        *,
        generate_missing_central_idea: bool = False,
        schedule_persist: PersistScheduler | None = None,
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
            language=normalized,
            localized_meaning=stored_meaning,
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
                generate_missing=generate_missing_central_idea,
                schedule_persist=schedule_persist,
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
            cached_meaning = self._text(cached, "localized_meaning")
            cached_explanation = self._usable_localized_explanation(
                song,
                self._text(cached, "localized_explanation"),
                explanation_source,
                language=normalized,
                localized_meaning=cached_meaning,
            )
            expl, kind, provider = await self._ensure_central_idea(
                song,
                language=normalized,
                language_code=language_code,
                explanation_source=explanation_source,
                localized_explanation=cached_explanation,
                session=session,
                meaning=cached_meaning,
                title=self._text(cached, "localized_title") or song.title,
                first_line=self._text(cached, "localized_first_line") or song.first_line,
                provider=str(cached.get("provider") or "cache"),
                generate_missing=generate_missing_central_idea,
                schedule_persist=schedule_persist,
            )
            return LocalizedSongText(
                language=str(cached.get("language", display_language)),
                localized_title=self._text(cached, "localized_title"),
                localized_first_line=self._text(cached, "localized_first_line"),
                localized_meaning=cached_meaning,
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
                    language=normalized,
                    localized_meaning=result.localized_meaning,
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
            generate_missing=generate_missing_central_idea,
            schedule_persist=schedule_persist,
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
            await self._persist_localized(
                session,
                song,
                language_code,
                result,
                schedule_persist=schedule_persist,
            )
        return result
