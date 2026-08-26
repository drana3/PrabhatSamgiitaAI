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
    TOP_SEARCH_PREDICTIONS,
    HybridSearchService,
    canonical_lexical_boost,
    expand_concept_query,
    expand_voice_query,
    infer_canonical_collection,
    needs_semantic_expansion,
    prepare_voice_query,
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
    # Semantic feeling search must not promote mere keyword mentions in the document.
    assert canonical_lexical_boost("fountain of effulgence", song, semantic_mode=True) == 0.0
    assert canonical_lexical_boost(song.title or "", song, semantic_mode=True) == 3.0


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
    assert all(
        item.metadata_json.get("requires_human_review") is True
        or item.verification_status == "expert_verified"
        for item in machine_readable
    )


@pytest.mark.asyncio
async def test_catalog_falls_back_to_full_snapshot() -> None:
    service = CatalogService(UnavailableSession())  # type: ignore[arg-type]

    assert (await service.get_song(5018)).number == 5018  # type: ignore[union-attr]
    assert [song.number for song in await service.list_songs(limit=2, offset=110)] == [111, 112]


@pytest.mark.asyncio
async def test_song_page_reads_come_from_the_packaged_snapshot() -> None:
    service = CatalogService(UnavailableSession())  # type: ignore[arg-type]
    song = await service.get_song(1)
    assert song is not None
    related = await service.related_songs(song)
    media = await service.get_media(1)
    notation = await service.get_notation(1)

    assert song.lyrics_original
    assert related
    assert media
    assert all(item.song_number == 1 for item in media)
    assert notation is None or notation.song_number == 1


@pytest.mark.asyncio
async def test_neon_song_edits_patch_the_in_memory_catalog() -> None:
    from app.models import Song
    from app.services.catalog import refresh_catalog_song, reset_catalog_memory, songs_by_number

    reset_catalog_memory()
    original = songs_by_number()[1].lyrics_original
    updated = Song(
        number=1,
        title="BANDHU HE NIYE CALO",
        lyrics_original="UPDATED LYRICS FROM NEON",
        canonical_source_status="verified",
        is_verified=True,
        metadata_json={},
    )
    calls = {"n": 0}

    class Session:
        async def execute(self, statement: Any) -> Any:
            del statement
            calls["n"] += 1
            if calls["n"] == 1:
                class SongResult:
                    def scalar_one_or_none(self) -> Song:
                        return updated
                return SongResult()
            if calls["n"] == 2:
                class MediaResult:
                    def scalars(self):
                        return self
                    def all(self) -> list[Any]:
                        return []
                return MediaResult()
            class NotationResult:
                def scalar_one_or_none(self) -> None:
                    return None
            return NotationResult()

        async def rollback(self) -> None:
            return None

    assert await refresh_catalog_song(Session(), 1)  # type: ignore[arg-type]
    assert songs_by_number()[1].lyrics_original == "UPDATED LYRICS FROM NEON"
    reset_catalog_memory()
    assert songs_by_number()[1].lyrics_original == original


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
async def test_semantic_mode_uses_collection_fast_path_for_reviewed_lists() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search("English songs", mode="semantic")

    assert response.detected_intent == "collection_search"
    assert {item.song_number for item in response.items} == {68, 5008, 5009}


@pytest.mark.asyncio
async def test_semantic_mode_uses_collection_fast_path_for_short_keywords() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search("marriage", mode="semantic")

    assert response.detected_intent == "collection_search"
    assert [item.song_number for item in response.items] == [58]


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
@pytest.mark.parametrize(
    "spoken_query",
    [
        "मुसाफिर आगे बढ़ते जाना",
        "मुझे मुसाफिर आगे बढ़ते जाना सुनाओ",
    ],
)
async def test_native_hindi_voice_query_returns_three_ranked_matches(
    spoken_query: str,
) -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search(spoken_query, page_size=3, input_mode="voice")

    assert response.items
    assert response.items[0].song_number == 4166
    assert len(response.items) <= 3
    assert "voice_phonetic" in response.items[0].matched_by


@pytest.mark.asyncio
async def test_voice_song_number_remains_authoritative() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search("song 2256", page_size=3, input_mode="voice")

    assert [item.song_number for item in response.items] == [2256]


def test_voice_feeling_query_keeps_meaning_terms_for_semantic_search() -> None:
    heard = "I am feeling very happy today"
    prepared = prepare_voice_query(heard)
    expanded = expand_voice_query(prepared)

    assert "happy" in prepared
    assert "feeling" in prepared
    assert "joy" in expanded or "bliss" in expanded
    assert needs_semantic_expansion(prepared) is True
    assert needs_semantic_expansion("bandhu he niye calo") is False
    # Short mood chips expand locally — no LLM rewrite.
    assert needs_semantic_expansion("peace") is False
    assert needs_semantic_expansion("morning meditation") is False
    assert needs_semantic_expansion("Devotional") is False
    assert needs_semantic_expansion("songs for peace of mind") is True


def test_short_feeling_queries_expand_locally() -> None:
    assert "shanti" in expand_concept_query("peace")
    assert "shanti" in expand_concept_query("I am feeling very stressful today")
    assert "bhakti" in expand_concept_query("Devotional")
    assert "contemplation" in expand_concept_query("morning meditation")
    assert "shiva" in expand_concept_query("siv")
    assert "shiva" in expand_concept_query("shiv")
    assert "krsna" in expand_concept_query("kisna")
    assert "krsna" in expand_concept_query("kishna")
    assert "krsna" in expand_concept_query("krishna")


@pytest.mark.asyncio
async def test_voice_feeling_query_uses_semantic_mode_across_catalog() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search(
        "I am feeling very happy today",
        page_size=5,
        input_mode="voice",
        mode="semantic",
    )

    assert response.items
    assert len(response.items) <= 5
    assert response.detected_intent == "semantic_search"


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


@pytest.mark.asyncio
async def test_urdu_collection_returns_full_list_when_page_size_allows() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search(
        "Search Prabhat Samgiita for Urdu Songs",
        page_size=200,
    )

    assert response.detected_intent == "collection_search"
    assert response.total > TOP_SEARCH_PREDICTIONS
    assert len(response.items) == response.total


@pytest.mark.asyncio
async def test_catalog_search_is_unchanged_for_opening_line_lookups() -> None:
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]

    response = await service.search("bandhu he niye calo", mode="catalog", page_size=5)

    assert response.items
    assert response.detected_intent != "lyric_search"
    assert response.items[0].song_number == 1
