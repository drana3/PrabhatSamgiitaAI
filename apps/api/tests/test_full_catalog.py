from typing import Any

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.models.media import Media
from app.models.song import Song
from app.services.catalog import (
    CatalogService,
    catalog_inventory_snapshot,
    catalog_media_snapshot,
    catalog_notation_snapshot,
    catalog_song_snapshot,
)
from app.services.media_quality import media_quality_key
from app.services.search import (
    HybridSearchService,
    canonical_lexical_boost,
    infer_canonical_collection,
)
from app.services.seed_data import load_rows


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


def test_canonical_ceremonies_are_distinct_and_not_contaminated() -> None:
    songs = {song.number: song for song in catalog_song_snapshot()}

    assert songs[58].occasion == "Marriage Ceremony"
    assert songs[60].occasion == "Passing Away Ceremony"
    assert songs[137].occasion == "House Warming Ceremony"
    assert songs[136].occasion == "Tree Planting Ceremony"
    assert "Passing Away" not in (songs[58].occasion or "")
    assert not any(
        song.occasion and "Marriage Ceremony" in song.occasion and "Passing Away" in song.occasion
        for song in songs.values()
    )


def test_canonical_language_and_festival_collections_are_exact() -> None:
    songs = catalog_song_snapshot()
    english = {song.number for song in songs if song.language == "English"}
    shravanii = {song.number for song in songs if song.festival == "Shravanii Purnima Day"}

    assert english == {68, 5008, 5009}
    assert shravanii == {4954}


def test_all_69_canonical_collections_resolve_to_their_exact_song_sets() -> None:
    collections = load_rows("theme_collections.json")

    assert len(collections) == 69
    for collection in collections:
        expected = frozenset(int(number) for number in collection["song_numbers"])
        match = infer_canonical_collection(f"Search Prabhat Samgiita for {collection['label']}")
        assert expected
        assert collection["count"] == len(expected)
        assert match is not None, collection["label"]
        assert match.label == collection["label"]
        assert match.song_numbers == expected


def test_two_autumn_collections_remain_distinct() -> None:
    sharat = infer_canonical_collection("Autumn Songs (Sharat)")
    hemante = infer_canonical_collection("Autumn Songs (Hemante)")

    assert sharat is not None
    assert hemante is not None
    assert len(sharat.song_numbers) == 6
    assert len(hemante.song_numbers) == 6
    assert sharat.song_numbers != hemante.song_numbers


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

    assert len(videos) >= 372
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


def test_primary_audio_prefers_current_and_non_low_quality_recordings() -> None:
    current = Media(
        song_number=1,
        kind="audio",
        provider="official",
        title="Current recording",
        url="https://example.test/current.mp3",
        verification_status="verified",
        metadata_json={"source_status": "official"},
    )
    old = Media(
        song_number=1,
        kind="audio",
        provider="official",
        title="Old recording",
        url="https://example.test/old.mp3",
        verification_status="verified",
        metadata_json={"source_status": "official", "version": "old"},
    )
    low_quality = Media(
        song_number=1,
        kind="audio",
        provider="official",
        title="Recording (low quality)",
        url="https://example.test/low.mp3",
        verification_status="verified",
        metadata_json={"source_status": "official"},
    )

    assert sorted([low_quality, old, current], key=media_quality_key) == [
        current,
        old,
        low_quality,
    ]


def test_canonical_inventory_titles_are_not_truncated() -> None:
    inventory = catalog_inventory_snapshot()

    assert max(len(item.title) for item in inventory) > 255
    assert len([item for item in inventory if item.source_kind == "video"]) >= 372
    assert len([item for item in inventory if item.source_kind == "audio"]) >= 10_000


def test_learner_notation_has_substantial_real_source_coverage() -> None:
    notations = catalog_notation_snapshot()
    machine_readable = [item for item in notations if item.notation_text]

    assert len(machine_readable) >= 1_000
    assert all(item.verification_status != "verified" for item in machine_readable)
    assert all(item.metadata_json.get("requires_human_review") is True for item in machine_readable)


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


@pytest.mark.asyncio
async def test_exact_number_search_never_returns_similar_numbers() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search("2256")

    assert response.total == 1
    assert [item.song_number for item in response.items] == [2256]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "query",
    [
        "Song 223",
        "explain about prabhat sagiat 223",
        "what is the meaning of Prabhat Samgiita 223",
        "lyrics for PS 223",
    ],
)
async def test_natural_language_song_number_intent_is_authoritative(query: str) -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search(query)

    assert response.detected_intent == "song_number_search"
    assert response.total == 1
    assert [item.song_number for item in response.items] == [223]


@pytest.mark.asyncio
async def test_historical_year_query_remains_semantic() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search("songs composed in 1983")

    assert response.detected_intent == "semantic_search"
    assert not (response.total == 1 and response.items[0].song_number == 1983)


@pytest.mark.asyncio
async def test_language_collection_query_returns_only_verified_english_songs() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search("English songs")

    assert response.detected_intent == "collection_search"
    assert {item.song_number for item in response.items} == {68, 5008, 5009}
    assert all("structured_filter" in item.matched_by for item in response.items)


@pytest.mark.asyncio
async def test_plain_marriage_query_returns_only_the_canonical_ceremony_song() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search("marriage")

    assert response.detected_intent == "collection_search"
    assert [item.song_number for item in response.items] == [58]


@pytest.mark.asyncio
async def test_plain_birthday_query_combines_general_and_baba_birthday_songs() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search("birthday songs")

    assert response.detected_intent == "collection_search"
    assert {item.song_number for item in response.items} == {132, 133, 134, 135, 903, 2649}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "spoken_query",
    [
        "musafir aage badhte jana",
        "musafir age barhate jana",
        "musafir aage barhate jaana",
    ],
)
async def test_spoken_transliteration_variants_rank_the_canonical_song_first(
    spoken_query: str,
) -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search(spoken_query, page_size=3)

    assert response.items
    assert response.items[0].song_number == 4166
    assert len(response.items) <= 3


@pytest.mark.asyncio
async def test_hindi_urdu_and_shared_hindustani_collections_are_disjoint() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    hindi = await service.search("Hindi songs")
    urdu = await service.search("Urdu songs")
    shared = await service.search("Hindustani")
    hindi_numbers = {item.song_number for item in hindi.items}
    urdu_numbers = {item.song_number for item in urdu.items}
    shared_numbers = {item.song_number for item in shared.items}

    assert hindi_numbers == {4070}
    assert urdu_numbers == {4072, 4078, 4166, 4171, 4172}
    assert len(shared_numbers) == 11
    assert hindi_numbers.isdisjoint(urdu_numbers)
    assert hindi_numbers.isdisjoint(shared_numbers)
    assert urdu_numbers.isdisjoint(shared_numbers)


@pytest.mark.asyncio
async def test_festival_collection_query_returns_only_shravanii_song() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search(
        "Search Prabhat Samgiita for Shrávanii Purnimá Shravanii Purnima Day"
    )

    assert [item.song_number for item in response.items] == [4954]
