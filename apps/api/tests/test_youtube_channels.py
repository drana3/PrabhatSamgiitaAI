from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models import Media, Song, UserAccount
from app.models.admin_workflow import YoutubeReviewQueue, YoutubeScanChannel
from app.services.youtube_channels import (
    create_youtube_scan_channel,
    normalize_channel_url,
    scan_youtube_channel,
)


class _ChannelSession:
    def __init__(self) -> None:
        self.channels: list[YoutubeScanChannel] = []
        self.media: list[Media] = []
        self.reviews: list[YoutubeReviewQueue] = []
        self.songs = [
            Song(id=1, number=1, title="Song One", first_line="First line"),
        ]
        self.committed = 0

    def add(self, obj: object) -> None:
        if isinstance(obj, YoutubeScanChannel):
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()
            self.channels.append(obj)
        elif isinstance(obj, Media):
            self.media.append(obj)
        elif isinstance(obj, YoutubeReviewQueue):
            self.reviews.append(obj)

    async def scalar(self, statement):
        entity = statement.column_descriptions[0].get("entity")
        if entity is YoutubeScanChannel and statement.whereclause is not None:
            resolved_id = statement.whereclause.right.value
            for channel in self.channels:
                if channel.channel_id == resolved_id:
                    return channel
        sql = str(statement.compile(compile_kwargs={"literal_binds": True})).casefold()
        if "from songs" in sql:
            return None
        return None

    async def scalars(self, statement):
        sql = str(statement.compile(compile_kwargs={"literal_binds": True})).casefold()
        rows: list[object] = []
        if "from songs" in sql:
            rows = self.songs
        elif "from media" in sql:
            rows = self.media
        elif "from youtube_review_queue" in sql:
            rows = self.reviews
        elif "from youtube_scan_channels" in sql:
            rows = [row for row in self.channels if row.is_active]
        return _ScalarResult(rows)

    async def get(self, model, pk):
        if model is YoutubeScanChannel:
            return next((row for row in self.channels if row.id == pk), None)
        return None

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, row: object) -> None:
        return None


class _ScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


def test_normalize_channel_url_appends_videos_suffix() -> None:
    assert normalize_channel_url("https://www.youtube.com/@AMPS0521spirituality").endswith("/videos")


@pytest.mark.asyncio
async def test_create_channel_rejects_duplicate_active_channel() -> None:
    session = _ChannelSession()
    creator = UserAccount(id=uuid4(), email="admin@example.com", display_name="Admin")
    with patch(
        "app.services.youtube_channels.resolve_channel_id",
        return_value="UCzJy4vdGKx6gzP782-5buOQ",
    ):
        await create_youtube_scan_channel(
            session,  # type: ignore[arg-type]
            creator=creator,
            name="AMPS",
            channel_url="https://www.youtube.com/@AMPS0521spirituality",
        )
        with pytest.raises(HTTPException) as exc:
            await create_youtube_scan_channel(
                session,  # type: ignore[arg-type]
                creator=creator,
                name="AMPS duplicate",
                channel_url="https://www.youtube.com/@AMPS0521spirituality",
            )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_scan_skips_known_and_queues_new_videos() -> None:
    session = _ChannelSession()
    channel = YoutubeScanChannel(
        id=uuid4(),
        name="AMPS",
        channel_id="UCzJy4vdGKx6gzP782-5buOQ",
        channel_url="https://www.youtube.com/@AMPS0521spirituality/videos",
        is_trusted=True,
        is_active=True,
    )
    session.channels.append(channel)
    session.media.append(
        Media(
            id=1,
            song_number=1,
            kind="video",
            provider="youtube",
            title="Existing",
            url="https://www.youtube.com/watch?v=known123",
            metadata_json={"external_id": "known123"},
        )
    )

    videos = [
        {"video_id": "known123", "title": "Prabhat Samgiita Song Number 1"},
        {"video_id": "new999", "title": "Prabhat Samgiita random title"},
    ]

    with patch("app.services.youtube_channels.channel_videos", return_value=videos):
        result = await scan_youtube_channel(session, channel.id)  # type: ignore[arg-type]

    assert result["discovered"] == 2
    assert result["already_known"] == 1
    assert result["new_queued_for_review"] == 1
    assert len(session.reviews) == 1
    assert session.reviews[0].external_id == "new999"
