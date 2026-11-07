"""Which media a client gets: status filter, merge of snapshot and database, order, "Best"."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import random
from typing import Any

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.models.media import Media
from app.services.catalog import CatalogService, catalog_media_snapshot, reset_catalog_memory
from app.services.media_quality import (
    ACCEPTED_MEDIA_STATUSES,
    client_media_items,
    media_identity,
    media_is_accepted,
    merge_media,
    preferred_audio_url,
    to_media_item_response,
    youtube_embed_id,
)


def audio(title: str, *, status: str = "verified", song: int = 7, **meta: Any) -> Media:
    slug = title.replace(" ", "%20")
    return Media(
        song_number=song,
        kind="audio",
        provider="official",
        title=title,
        url=f"https://prabhatasamgiita.net/1-999/{slug}.mp3",
        verification_status=status,
        metadata_json=meta,
    )


def video(
    vid: str,
    *,
    title: str = "Song - Prabhat Sangeet #7",
    status: str = "verified",
    song: int = 7,
    url: str | None = None,
    embed: str | None = None,
    **meta: Any,
) -> Media:
    return Media(
        song_number=song,
        kind="video",
        provider="youtube",
        title=title,
        url=url or f"https://www.youtube.com/watch?v={vid}",
        embed_url=embed or f"https://www.youtube-nocookie.com/embed/{vid}",
        verification_status=status,
        metadata_json={"external_id": vid, "source_status": "verified_community", **meta},
    )


class FakeResult:
    def __init__(self, rows: list[Media]) -> None:
        self._rows = rows

    def scalars(self) -> FakeResult:
        return self

    def all(self) -> list[Media]:
        return list(self._rows)


class FakeSession:
    def __init__(self, rows: list[Media] | None = None, *, fail: bool = False) -> None:
        self.rows = rows or []
        self.fail = fail

    async def execute(self, statement: Any) -> FakeResult:
        if self.fail:
            raise SQLAlchemyError("database unavailable")
        return FakeResult(self.rows)

    async def rollback(self) -> None:
        return None


# --- status -----------------------------------------------------------------------------------


@pytest.mark.parametrize("status", ["verified", "verified_external", "human_reviewed"])
def test_accepted_statuses_are_served(status: str) -> None:
    assert media_is_accepted(audio("A", status=status))
    assert status in ACCEPTED_MEDIA_STATUSES


@pytest.mark.parametrize(
    "status",
    ["rejected", "draft", "unverified", "needs_review", "pending_review", "ai_generated", ""],
)
def test_other_statuses_never_reach_a_client(status: str) -> None:
    items = [audio("A", status=status), video("dQw4w9WgXcQ", status=status)]
    assert merge_media(items, []) == []
    assert client_media_items(items) == []


def test_a_row_without_status_is_not_served() -> None:
    row = audio("A")
    row.verification_status = None  # type: ignore[assignment]
    assert not media_is_accepted(row)


@pytest.mark.asyncio
async def test_get_media_filters_database_rows_when_the_snapshot_is_empty() -> None:
    reset_catalog_memory()
    rows = [
        video("aaaaaaaaaaa", song=999_001, status="verified"),
        video("bbbbbbbbbbb", song=999_001, status="rejected"),
        video("ccccccccccc", song=999_001, status="unverified"),
        video("ddddddddddd", song=999_001, status="draft"),
        video("eeeeeeeeeee", song=999_001, status="human_reviewed"),
    ]
    media = await CatalogService(FakeSession(rows)).get_media(999_001)  # type: ignore[arg-type]
    assert sorted(youtube_embed_id(item) or "" for item in media) == ["aaaaaaaaaaa", "eeeeeeeeeee"]
    everything = await CatalogService(FakeSession(rows)).get_media(  # type: ignore[arg-type]
        999_001, include_unreviewed=True
    )
    assert len(everything) == 5


# --- merge ------------------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_database_video_is_added_to_a_song_that_has_snapshot_audio() -> None:
    reset_catalog_memory()
    snapshot_audio = [m for m in catalog_media_snapshot() if m.song_number == 2848]
    assert snapshot_audio, "song 2848 has bundled audio"
    extra = video("zzzzzzzzzzz", song=2848)
    media = await CatalogService(FakeSession([extra])).get_media(2848)  # type: ignore[arg-type]
    kinds = [item.kind for item in media]
    assert "audio" in kinds
    assert any(youtube_embed_id(item) == "zzzzzzzzzzz" for item in media)
    assert kinds == sorted(kinds, key=lambda k: {"audio": 0, "video": 1}[k])


@pytest.mark.asyncio
async def test_unavailable_database_falls_back_to_the_snapshot() -> None:
    reset_catalog_memory()
    media = await CatalogService(FakeSession(fail=True)).get_media(1)  # type: ignore[arg-type]
    assert media
    assert all(item.song_number == 1 for item in media)
    assert all(media_is_accepted(item) for item in media)


def test_videos_are_deduplicated_by_embed_id_across_url_forms() -> None:
    snapshot = [video("D4LHhnSLhro")]
    database = [
        video(
            "D4LHhnSLhro",
            url="https://youtu.be/D4LHhnSLhro",
            embed="https://www.youtube.com/embed/D4LHhnSLhro",
            title="Same video, other title",
        ),
        video("OTHERvideo1", url="https://www.youtube.com/shorts/OTHERvideo1"),
    ]
    merged = merge_media(snapshot, database)
    assert [youtube_embed_id(item) for item in merged].count("D4LHhnSLhro") == 1
    assert len(merged) == 2
    # the database row won
    assert next(m for m in merged if youtube_embed_id(m) == "D4LHhnSLhro").title == (
        "Same video, other title"
    )


def test_embed_id_is_read_from_every_url_form() -> None:
    forms = [
        "https://www.youtube.com/watch?v=D4LHhnSLhro&t=3",
        "https://youtu.be/D4LHhnSLhro",
        "https://www.youtube.com/embed/D4LHhnSLhro",
        "https://www.youtube-nocookie.com/embed/D4LHhnSLhro",
        "https://www.youtube.com/shorts/D4LHhnSLhro",
    ]
    for url in forms:
        row = Media(song_number=1, kind="video", provider="youtube", title="x", url=url)
        assert youtube_embed_id(row) == "D4LHhnSLhro", url
    other = Media(
        song_number=1, kind="video", provider="vimeo", title="x", url="https://vimeo.com/1"
    )
    assert youtube_embed_id(other) is None
    assert media_identity(other) == ("video", "https://vimeo.com/1")


def test_a_database_rejection_removes_a_bundled_video() -> None:
    snapshot = [video("D4LHhnSLhro", status="verified")]
    database = [video("D4LHhnSLhro", status="rejected")]
    assert merge_media(snapshot, database) == []


def test_identical_audio_urls_collapse() -> None:
    a = audio("Same")
    b = audio("Same")
    assert len(merge_media([a], [b])) == 1


# --- order and "Best" -------------------------------------------------------------------------


def urls(items: list[Media]) -> list[str]:
    return [item.url for item in items]


def test_order_does_not_depend_on_input_order() -> None:
    items = [
        audio("TOMAKE 10"),
        audio("TOMAKE 2"),
        audio("TOMAKE"),
        audio("TOMAKE (old version)", version="old"),
        audio("TOMAKE low quality"),
        video("aaaaaaaaaaa", title="Tomake - Prabhat Sangeet #7"),
        video("bbbbbbbbbbb", title="Tomake dance performance"),
        video("ccccccccccc", match_score=0.4),
        video("ddddddddddd", match_score=0.9),
    ]
    expected = urls(merge_media(items, []))
    rng = random.Random(5018)
    for _ in range(30):
        shuffled = items[:]
        rng.shuffle(shuffled)
        assert urls(merge_media(shuffled, [])) == expected
    # and the same when the rows arrive from the other source
    assert urls(merge_media([], items[::-1])) == expected


def test_audio_first_then_video_and_demotions_last() -> None:
    ordered = merge_media(
        [
            audio("TOMAKE (old version)", version="old"),
            video("bbbbbbbbbbb", title="Tomake dance performance"),
            video("aaaaaaaaaaa", title="Tomake - Prabhat Sangeet #7"),
            audio("TOMAKE"),
        ],
        [],
    )
    assert [m.kind for m in ordered] == ["audio", "audio", "video", "video"]
    assert ordered[0].title == "TOMAKE"
    assert ordered[1].title == "TOMAKE (old version)"
    assert youtube_embed_id(ordered[2]) == "aaaaaaaaaaa"  # the plain recording before the dance


def test_natural_title_order_plain_file_first() -> None:
    ordered = merge_media([audio("SONG 10"), audio("SONG 2"), audio("SONG")], [])
    assert [m.title for m in ordered] == ["SONG", "SONG 2", "SONG 10"]


def test_higher_match_score_and_primary_flag_rank_first() -> None:
    low = video("aaaaaaaaaaa", match_score=0.5)
    high = video("bbbbbbbbbbb", match_score=0.95)
    assert merge_media([low, high], [])[0] is high
    primary = video("ccccccccccc", match_score=0.1, is_primary=True)
    assert merge_media([low, high, primary], [])[0] is primary


def test_best_is_one_audio_by_the_documented_rule() -> None:
    items = [
        audio("SONG 2"),
        audio("SONG"),
        audio("SONG (old version)", version="old"),
        video("aaaaaaaaaaa"),
    ]
    best = preferred_audio_url(merge_media(items, []))
    assert best == audio("SONG").url  # plain file name, current, first in natural order
    responses = [to_media_item_response(item, latest_url=best) for item in merge_media(items, [])]
    assert [r.title for r in responses if r.is_latest] == ["SONG"]
    assert not any(r.is_latest for r in responses if r.kind == "video")


def test_explicit_primary_decides_best() -> None:
    items = [audio("SONG"), audio("SONG 2", is_primary=True)]
    # same source rank, so the person's flag outranks the file name
    assert preferred_audio_url(merge_media(items, [])) == audio("SONG 2").url


def test_best_is_never_an_old_version_when_a_current_one_exists() -> None:
    items = [audio("A (old version)", version="old"), audio("B")]
    assert preferred_audio_url(merge_media(items, [])) == audio("B").url


# --- the real catalog -------------------------------------------------------------------------


def test_every_song_of_the_catalog_gets_only_accepted_media_in_a_stable_order() -> None:
    reset_catalog_memory()
    by_song: dict[int, list[Media]] = {}
    for item in catalog_media_snapshot():
        by_song.setdefault(int(item.song_number or 0), []).append(item)
    videos = 0
    for number, rows in by_song.items():
        merged = merge_media(rows, [])
        assert all(media_is_accepted(item) for item in merged), number
        assert urls(merged) == urls(merge_media(rows[::-1], [])), number
        ids = [youtube_embed_id(i) for i in merged if i.kind == "video"]
        assert len(ids) == len(set(ids)), number
        audios = [i for i in merged if i.kind == "audio"]
        if audios:
            latest = preferred_audio_url(merged)
            assert latest in {a.url for a in audios}
        videos += len(ids)
    assert videos >= 800
