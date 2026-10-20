"""Google Cloud Translation (Basic v2) with monthly character quota.

Uses the REST translate API when ``GOOGLE_TRANSLATE_API_KEY`` is set.
Tracks characters in a local JSON file so we can stop before the free tier
(~500k chars/month) and fall back to the LLM localizer.
"""

from __future__ import annotations

import json
import logging
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2"

# Our catalog codes → Google Translate target codes (omit = unsupported → LLM).
GOOGLE_TARGET_CODES: dict[str, str] = {
    "hi": "hi",
    "bn": "bn",
    "ta": "ta",
    "ur": "ur",
    "as": "as",
    "gu": "gu",
    "kn": "kn",
    "ml": "ml",
    "mr": "mr",
    "ne": "ne",
    "or": "or",
    "pa": "pa",
    "sa": "sa",
    "te": "te",
    "ar": "ar",
    "zh": "zh-CN",
    "nl": "nl",
    "fr": "fr",
    "de": "de",
    "id": "id",
    "it": "it",
    "ja": "ja",
    "ko": "ko",
    "fa": "fa",
    "pl": "pl",
    "pt": "pt",
    "ru": "ru",
    "si": "si",
    "es": "es",
    "sw": "sw",
    "th": "th",
    "tr": "tr",
    "vi": "vi",
    # mai / mag: not reliably supported by Cloud Translation — use LLM.
}


def google_target_code(language_code: str) -> str | None:
    return GOOGLE_TARGET_CODES.get(language_code.casefold().strip())


def _month_key(now: datetime | None = None) -> str:
    stamp = now or datetime.now(UTC)
    return f"{stamp.year:04d}-{stamp.month:02d}"


class TranslateQuotaStore:
    """Process-safe monthly character counter persisted to disk."""

    def __init__(self, path: Path, monthly_limit: int) -> None:
        self.path = path
        self.monthly_limit = max(0, int(monthly_limit))
        self._lock = threading.Lock()

    def _read(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"month": _month_key(), "characters": 0}
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {"month": _month_key(), "characters": 0}
        month = str(payload.get("month") or "")
        chars = int(payload.get("characters") or 0)
        if month != _month_key():
            return {"month": _month_key(), "characters": 0}
        return {"month": month, "characters": max(0, chars)}

    def _write(self, payload: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        tmp.replace(self.path)

    def used(self) -> int:
        with self._lock:
            return int(self._read()["characters"])

    def remaining(self) -> int:
        if self.monthly_limit <= 0:
            return 0
        return max(0, self.monthly_limit - self.used())

    def can_spend(self, characters: int) -> bool:
        if characters <= 0:
            return True
        if self.monthly_limit <= 0:
            return False
        return self.used() + characters <= self.monthly_limit

    def record(self, characters: int) -> int:
        if characters <= 0:
            return self.used()
        with self._lock:
            payload = self._read()
            payload["characters"] = int(payload["characters"]) + int(characters)
            self._write(payload)
            return int(payload["characters"])


_quota_store: TranslateQuotaStore | None = None
_quota_lock = threading.Lock()


def get_quota_store(settings: Settings | None = None) -> TranslateQuotaStore:
    global _quota_store
    cfg = settings or get_settings()
    with _quota_lock:
        if _quota_store is None or _quota_store.path != Path(cfg.google_translate_quota_path):
            _quota_store = TranslateQuotaStore(
                Path(cfg.google_translate_quota_path),
                cfg.google_translate_monthly_char_limit,
            )
        else:
            _quota_store.monthly_limit = cfg.google_translate_monthly_char_limit
        return _quota_store


def reset_quota_store_for_tests() -> None:
    global _quota_store
    with _quota_lock:
        _quota_store = None


def google_translate_configured(settings: Settings | None = None) -> bool:
    cfg = settings or get_settings()
    return bool(cfg.google_translate_enabled and (cfg.google_translate_api_key or "").strip())


def billable_characters(*texts: str | None) -> int:
    return sum(len(text) for text in texts if text)


async def translate_texts(
    texts: list[str],
    *,
    target_language: str,
    source_language: str = "en",
    settings: Settings | None = None,
) -> list[str] | None:
    """Translate one or more strings. Returns None if skipped/failed (caller uses LLM)."""
    cfg = settings or get_settings()
    if not google_translate_configured(cfg):
        return None
    target = google_target_code(target_language)
    if not target:
        return None
    cleaned = [text.strip() for text in texts]
    if not any(cleaned):
        return ["" for _ in texts]

    chars = billable_characters(*cleaned)
    quota = get_quota_store(cfg)
    if not quota.can_spend(chars):
        logger.info(
            "Google Translate quota exhausted (%s/%s); skipping",
            quota.used(),
            quota.monthly_limit,
        )
        return None

    api_key = (cfg.google_translate_api_key or "").strip()
    payload = {
        "q": cleaned,
        "source": source_language,
        "target": target,
        "format": "text",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                TRANSLATE_URL,
                params={"key": api_key},
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
    except Exception:
        logger.exception("Google Translate request failed for target=%s", target)
        return None

    try:
        translations = body["data"]["translations"]
        out = [str(item.get("translatedText") or "").strip() for item in translations]
    except (KeyError, TypeError, IndexError):
        logger.warning("Unexpected Google Translate response shape")
        return None
    if len(out) != len(cleaned):
        logger.warning("Google Translate returned %s rows for %s inputs", len(out), len(cleaned))
        return None

    quota.record(chars)
    return out
