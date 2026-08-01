from typing import Any

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.services.catalog import CatalogService, catalog_song_snapshot
from app.services.search import HybridSearchService


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
