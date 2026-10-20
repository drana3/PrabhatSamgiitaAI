"""Google Cloud Translation (Basic v2) with a hard free-tier budget.

Uses the REST translate API when ``GOOGLE_TRANSLATE_API_KEY`` is set.
Character usage is reserved in Neon in *chunks* (leased into process memory)
so most translate calls avoid a Neon round-trip. Replicas still cannot exceed
the free allowance because every lease increments the shared Neon counter.
If quota cannot be reserved durably, Google is skipped and the LLM localizer
is used.

Google's published free NMT allowance is ~500k characters/month. We default to
400k and hard-cap at 450k unless ``GOOGLE_TRANSLATE_ALLOW_PAID=true``.
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
from datetime import UTC, datetime
from pathlib import Path
from time import monotonic
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.services.google_translate_languages import google_target_code

logger = logging.getLogger(__name__)

TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2"
# Stay below Google's ~500k free monthly characters even if env is mis-set.
FREE_TIER_HARD_CAP = 450_000
# Pre-reserve this many characters from Neon per top-up (~10–20 meaning calls).
# Unused lease dies with the process (conservative under-use of free tier).
QUOTA_LEASE_CHUNK = 2_500
# Re-read Neon usage at least this often so other replicas / limit changes
# refresh the in-memory lease without a DB hop on every translate.
QUOTA_LEASE_SYNC_SECONDS = 45 * 60

# Months for which this process already claimed / saw the exhaustion alert.
_alert_claimed_months: set[str] = set()


def _month_key(now: datetime | None = None) -> str:
    stamp = now or datetime.now(UTC)
    return f"{stamp.year:04d}-{stamp.month:02d}"


def quota_resets_at_utc(now: datetime | None = None) -> datetime:
    """Start of next UTC calendar month (when the free-tier counter resets)."""
    stamp = now or datetime.now(UTC)
    if stamp.month == 12:
        return datetime(stamp.year + 1, 1, 1, tzinfo=UTC)
    return datetime(stamp.year, stamp.month + 1, 1, tzinfo=UTC)


def effective_monthly_limit(settings: Settings | None = None) -> int:
    """Characters we will ever send to Google this month (₹0 guard)."""
    cfg = settings or get_settings()
    configured = max(0, int(cfg.google_translate_monthly_char_limit))
    if cfg.google_translate_allow_paid:
        return configured
    return min(configured, FREE_TIER_HARD_CAP)


class TranslateQuotaStore:
    """Process-safe monthly character counter persisted to disk (tests / local)."""

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

    def can_spend(self, characters: int) -> bool:
        if characters <= 0:
            return True
        if self.monthly_limit <= 0:
            return False
        return self.used() + characters <= self.monthly_limit

    def try_reserve(self, characters: int) -> bool:
        """Atomically reserve characters; False if over budget."""
        if characters <= 0:
            return True
        with self._lock:
            payload = self._read()
            used = int(payload["characters"])
            if self.monthly_limit <= 0 or used + characters > self.monthly_limit:
                return False
            payload["characters"] = used + characters
            self._write(payload)
            return True


_quota_store: TranslateQuotaStore | None = None
_quota_lock = threading.Lock()


def get_quota_store(settings: Settings | None = None) -> TranslateQuotaStore:
    global _quota_store
    cfg = settings or get_settings()
    limit = effective_monthly_limit(cfg)
    with _quota_lock:
        if _quota_store is None or _quota_store.path != Path(cfg.google_translate_quota_path):
            _quota_store = TranslateQuotaStore(
                Path(cfg.google_translate_quota_path),
                limit,
            )
        else:
            _quota_store.monthly_limit = limit
        return _quota_store


def google_translate_configured(settings: Settings | None = None) -> bool:
    cfg = settings or get_settings()
    return bool(cfg.google_translate_enabled and (cfg.google_translate_api_key or "").strip())


def billable_characters(*texts: str | None) -> int:
    return sum(len(text) for text in texts if text)


async def _reserve_in_database(characters: int, settings: Settings) -> bool | None:
    """Reserve chars in Neon. True/False = decided; None = DB unavailable.

    Uses INSERT + conditional UPDATE (no SELECT FOR UPDATE) so it works through
    Neon's pooled connections (FOR UPDATE is unreliable with transaction poolers).
    """
    if characters <= 0:
        return True
    limit = effective_monthly_limit(settings)
    if limit <= 0:
        return False
    month = _month_key()
    try:
        from sqlalchemy import text

        from app.core.db import SessionLocal

        async with SessionLocal() as session:
            await session.execute(
                text(
                    """
                    INSERT INTO google_translate_usage (month_key, characters)
                    VALUES (:month, 0)
                    ON CONFLICT (month_key) DO NOTHING
                    """
                ),
                {"month": month},
            )
            result = await session.execute(
                text(
                    """
                    UPDATE google_translate_usage
                    SET characters = characters + :chars,
                        updated_at = NOW()
                    WHERE month_key = :month
                      AND characters + :chars <= :limit
                    RETURNING characters
                    """
                ),
                {"month": month, "chars": characters, "limit": limit},
            )
            row = result.first()
            if row is None:
                await session.rollback()
                return False
            await session.commit()
            return True
    except Exception:
        logger.exception("Google Translate durable quota reserve failed")
        return None


async def _read_usage_from_database(settings: Settings) -> int | None:
    """Current month characters reserved in Neon. None if DB unavailable."""
    month = _month_key()
    try:
        from sqlalchemy import text

        from app.core.db import SessionLocal

        async with SessionLocal() as session:
            result = await session.execute(
                text(
                    """
                    SELECT characters
                    FROM google_translate_usage
                    WHERE month_key = :month
                    """
                ),
                {"month": month},
            )
            row = result.first()
            if row is None:
                return 0
            return max(0, int(row[0] or 0))
    except Exception:
        logger.exception("Google Translate usage read failed")
        return None


class DurableQuotaLease:
    """Process-local lease of characters already reserved in Neon.

    Most ``reserve_characters`` calls debit this lease in memory (no Neon hop).
    When the lease is empty, one Neon UPDATE tops up ``QUOTA_LEASE_CHUNK`` chars
    (or the exact request size when the monthly budget is nearly exhausted).

    Every ``QUOTA_LEASE_SYNC_SECONDS``, usage is re-read from Neon so the lease
    stays aligned with other replicas and the configured monthly limit.
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._month = _month_key()
        self._available = 0
        self._db_topups = 0
        self._sync_reads = 0
        self._last_sync_mono = 0.0
        self._neon_used: int | None = None
        # Once True for the month, skip Google until UTC month rolls (use LLM).
        self._exhausted = False

    def reset(self) -> None:
        self._month = _month_key()
        self._available = 0
        self._db_topups = 0
        self._sync_reads = 0
        self._last_sync_mono = 0.0
        self._neon_used = None
        self._exhausted = False

    @property
    def available(self) -> int:
        return self._available

    @property
    def db_topups(self) -> int:
        return self._db_topups

    @property
    def sync_reads(self) -> int:
        return self._sync_reads

    @property
    def neon_used(self) -> int | None:
        return self._neon_used

    @property
    def exhausted(self) -> bool:
        return self._exhausted

    def mark_exhausted(self) -> None:
        self._exhausted = True
        self._available = 0

    def _roll_month(self) -> None:
        month = _month_key()
        if month != self._month:
            self._month = month
            self._available = 0
            self._neon_used = None
            self._last_sync_mono = 0.0
            self._exhausted = False

    async def _sync_from_neon_if_stale(
        self, settings: Settings, *, force: bool = False
    ) -> None:
        now = monotonic()
        if (
            not force
            and self._last_sync_mono > 0
            and (now - self._last_sync_mono) < QUOTA_LEASE_SYNC_SECONDS
        ):
            return
        used = await _read_usage_from_database(settings)
        if used is None:
            return
        self._last_sync_mono = now
        self._neon_used = used
        self._sync_reads += 1
        limit = effective_monthly_limit(settings)
        # Global budget gone (other replicas / lowered limit) — stop local spend.
        if used >= limit:
            self.mark_exhausted()

    def _remaining_for_topup(self, settings: Settings) -> int | None:
        if self._neon_used is None:
            return None
        return max(0, effective_monthly_limit(settings) - self._neon_used)

    async def reserve(self, characters: int, settings: Settings) -> bool | None:
        """True/False from durable path; None if Neon is unavailable."""
        if characters <= 0:
            return True
        async with self._lock:
            self._roll_month()
            if self._exhausted:
                return False
            await self._sync_from_neon_if_stale(settings)
            if self._exhausted:
                return False

            if characters <= self._available:
                self._available -= characters
                return True

            need_from_db = max(characters - self._available, 0)
            remaining = self._remaining_for_topup(settings)
            if remaining is not None and remaining < need_from_db:
                self.mark_exhausted()
                return False

            # Top up a chunk (capped by Neon remaining when known).
            topup = max(need_from_db, QUOTA_LEASE_CHUNK)
            if remaining is not None:
                topup = min(topup, remaining)
            if topup < need_from_db:
                self.mark_exhausted()
                return False

            decided = await _reserve_in_database(topup, settings)
            if decided is True:
                self._db_topups += 1
                self._available += topup
                self._available -= characters
                if self._neon_used is not None:
                    self._neon_used += topup
                return True
            if decided is False and topup != need_from_db and need_from_db > 0:
                # Chunk would exceed monthly limit — try the exact shortfall.
                decided = await _reserve_in_database(need_from_db, settings)
                if decided is True:
                    self._db_topups += 1
                    self._available += need_from_db
                    self._available -= characters
                    if self._neon_used is not None:
                        self._neon_used += need_from_db
                    return True
            if decided is False:
                self.mark_exhausted()
            return decided


_durable_lease = DurableQuotaLease()


def get_durable_lease() -> DurableQuotaLease:
    return _durable_lease


def reset_quota_store_for_tests() -> None:
    global _quota_store
    with _quota_lock:
        _quota_store = None
    _durable_lease.reset()
    _alert_claimed_months.clear()


async def _claim_quota_alert(settings: Settings) -> bool:
    """Atomically claim the once-per-month admin alert. True = this process sends it."""
    month = _month_key()
    try:
        from sqlalchemy import text

        from app.core.db import SessionLocal

        async with SessionLocal() as session:
            await session.execute(
                text(
                    """
                    INSERT INTO google_translate_usage (month_key, characters)
                    VALUES (:month, 0)
                    ON CONFLICT (month_key) DO NOTHING
                    """
                ),
                {"month": month},
            )
            result = await session.execute(
                text(
                    """
                    UPDATE google_translate_usage
                    SET quota_alert_sent_at = NOW(),
                        updated_at = NOW()
                    WHERE month_key = :month
                      AND quota_alert_sent_at IS NULL
                    RETURNING month_key
                    """
                ),
                {"month": month},
            )
            row = result.first()
            if row is None:
                await session.rollback()
                return False
            await session.commit()
            return True
    except Exception:
        logger.exception("Google Translate quota alert claim failed")
        return False


def _send_quota_exhausted_emails(settings: Settings, *, used: int | None) -> int:
    from app.services.acs_email import send_transactional_email
    from app.services.admin_members import owner_admin_emails

    recipients = sorted(owner_admin_emails(settings))
    if not recipients:
        logger.warning("Google Translate quota exhausted but no admin emails configured")
        return 0

    limit = effective_monthly_limit(settings)
    reset_at = quota_resets_at_utc()
    reset_label = reset_at.strftime("%d %b %Y 00:00 UTC")
    used_label = f"{used:,}" if used is not None else "unknown"
    subject = "Prabhat Samgiita: Google Translate free-tier quota reached"
    plain = (
        "Google Cloud Translation has reached the configured free-tier character "
        f"budget for {_month_key()}.\n\n"
        f"Used: {used_label} / {limit:,} characters\n"
        f"Paid overage: {'allowed' if settings.google_translate_allow_paid else 'blocked'}\n\n"
        "Meaning localization will use the LLM fallback until the monthly counter "
        f"resets at {reset_label}.\n"
    )
    html = (
        "<p>Google Cloud Translation has reached the configured free-tier character "
        f"budget for <strong>{_month_key()}</strong>.</p>"
        f"<p>Used: <strong>{used_label}</strong> / <strong>{limit:,}</strong> characters</p>"
        f"<p>Paid overage: <strong>"
        f"{'allowed' if settings.google_translate_allow_paid else 'blocked'}"
        "</strong></p>"
        "<p>Meaning localization will use the <strong>LLM fallback</strong> until "
        f"the monthly counter resets at <strong>{reset_label}</strong>.</p>"
    )
    sent = 0
    for address in recipients:
        if send_transactional_email(
            to_address=address,
            subject=subject,
            plain_text=plain,
            html_body=html,
        ):
            sent += 1
    return sent


async def maybe_alert_quota_exhausted(settings: Settings | None = None) -> bool:
    """Email admins once per month when Google free-tier budget is exhausted.

    Returns True if this process sent (or attempted) the alert.
    """
    cfg = settings or get_settings()
    month = _month_key()
    if month in _alert_claimed_months:
        return False

    # File-backed test path: claim in-process only.
    if cfg.app_env == "test":
        if month in _alert_claimed_months:
            return False
        _alert_claimed_months.add(month)
        _send_quota_exhausted_emails(cfg, used=get_quota_store(cfg).used())
        return True

    claimed = await _claim_quota_alert(cfg)
    if not claimed:
        _alert_claimed_months.add(month)
        return False
    _alert_claimed_months.add(month)
    usage: int | None = _durable_lease.neon_used
    if usage is None:
        usage = await _read_usage_from_database(cfg)
    sent = _send_quota_exhausted_emails(cfg, used=usage)
    logger.warning(
        "Google Translate quota exhausted for %s; admin alert recipients_sent=%s; "
        "LLM fallback until %s",
        month,
        sent,
        quota_resets_at_utc().isoformat(),
    )
    return True


async def reserve_characters(characters: int, settings: Settings | None = None) -> bool:
    """Reserve budget before calling Google. Fail closed when unpaid mode cannot track usage.

    Production uses an in-memory lease topped up from Neon in chunks so most
    calls skip the database. Tests use the file-backed store only.
    When the monthly budget is exhausted, Google stays off until UTC month reset
    and callers fall back to the LLM localizer.
    """
    cfg = settings or get_settings()
    limit = effective_monthly_limit(cfg)
    if characters <= 0:
        return True
    if limit <= 0:
        return False

    # Unit tests / local without DB: file-backed store.
    if cfg.app_env == "test":
        return get_quota_store(cfg).try_reserve(characters)

    reserved = await _durable_lease.reserve(characters, cfg)
    if reserved is True:
        # Mirror into local file for ops visibility when the volume is writable.
        try:
            get_quota_store(cfg).try_reserve(characters)
        except Exception:
            pass
        return True
    if reserved is False:
        return False

    # DB unavailable: never call Google in unpaid mode (could exceed free tier).
    if not cfg.google_translate_allow_paid:
        logger.warning(
            "Skipping Google Translate: cannot confirm free-tier budget in database"
        )
        return False
    return get_quota_store(cfg).try_reserve(characters)


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
    if not await reserve_characters(chars, cfg):
        logger.info(
            "Google Translate skipped (free-tier budget); LLM fallback until %s; limit=%s",
            quota_resets_at_utc().isoformat(),
            effective_monthly_limit(cfg),
        )
        await maybe_alert_quota_exhausted(cfg)
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
        # Keep the reservation (conservative) so retries cannot burn free tier.
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

    return out
