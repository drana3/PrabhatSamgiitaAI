import pytest

from app.services.ingestion_language import validate_meaning_language


def test_validate_meaning_language_accepts_english() -> None:
    ok, message = validate_meaning_language("en", "This song speaks of devotion.")
    assert ok is True
    assert message == ""


def test_validate_meaning_language_rejects_hindi_in_english_slot() -> None:
    ok, message = validate_meaning_language("en", "यह गीत भक्ति के बारे में है")
    assert ok is False
    assert "English" in message


def test_validate_meaning_language_accepts_devanagari_for_hindi() -> None:
    ok, message = validate_meaning_language("hi", "यह गीत भक्ति के बारे में है")
    assert ok is True


def test_validate_meaning_language_accepts_labels_for_tamil_and_nepali() -> None:
    ok_ta, _ = validate_meaning_language("Tamil", "இந்த பாடல் பக்தியைப் பற்றி")
    ok_ne, _ = validate_meaning_language("Nepali", "यो गीत भक्ति बारेमा छ")
    assert ok_ta is True
    assert ok_ne is True


def test_validate_meaning_language_rejects_english_for_tamil_label() -> None:
    ok, message = validate_meaning_language("Tamil", "This song speaks of devotion.")
    assert ok is False
    assert "does not appear to match" in message


@pytest.mark.asyncio
async def test_translate_meaning_from_english_uses_db_english() -> None:
    from unittest.mock import AsyncMock, patch

    from app.models import Song
    from app.services.admin_workflow import translate_meaning_from_english

    song = Song(
        id=1,
        number=42,
        title="Test song",
        english_meaning="This song speaks of devotion.",
    )
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=song)

    class FakeProvider:
        calls = 0

        async def complete(self, prompt: str) -> str:
            FakeProvider.calls += 1
            assert "This song speaks of devotion." in prompt
            if "DRAFT" in prompt:
                return "यह गीत भक्ति के विषय में है"
            assert "Hindi" in prompt
            return "यह गीत भक्ति के बारे में है"

    with patch(
        "app.services.admin_workflow.select_provider",
        return_value=FakeProvider(),
    ):
        result = await translate_meaning_from_english(session, 42, "hi")

    assert FakeProvider.calls == 2
    assert result.draft_text == "यह गीत भक्ति के विषय में है"
    assert result.source_language == "en"
    assert result.target_language == "hi"
    assert result.language_check_ok is True


@pytest.mark.asyncio
async def test_translate_meaning_from_english_requires_english_source() -> None:
    from unittest.mock import AsyncMock

    from fastapi import HTTPException

    from app.models import Song
    from app.services.admin_workflow import translate_meaning_from_english

    song = Song(id=1, number=42, title="Test song", english_meaning=None)
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=song)

    with pytest.raises(HTTPException) as exc:
        await translate_meaning_from_english(session, 42, "hi")
    assert exc.value.status_code == 400
    assert "source meaning" in str(exc.value.detail).casefold()


@pytest.mark.asyncio
async def test_translate_meaning_from_english_accepts_override() -> None:
    from unittest.mock import AsyncMock, patch

    from app.models import Song
    from app.services.admin_workflow import translate_meaning_from_english

    song = Song(id=1, number=42, title="Test song", english_meaning="Stored meaning")
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=song)

    class FakeProvider:
        async def complete(self, prompt: str) -> str:
            assert "Override meaning" in prompt
            assert "Stored meaning" not in prompt
            if "DRAFT" in prompt:
                return "सुधारित अनुवाद"
            return "अनुवाद"

    with patch(
        "app.services.admin_workflow.select_provider",
        return_value=FakeProvider(),
    ):
        result = await translate_meaning_from_english(
            session,
            42,
            "hi",
            english_text="Override meaning",
        )

    assert result.draft_text == "सुधारित अनुवाद"


@pytest.mark.asyncio
async def test_clear_pending_youtube_reviews_dismisses_rows(tmp_path, monkeypatch) -> None:
    from unittest.mock import AsyncMock
    from uuid import uuid4

    from app.models.admin_workflow import YoutubeReviewQueue
    from app.services import admin_workflow

    review_file = tmp_path / "youtube_review_queue.json"
    review_file.write_text('[{"external_id": "abc"}]\n', encoding="utf-8")
    monkeypatch.setattr(admin_workflow, "YOUTUBE_REVIEW_JSON", review_file)

    pending = YoutubeReviewQueue(
        id=uuid4(),
        external_id="abc",
        title="Pending",
        url="https://example.com",
        review_reason="pending_review",
        status="pending_review",
    )
    session = AsyncMock()
    session.scalars = AsyncMock(return_value=AsyncMock(all=lambda: [pending]))
    session.commit = AsyncMock()

    cleared = await admin_workflow.clear_pending_youtube_reviews(session)

    assert cleared == 1
    assert pending.status == "dismissed"
    assert review_file.read_text(encoding="utf-8").strip() == "[]"
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_song_ingestion_preview_returns_existing_content() -> None:
    from unittest.mock import AsyncMock

    from app.models import Media, Song
    from app.services.admin_workflow import song_ingestion_preview

    song = Song(
        id=1,
        number=111,
        title="Test song",
        lyrics_original="Bandhu he niye calo",
        english_meaning="This song speaks of devotion.",
        hindi_meaning="यह गीत भक्ति के बारे में है",
    )
    audio = Media(
        id=1,
        song_number=111,
        kind="audio",
        provider="youtube",
        title="PS 111",
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    )
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=song)
    session.scalars = AsyncMock(return_value=AsyncMock(all=lambda: [audio]))

    preview = await song_ingestion_preview(session, 111)

    assert preview.song_number == 111
    assert preview.existing_lyrics == "Bandhu he niye calo"
    assert preview.existing_meanings["en"] == "This song speaks of devotion."
    assert preview.existing_audio_url == audio.url


@pytest.mark.asyncio
async def test_song_ingestion_preview_missing_song() -> None:
    from unittest.mock import AsyncMock

    from fastapi import HTTPException

    from app.services.admin_workflow import song_ingestion_preview

    session = AsyncMock()
    session.scalar = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc:
        await song_ingestion_preview(session, 99999)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_submit_song_ingestion_blocks_language_warnings() -> None:
    from unittest.mock import AsyncMock
    from uuid import uuid4

    from fastapi import HTTPException

    from app.models import Song, UserAccount
    from app.schemas.admin_workflow import IngestionMeaningEntry, SongIngestionWrite
    from app.services.admin_workflow import submit_song_ingestion

    submitter = UserAccount(id=uuid4(), email="admin@test")
    song = Song(id=1, number=111, title="Test song")
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=song)
    payload = SongIngestionWrite(
        song_number=111,
        meanings=[
            IngestionMeaningEntry(
                language="en",
                text="यह गीत भक्ति के बारे में है",
                is_primary=True,
            )
        ],
    )

    with pytest.raises(HTTPException) as exc:
        await submit_song_ingestion(session, submitter, payload)
    assert exc.value.status_code == 400
    detail = exc.value.detail
    assert isinstance(detail, dict)
    assert detail.get("warnings")


@pytest.mark.asyncio
async def test_submit_song_ingestion_creates_pending_row() -> None:
    from unittest.mock import AsyncMock
    from uuid import uuid4

    from app.models import Song, UserAccount
    from app.schemas.admin_workflow import IngestionMeaningEntry, SongIngestionWrite
    from app.services.admin_workflow import submit_song_ingestion

    submitter = UserAccount(id=uuid4(), email="admin@test")
    song = Song(id=1, number=111, title="Test song")
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=song)
    payload = SongIngestionWrite(
        song_number=111,
        lyrics="Updated lyric line",
        meanings=[
            IngestionMeaningEntry(
                language="en",
                text="This song speaks of devotion.",
                is_primary=True,
            )
        ],
        comments="Pilot ingestion",
    )

    submission = await submit_song_ingestion(session, submitter, payload)

    assert submission.status == "pending_super_admin"
    assert submission.song_number == 111
    session.add.assert_called_once()
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_review_song_ingestion_applies_approved_payload() -> None:
    from unittest.mock import AsyncMock, patch
    from uuid import uuid4

    from app.models import Song, UserAccount
    from app.models.admin_workflow import SongIngestionSubmission
    from app.schemas.admin_workflow import SongIngestionWrite
    from app.services.admin_workflow import review_song_ingestion

    reviewer = UserAccount(id=uuid4(), email="super@test")
    song = Song(id=1, number=111, title="Test song", metadata_json={})
    submission = SongIngestionSubmission(
        id=uuid4(),
        submitted_by=reviewer.id,
        song_number=111,
        status="pending_super_admin",
        payload_json=SongIngestionWrite(
            song_number=111,
            lyrics="Approved lyric",
            meanings=[],
        ).model_dump(),
        language_warnings=[],
    )
    session = AsyncMock()
    session.get = AsyncMock(return_value=submission)
    session.scalar = AsyncMock(return_value=song)

    with patch("app.services.admin_workflow.refresh_catalog_song", new=AsyncMock()):
        result = await review_song_ingestion(
            session,
            submission.id,
            reviewer,
            approve=True,
            review_note=None,
        )

    assert result.status == "approved"
    assert song.lyrics_original == "Approved lyric"
    session.commit.assert_awaited()
