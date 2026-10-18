"""Admin Devanagari load fills missing DB text from packaged songs.json."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.models import Song
from app.services.catalog import reset_catalog_memory
from app.services.devanagari_admin import (
    admin_devanagari_payload,
    catalog_devanagari,
    ensure_song_devanagari_loaded,
)


@pytest.fixture(autouse=True)
def _catalog() -> None:
    reset_catalog_memory()


def test_catalog_devanagari_song_1() -> None:
    text, status = catalog_devanagari(1)
    assert text and "बन्धु" in text
    assert status == "provisional"


def test_payload_fills_empty_db_from_catalogue() -> None:
    song = Song(
        number=1,
        title="Bandhu",
        lyrics_original="BANDHU HE NIYE CALO",
        lyrics_devanagari=None,
        devanagari_status="none",
    )
    payload = admin_devanagari_payload(song)
    assert payload.lyrics_original and "BANDHU" in payload.lyrics_original
    assert payload.lyrics_devanagari and "बन्धु" in payload.lyrics_devanagari
    assert payload.devanagari_status == "provisional"
    assert payload.line_count_devanagari >= 1


@pytest.mark.asyncio
async def test_ensure_loads_and_persists() -> None:
    song = Song(
        number=1,
        title="Bandhu",
        lyrics_original="BANDHU",
        lyrics_devanagari=None,
        devanagari_status="none",
    )
    session = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    out = await ensure_song_devanagari_loaded(session, song)
    assert out.lyrics_devanagari and "बन्धु" in out.lyrics_devanagari
    assert out.devanagari_status == "provisional"
    session.commit.assert_awaited_once()
