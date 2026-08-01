from typing import Any

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.models.song import Song
from app.services.catalog import (
    CatalogService,
    catalog_inventory_snapshot,
    catalog_media_snapshot,
    catalog_song_snapshot,
)
from app.services.search import HybridSearchService, canonical_lexical_boost


class UnavailableSession:
    async def execute(self, statement: Any) -> None:
        raise SQLAlchemyError("database unavailable")

    async def rollback(self) -> None:
        return None


def test_packaged_catalog_contains_all_songs() -> None:
    songs = catalog_song_snapshot()

    assert len(songs) == 5018
    assert songs[0].number == 1
    assert songs[-1].number == 5018
    assert songs[0].english_meaning
    assert songs[0].hindi_meaning
    assert next(song for song in songs if song.number == 4954).festival
    assert "PROUT" in (next(song for song in songs if song.number == 4599).theme or "")


def test_canonical_theme_assignments_are_not_truncated() -> None:
    song = next(item for item in catalog_song_snapshot() if item.number == 4081)

    assert song.theme is not None
    assert len(song.theme) > 255


def test_exact_canonical_meaning_phrase_gets_strong_search_boost() -> None:
    song = Song(
        number=1,
        title="Bandhu He Niye Calo",
        first_line="Bandhu He Niye Calo",
        english_meaning="O friend, lead me towards the fountain of effulgence.",
        canonical_source_url="https://prabhatasamgiita.net/lyrics/ps_1.htm",
        canonical_source_status="verified",
        is_verified=True,
    )

    assert canonical_lexical_boost("fountain of effulgence", song) == 1.5


def test_numbered_youtube_videos_preserve_multiple_renditions() -> None:
    videos = [item for item in catalog_media_snapshot() if item.kind == "video"]

    assert len(videos) == 372
    song_one = next(item for item in videos if item.song_number == 1)
    assert song_one.embed_url == "https://www.youtube-nocookie.com/embed/D4LHhnSLhro"
    assert song_one.verification_status == "verified"
    assert len([item for item in videos if item.song_number == 2635]) == 2


def test_number_first_audio_inventory_maximizes_coverage() -> None:
    audio = [item for item in catalog_media_snapshot() if item.kind == "audio"]
    covered = {item.song_number for item in audio if item.song_number is not None}

    assert len(covered) == 4948
    external_gap_fill = [
        item for item in audio if item.song_number == 1112 and item.provider == "external_site"
    ]
    assert len(external_gap_fill) == 1
    assert external_gap_fill[0].verification_status == "unverified"
    assert external_gap_fill[0].url.startswith("https://sarkarverse.org/")


def test_canonical_inventory_titles_are_not_truncated() -> None:
    inventory = catalog_inventory_snapshot()

    assert max(len(item.title) for item in inventory) > 255
    assert len([item for item in inventory if item.source_kind == "video"]) == 372
    assert len([item for item in inventory if item.source_kind == "audio"]) >= 10_000


@pytest.mark.asyncio
async def test_catalog_falls_back_to_full_snapshot() -> None:
    service = CatalogService(UnavailableSession())  # type: ignore[arg-type]

    assert (await service.get_song(5018)).number == 5018  # type: ignore[union-attr]
    assert [song.number for song in await service.list_songs(limit=2, offset=110)] == [111, 112]


@pytest.mark.asyncio
async def test_exact_number_search_works_without_database() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search("111")

    assert response.total >= 1
    assert response.items[0].song_number == 111
    assert "exact_number" in response.items[0].matched_by
