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
    resolve_channel_id,
    scan_youtube_channel,
    seed_default_youtube_scan_channels,
    update_youtube_scan_channel,
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
            if any(row.external_id == obj.external_id for row in self.reviews):
                from sqlalchemy.exc import IntegrityError

                raise IntegrityError(
                    "duplicate key value violates unique constraint "
                    '"youtube_review_queue_external_id_key"',
                    params={"external_id": obj.external_id},
                    orig=Exception(obj.external_id),
                )
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
            entity = statement.column_descriptions[0].get("entity")
            if entity is YoutubeReviewQueue:
                rows = list(self.reviews)
            else:
                rows = [review.external_id for review in self.reviews]
        elif "from youtube_scan_channels" in sql:
            rows = [row for row in self.channels if row.is_active]
        return _ScalarResult(rows)

    async def get(self, model, pk):
        if model is YoutubeScanChannel:
            return next((row for row in self.channels if row.id == pk), None)
        return None

    async def commit(self) -> None:
        self.committed += 1

    async def execute(self, statement):
        sql = str(statement.compile(compile_kwargs={"literal_binds": True})).casefold()
        if "from media" in sql:
            rows = [(media.metadata_json, media.url) for media in self.media]
            return _ExecuteResult(rows)
        if "from songs" in sql:
            rows = [(song.number, song.title, song.first_line) for song in self.songs]
            return _ExecuteResult(rows)
        from sqlalchemy.exc import SQLAlchemyError

        raise SQLAlchemyError("catalog refresh uses a real database session")

    async def rollback(self) -> None:
        return None

    async def refresh(self, row: object) -> None:
        return None


class _ScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _ExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


def test_normalize_channel_url_appends_videos_suffix() -> None:
    assert normalize_channel_url("https://www.youtube.com/@AMPS0521spirituality").endswith("/videos")


def test_normalize_channel_url_strips_share_query() -> None:
    assert (
        normalize_channel_url("https://youtube.com/@rawaassam?si=T2RuytzMRqfsPuQe")
        == "https://youtube.com/@rawaassam/videos"
    )


def test_resolve_channel_id_from_amps_handle() -> None:
    channel_id = resolve_channel_id("https://youtube.com/@AMPS0521spirituality")
    assert channel_id == "UCzJy4vdGKx6gzP782-5buOQ"


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
async def test_update_channel_changes_name_and_reactivates() -> None:
    session = _ChannelSession()
    channel = YoutubeScanChannel(
        id=uuid4(),
        name="Old name",
        channel_id="UCzJy4vdGKx6gzP782-5buOQ",
        channel_url="https://www.youtube.com/@AMPS0521spirituality/videos",
        is_trusted=True,
        is_active=False,
    )
    session.channels.append(channel)

    updated = await update_youtube_scan_channel(
        session,  # type: ignore[arg-type]
        channel.id,
        name="AMPS Spirituality",
        is_active=True,
    )

    assert updated.name == "AMPS Spirituality"
    assert updated.is_active is True
    assert session.committed == 1


@pytest.mark.asyncio
async def test_create_channel_stores_number_source() -> None:
    session = _ChannelSession()
    creator = UserAccount(id=uuid4(), email="admin@example.com", display_name="Admin")
    with patch(
        "app.services.youtube_channels.resolve_channel_id",
        return_value="UCdescription",
    ):
        row = await create_youtube_scan_channel(
            session,  # type: ignore[arg-type]
            creator=creator,
            name="Description channel",
            channel_url="https://www.youtube.com/@descchannel",
            number_source="description",
        )
    assert row.number_source == "description"


@pytest.mark.asyncio
async def test_create_channel_rejects_invalid_number_source() -> None:
    session = _ChannelSession()
    creator = UserAccount(id=uuid4(), email="admin@example.com", display_name="Admin")
    with patch(
        "app.services.youtube_channels.resolve_channel_id",
        return_value="UCbad",
    ):
        with pytest.raises(HTTPException) as exc:
            await create_youtube_scan_channel(
                session,  # type: ignore[arg-type]
                creator=creator,
                name="Bad",
                channel_url="https://www.youtube.com/@bad",
                number_source="subtitle",
            )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_scan_description_channel_links_number_from_description() -> None:
    session = _ChannelSession()
    channel = YoutubeScanChannel(
        id=uuid4(),
        name="Description channel",
        channel_id="UCdescription",
        channel_url="https://www.youtube.com/channel/UCdescription/videos",
        number_source="description",
        is_trusted=True,
        is_active=True,
    )
    session.channels.append(channel)

    videos = [{"video_id": "descvid1", "title": "Prabhat Samgiita morning melody"}]

    with (
        patch("app.services.youtube_channels.channel_videos", return_value=videos),
        patch(
            "scripts.sync_youtube.fetch_video_description",
            return_value="Prabhat Samgiita No. 1 - devotional",
        ),
    ):
        result = await scan_youtube_channel(session, channel.id)  # type: ignore[arg-type]

    assert result["new_auto_linked"] == 1
    assert len(session.media) == 1
    assert session.media[-1].song_number == 1


@pytest.mark.asyncio
async def test_seed_default_channels_inserts_both() -> None:
    session = _ChannelSession()
    creator = UserAccount(id=uuid4(), email="admin@example.com", display_name="Admin")

    rows = await seed_default_youtube_scan_channels(session, creator=creator)  # type: ignore[arg-type]

    assert len(rows) == 2
    assert {row.channel_id for row in rows} == {
        "UCzJy4vdGKx6gzP782-5buOQ",
        "UCc3f8g07me5NpqHfAsF8GIA",
    }
    assert all(row.is_active for row in rows)


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
        {"video_id": "skip000", "title": "Morning meditation and kiirtan"},
    ]

    with patch("app.services.youtube_channels.channel_videos", return_value=videos):
        result = await scan_youtube_channel(session, channel.id)  # type: ignore[arg-type]

    assert result["discovered"] == 3
    assert result["already_known"] == 1
    assert result["new_queued_for_review"] == 1
    assert len(session.reviews) == 1
    assert session.reviews[0].external_id == "new999"


@pytest.mark.asyncio
async def test_scan_auto_links_pending_review_with_ellipsis_number() -> None:
    session = _ChannelSession()
    channel = YoutubeScanChannel(
        id=uuid4(),
        name="Manas Rawa",
        channel_id="UCPEe8JPgsVkC77PHrioTa5g",
        channel_url="https://www.youtube.com/@rawaassam/videos",
        number_source="description",
        is_trusted=True,
        is_active=True,
    )
    session.channels.append(channel)
    pending = YoutubeReviewQueue(
        external_id="pending2065",
        title="PRABHAT SAMGIITA || TUMI KON ATITE MORE || MANAS",
        url="https://www.youtube.com/watch?v=pending2065",
        channel_id=channel.channel_id,
        channel_name=channel.name,
        status="pending_review",
        review_reason="missing_explicit_song_number",
    )
    session.reviews.append(pending)
    session.songs.append(
        Song(id=2065, number=2065, title="KON ATIITE MORE", first_line="Tumi kon atiite")
    )

    videos = [
        {"video_id": "pending2065", "title": "PRABHAT SAMGIITA || TUMI KON ATITE MORE || MANAS"},
    ]

    with (
        patch("app.services.youtube_channels.channel_videos", return_value=videos),
        patch(
            "scripts.sync_youtube.fetch_video_description",
            return_value="PRABHAT SAMGIIT\nTUMI KON ATITE MORE ..2065\n",
        ),
    ):
        result = await scan_youtube_channel(session, channel.id)  # type: ignore[arg-type]

    assert result["new_auto_linked"] == 1
    assert result["new_queued_for_review"] == 0
    assert session.media[-1].song_number == 2065
    assert pending.status == "approved"


@pytest.mark.asyncio
async def test_scan_does_not_reinsert_existing_review_ids() -> None:
    session = _ChannelSession()
    channel = YoutubeScanChannel(
        id=uuid4(),
        name="Manas Rawa",
        channel_id="UCPEe8JPgsVkC77PHrioTa5g",
        channel_url="https://www.youtube.com/@rawaassam/videos",
        number_source="title",
        is_trusted=True,
        is_active=True,
    )
    session.channels.append(channel)
    existing = YoutubeReviewQueue(
        external_id="hvOBmYpP8fA",
        title="PRABHAT SAMGIITA || TUMI AMAR PRIYO SOBAR PRIYO",
        url="https://www.youtube.com/watch?v=hvOBmYpP8fA",
        channel_id="legacy-channel-id",
        status="dismissed",
        review_reason="missing_explicit_song_number",
    )
    session.reviews.append(existing)

    videos = [
        {
            "video_id": "hvOBmYpP8fA",
            "title": "PRABHAT SAMGIITA || TUMI AMAR PRIYO SOBAR PRIYO",
        },
        {"video_id": "brandNew99", "title": "Prabhat Samgiita untitled new video"},
    ]

    with (
        patch("app.services.youtube_channels.channel_videos", return_value=videos),
        patch("scripts.sync_youtube.fetch_video_description", return_value=""),
    ):
        result = await scan_youtube_channel(session, channel.id)  # type: ignore[arg-type]

    assert result["new_queued_for_review"] == 1
    assert result["already_queued"] == 1
    assert {row.external_id for row in session.reviews} == {"hvOBmYpP8fA", "brandNew99"}
    assert existing.status == "dismissed"


@pytest.mark.asyncio
async def test_scan_auto_links_dismissed_review_with_ellipsis_number() -> None:
    session = _ChannelSession()
    channel = YoutubeScanChannel(
        id=uuid4(),
        name="Manas Rawa",
        channel_id="UCPEe8JPgsVkC77PHrioTa5g",
        channel_url="https://www.youtube.com/@rawaassam/videos",
        number_source="description",
        is_trusted=True,
        is_active=True,
    )
    session.channels.append(channel)
    dismissed = YoutubeReviewQueue(
        external_id="KqHHEov2QaE",
        title="PRABHAT SAMGIITA || TUMI KON ATITE MORE || MANAS",
        url="https://www.youtube.com/watch?v=KqHHEov2QaE",
        channel_id="legacy-channel-id",
        status="dismissed",
        review_reason="missing_explicit_song_number",
    )
    session.reviews.append(dismissed)
    session.songs.append(
        Song(id=2065, number=2065, title="KON ATIITE MORE", first_line="Tumi kon atiite")
    )

    videos = [
        {
            "video_id": "KqHHEov2QaE",
            "title": "PRABHAT SAMGIITA || TUMI KON ATITE MORE || MANAS",
        },
    ]

    with (
        patch("app.services.youtube_channels.channel_videos", return_value=videos),
        patch(
            "scripts.sync_youtube.fetch_video_description",
            return_value="PRABHAT SAMGIIT\nTUMI KON ATITE MORE ..2065\n",
        ),
    ):
        result = await scan_youtube_channel(session, channel.id)  # type: ignore[arg-type]

    assert result["new_auto_linked"] == 1
    assert result["new_queued_for_review"] == 0
    assert len(session.reviews) == 1
    assert session.media[-1].song_number == 2065
    assert dismissed.status == "approved"


@pytest.mark.asyncio
async def test_scan_auto_links_queued_title_channel_from_description() -> None:
    session = _ChannelSession()
    channel = YoutubeScanChannel(
        id=uuid4(),
        name="MANAS RAWA ASSAM",
        channel_id="UCPEe8JPgsVkC77PHrioTa5g",
        channel_url="https://www.youtube.com/@rawaassam/videos",
        number_source="title",
        is_trusted=True,
        is_active=True,
        last_scanned_at=None,
    )
    session.channels.append(channel)
    pending = YoutubeReviewQueue(
        external_id="KqHHEov2QaE",
        title="PRABHAT SAMGIITA || TUMI KON ATITE MORE || MANAS",
        url="https://www.youtube.com/watch?v=KqHHEov2QaE",
        channel_id=channel.channel_id,
        channel_name=channel.name,
        status="pending_review",
        review_reason="missing_explicit_song_number",
    )
    session.reviews.append(pending)
    session.songs.append(
        Song(id=2065, number=2065, title="KON ATIITE MORE", first_line="Tumi kon atiite")
    )

    with (
        patch("app.services.youtube_channels.channel_videos", return_value=[]),
        patch(
            "scripts.sync_youtube.fetch_video_description",
            return_value="PRABHAT SAMGIIT\nTUMI KON ATITE MORE ..2065\n",
        ),
    ):
        result = await scan_youtube_channel(session, channel.id)  # type: ignore[arg-type]

    assert result["new_auto_linked"] == 1
    assert result["already_queued"] == 0
    assert pending.status == "approved"
    assert session.media[-1].song_number == 2065
