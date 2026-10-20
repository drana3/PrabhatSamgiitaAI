"""Google Translate free-tier quota + localization provider switch."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.config import Settings
from app.models import Song
from app.services import google_translate as gt
from app.services.localization import (
    LocalizationService,
    localized_response_cache,
    translation_cache,
)


@pytest.fixture(autouse=True)
def _reset_quota(tmp_path: Path):
    gt.reset_quota_store_for_tests()
    yield
    gt.reset_quota_store_for_tests()


def test_effective_limit_hard_caps_unpaid() -> None:
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://test:test@localhost/test",
        GOOGLE_TRANSLATE_MONTHLY_CHAR_LIMIT=999_999,
        GOOGLE_TRANSLATE_ALLOW_PAID=False,
    )
    assert gt.effective_monthly_limit(settings) == gt.FREE_TIER_HARD_CAP


def test_effective_limit_allows_paid_when_flag_set() -> None:
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://test:test@localhost/test",
        GOOGLE_TRANSLATE_MONTHLY_CHAR_LIMIT=900_000,
        GOOGLE_TRANSLATE_ALLOW_PAID=True,
    )
    assert gt.effective_monthly_limit(settings) == 900_000


def test_quota_store_blocks_over_limit(tmp_path: Path) -> None:
    path = tmp_path / "quota.json"
    store = gt.TranslateQuotaStore(path, monthly_limit=100)
    assert store.try_reserve(90)
    assert store.try_reserve(10)
    assert not store.try_reserve(1)
    assert store.used() == 100


@pytest.mark.asyncio
async def test_translate_texts_records_quota(tmp_path: Path) -> None:
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://test:test@localhost/test",
        APP_ENV="test",
        GOOGLE_TRANSLATE_API_KEY="test-key",
        GOOGLE_TRANSLATE_ENABLED=True,
        GOOGLE_TRANSLATE_MONTHLY_CHAR_LIMIT=500_000,
        GOOGLE_TRANSLATE_ALLOW_PAID=False,
        GOOGLE_TRANSLATE_QUOTA_PATH=str(tmp_path / "quota.json"),
    )
    gt.reset_quota_store_for_tests()
    fake = {
        "data": {
            "translations": [
                {"translatedText": "hola"},
                {"translatedText": "mundo"},
            ]
        }
    }

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return fake

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, *args, **kwargs):
            return FakeResponse()

    with patch("app.services.google_translate.httpx.AsyncClient", return_value=FakeClient()):
        out = await gt.translate_texts(
            ["hello", "world"],
            target_language="es",
            settings=settings,
        )
    assert out == ["hola", "mundo"]
    assert gt.get_quota_store(settings).used() == len("hello") + len("world")


@pytest.mark.asyncio
async def test_translate_texts_skips_when_over_quota(tmp_path: Path) -> None:
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://test:test@localhost/test",
        APP_ENV="test",
        GOOGLE_TRANSLATE_API_KEY="test-key",
        GOOGLE_TRANSLATE_ENABLED=True,
        GOOGLE_TRANSLATE_MONTHLY_CHAR_LIMIT=5,
        GOOGLE_TRANSLATE_ALLOW_PAID=False,
        GOOGLE_TRANSLATE_QUOTA_PATH=str(tmp_path / "quota.json"),
    )
    gt.reset_quota_store_for_tests()
    assert gt.get_quota_store(settings).try_reserve(5)
    out = await gt.translate_texts(["too-long"], target_language="hi", settings=settings)
    assert out is None


@pytest.mark.asyncio
async def test_durable_lease_tops_up_once_for_many_reserves(tmp_path: Path) -> None:
    """Most reserves debit memory; Neon is hit once per chunk, not per call."""
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://test:test@localhost/test",
        APP_ENV="production",
        GOOGLE_TRANSLATE_MONTHLY_CHAR_LIMIT=400_000,
        GOOGLE_TRANSLATE_ALLOW_PAID=False,
    )
    gt.reset_quota_store_for_tests()
    lease = gt.get_durable_lease()
    db_calls: list[int] = []

    async def fake_db(characters: int, _settings: Settings) -> bool:
        db_calls.append(characters)
        return True

    with patch("app.services.google_translate._reserve_in_database", new=fake_db):
        for _ in range(8):
            assert await lease.reserve(200, settings) is True

    assert lease.db_topups == 1
    assert db_calls == [gt.QUOTA_LEASE_CHUNK]
    assert lease.available == gt.QUOTA_LEASE_CHUNK - (8 * 200)


@pytest.mark.asyncio
async def test_durable_lease_falls_back_to_exact_when_chunk_blocked(
    tmp_path: Path,
) -> None:
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://test:test@localhost/test",
        APP_ENV="production",
        GOOGLE_TRANSLATE_MONTHLY_CHAR_LIMIT=400_000,
        GOOGLE_TRANSLATE_ALLOW_PAID=False,
    )
    gt.reset_quota_store_for_tests()
    lease = gt.get_durable_lease()
    db_calls: list[int] = []

    async def fake_db(characters: int, _settings: Settings) -> bool:
        db_calls.append(characters)
        # Chunk would exceed remaining monthly budget; exact shortfall fits.
        return characters < gt.QUOTA_LEASE_CHUNK

    with patch("app.services.google_translate._reserve_in_database", new=fake_db):
        assert await lease.reserve(180, settings) is True

    assert db_calls == [gt.QUOTA_LEASE_CHUNK, 180]
    assert lease.available == 0
    assert lease.db_topups == 1


@pytest.mark.asyncio
async def test_localize_uses_google_then_skips_llm(tmp_path: Path) -> None:
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://test:test@localhost/test",
        APP_ENV="test",
        GOOGLE_TRANSLATE_API_KEY="test-key",
        GOOGLE_TRANSLATE_ENABLED=True,
        GOOGLE_TRANSLATE_MONTHLY_CHAR_LIMIT=400_000,
        GOOGLE_TRANSLATE_ALLOW_PAID=False,
        GOOGLE_TRANSLATE_QUOTA_PATH=str(tmp_path / "quota.json"),
    )
    gt.reset_quota_store_for_tests()
    song = Song(
        number=3,
        title="Song 3",
        english_meaning="The crimson dawn has come.",
        metadata_json={},
    )
    service = LocalizationService()
    service.provider = AsyncMock()
    with (
        patch("app.services.localization.get_settings", return_value=settings),
        patch(
            "app.services.localization.translate_texts",
            new=AsyncMock(return_value=["लाल भोर आ गई है।", "केंद्रीय भाव"]),
        ),
        patch("app.services.localization.google_translate_configured", return_value=True),
    ):
        await translation_cache.clear()
        result = await service.localize(
            song,
            "hi",
            explanation="Central idea about neo-humanism.",
        )
    assert result.provider == "google"
    assert result.localized_meaning == "लाल भोर आ गई है।"
    assert result.localized_explanation == "केंद्रीय भाव"
    service.provider.complete.assert_not_called()


@pytest.mark.asyncio
async def test_localize_generates_simple_central_idea_when_purport_missing(tmp_path: Path) -> None:
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://test:test@localhost/test",
        APP_ENV="test",
        GOOGLE_TRANSLATE_API_KEY="test-key",
        GOOGLE_TRANSLATE_ENABLED=True,
        GOOGLE_TRANSLATE_MONTHLY_CHAR_LIMIT=400_000,
        GOOGLE_TRANSLATE_ALLOW_PAID=False,
        GOOGLE_TRANSLATE_QUOTA_PATH=str(tmp_path / "quota.json"),
    )
    gt.reset_quota_store_for_tests()
    song = Song(
        number=4,
        title="Song 4",
        english_meaning="All minds' veenas play in one tune today.",
        hindi_meaning=None,
        metadata_json={},
    )
    service = LocalizationService()
    service.provider = AsyncMock(
        complete=AsyncMock(
            return_value="Today every heart sings the same loving tune toward the Divine."
        )
    )
    with (
        patch("app.services.localization.get_settings", return_value=settings),
        patch(
            "app.services.localization.translate_texts",
            new=AsyncMock(return_value=["Alle geesten spelen vandaag in één toon."]),
        ),
        patch("app.services.localization.google_translate_configured", return_value=True),
    ):
        await translation_cache.clear()
        fast = await service.localize(
            song, "Dutch", explanation=None, generate_missing_central_idea=False
        )
        assert fast.localized_meaning == "Alle geesten spelen vandaag in één toon."
        assert fast.localized_explanation is None
        service.provider.complete.assert_not_awaited()

        result = await service.localize(
            song, "Dutch", explanation=None, generate_missing_central_idea=True
        )

    assert result.localized_meaning == "Alle geesten spelen vandaag in één toon."
    assert result.explanation_kind == "generated"
    assert "loving tune" in (result.localized_explanation or "")
    service.provider.complete.assert_awaited()
    assert "system" in (service.provider.complete.await_args.kwargs or {})
    assert "summarize and crystallize" in (
        service.provider.complete.await_args.kwargs.get("system") or ""
    )


@pytest.mark.asyncio
async def test_localize_translates_central_idea_when_meaning_is_stored(tmp_path: Path) -> None:
    """Curated Hindi meaning must not short-circuit and leave Central idea in English."""
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://test:test@localhost/test",
        APP_ENV="test",
        GOOGLE_TRANSLATE_API_KEY="test-key",
        GOOGLE_TRANSLATE_ENABLED=True,
        GOOGLE_TRANSLATE_MONTHLY_CHAR_LIMIT=400_000,
        GOOGLE_TRANSLATE_ALLOW_PAID=False,
        GOOGLE_TRANSLATE_QUOTA_PATH=str(tmp_path / "quota.json"),
    )
    gt.reset_quota_store_for_tests()
    english_idea = "Paramapurusa is the real friend."
    song = Song(
        number=1,
        title="Song 1",
        english_meaning="O dearest Friend, lead me on.",
        hindi_meaning="हे प्रिय सखा, मुझे आगे ले चलो।",
        metadata_json={},
    )
    service = LocalizationService()
    with (
        patch("app.services.localization.get_settings", return_value=settings),
        patch(
            "app.services.localization.translate_texts",
            new=AsyncMock(return_value=["परमपुरुष ही सच्चे मित्र हैं।"]),
        ) as translate_mock,
        patch("app.services.localization.google_translate_configured", return_value=True),
    ):
        await translation_cache.clear()
        result = await service.localize(song, "Hindi", explanation=english_idea)

    assert result.localized_meaning == "हे प्रिय सखा, मुझे आगे ले चलो।"
    assert result.localized_explanation == "परमपुरुष ही सच्चे मित्र हैं।"
    assert result.localized_explanation != english_idea
    assert result.provider == "google"
    translate_mock.assert_awaited_once()
    assert translate_mock.await_args.args[0] == [english_idea]


@pytest.mark.asyncio
async def test_localize_falls_back_to_llm_when_google_unavailable(tmp_path: Path) -> None:
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://test:test@localhost/test",
        APP_ENV="test",
        GOOGLE_TRANSLATE_API_KEY="",
        GOOGLE_TRANSLATE_ENABLED=True,
        GOOGLE_TRANSLATE_ALLOW_PAID=False,
    )
    song = Song(
        number=3,
        title="Song 3",
        english_meaning="The crimson dawn has come.",
        metadata_json={},
    )
    service = LocalizationService()
    service.provider = AsyncMock(
        complete=AsyncMock(
            return_value=(
                '{"localized_title":"Song 3","localized_first_line":null,'
                '"localized_meaning":"लाल भोर आ गई है।","localized_explanation":null}'
            )
        )
    )
    with (
        patch("app.services.localization.get_settings", return_value=settings),
        patch("app.services.localization.google_translate_configured", return_value=False),
        patch(
            "app.services.localization.refine_meaning_translation",
            new=AsyncMock(return_value="लाल भोर आ गई है।"),
        ),
        patch(
            "app.services.localization.audit_meaning_translation",
            return_value=type("A", (), {"passed": True, "issues": ()})(),
        ),
    ):
        await translation_cache.clear()
        result = await service.localize(song, "hi")
    assert result.provider == "llm"
    assert result.localized_meaning == "लाल भोर आ गई है।"
    service.provider.complete.assert_called()


@pytest.mark.asyncio
async def test_localize_defers_neon_persist_when_scheduler_provided(
    tmp_path: Path,
) -> None:
    """Return Google meaning without awaiting DB commit when schedule_persist is set."""
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://test:test@localhost/test",
        APP_ENV="test",
        GOOGLE_TRANSLATE_API_KEY="test-key",
        GOOGLE_TRANSLATE_ENABLED=True,
        GOOGLE_TRANSLATE_MONTHLY_CHAR_LIMIT=400_000,
        GOOGLE_TRANSLATE_ALLOW_PAID=False,
        GOOGLE_TRANSLATE_QUOTA_PATH=str(tmp_path / "quota.json"),
    )
    gt.reset_quota_store_for_tests()
    song = Song(
        number=9,
        title="Song 9",
        english_meaning="The crimson dawn has come.",
        metadata_json={},
    )
    scheduled: list[tuple[int, str, object]] = []
    session = AsyncMock()
    session.execute = AsyncMock()
    service = LocalizationService()
    service.provider = AsyncMock()
    with (
        patch("app.services.localization.get_settings", return_value=settings),
        patch(
            "app.services.localization.translate_texts",
            new=AsyncMock(return_value=["लाल भोर आ गई है।"]),
        ),
        patch("app.services.localization.google_translate_configured", return_value=True),
    ):
        await translation_cache.clear()
        result = await service.localize(
            song,
            "hi",
            session=session,
            schedule_persist=lambda n, code, payload: scheduled.append((n, code, payload)),
        )
    assert result.provider == "google"
    assert result.localized_meaning == "लाल भोर आ गई है।"
    assert len(scheduled) == 1
    assert scheduled[0][0] == 9
    assert scheduled[0][1] == "hi"
    # Deferred path must not commit on the request session.
    session.commit.assert_not_called()
    # In-memory song metadata updated for this request.
    meanings = (song.metadata_json or {}).get("localized_meanings") or {}
    assert meanings.get("hi") == "लाल भोर आ गई है।"


@pytest.mark.asyncio
async def test_localized_response_cache_roundtrip() -> None:
    await localized_response_cache.clear()
    payload = {
        "song_number": 4,
        "language": "Swahili",
        "localized_title": None,
        "localized_first_line": None,
        "localized_meaning": "Vinubi vya akili…",
        "localized_explanation": None,
        "explanation_kind": None,
        "provider": "google",
    }
    await localized_response_cache.set("4:sw", payload)
    hit = await localized_response_cache.get("4:sw")
    assert hit == payload
    await localized_response_cache.clear()
