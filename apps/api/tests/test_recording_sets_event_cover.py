"""Event playlists, simplified: a title, a place, an approximate date (year and month), an optional
cover picture. Pins the rules in docs/kiirtan-sets.md ("What a playlist asks for").

Fixtures come from test_recordings.py.
"""

# ruff: noqa: F811
from __future__ import annotations

import os
import struct
from datetime import UTC, date, datetime

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
from test_recording_sets import AS_A, AS_B, SETS, add_track, detail, make_set
from test_recordings import World, mp3, world  # noqa: F401

from app.services.image_clean import ImageError, clean_image

YEAR = datetime.now(UTC).year


def jpeg(*, exif: bool = True, comment: bool = True, pixels: bytes = b"\x00\x11\x22" * 50) -> bytes:
    jfif = b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    out = b"\xff\xd8" + jfif
    if exif:
        body = b"Exif\x00\x00GPSLatitude=50.06;GPSLongitude=19.94"
        out += b"\xff\xe1" + struct.pack(">H", len(body) + 2) + body
        xmp = b"http://ns.adobe.com/xap/1.0/\x00<x:xmpmeta owner='someone'/>"
        out += b"\xff\xe1" + struct.pack(">H", len(xmp) + 2) + xmp
    if comment:
        note = b"shot by Someone"
        out += b"\xff\xfe" + struct.pack(">H", len(note) + 2) + note
    out += b"\xff\xdb" + struct.pack(">H", 4) + b"\x00\x01"
    out += b"\xff\xda" + struct.pack(">H", 2) + pixels + b"\xff\xd9"
    return out


def png(*, text: bool = True) -> bytes:
    def chunk(kind: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + kind + body + b"\x00\x00\x00\x00"

    out = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", b"\x00" * 13)
    if text:
        out += chunk(b"tEXt", b"Author\x00Someone") + chunk(b"eXIf", b"MM\x00*GPS")
    return out + chunk(b"IDAT", b"pixels") + chunk(b"IEND", b"")


def webp(*, exif: bool = True) -> bytes:
    def chunk(kind: bytes, body: bytes) -> bytes:
        return kind + struct.pack("<I", len(body)) + body + (b"\x00" if len(body) & 1 else b"")

    flags = 0x08 if exif else 0
    parts = chunk(b"VP8X", bytes([flags]) + b"\x00" * 9) + chunk(b"VP8 ", b"pixels!")
    if exif:
        parts += chunk(b"EXIF", b"GPS here")
    return b"RIFF" + struct.pack("<I", len(parts) + 4) + b"WEBP" + parts


# --------------------------------------------------------------------------- the picture itself


def test_a_jpeg_loses_exif_xmp_and_comments_but_keeps_the_picture() -> None:
    mime, clean = clean_image(jpeg())
    assert mime == "image/jpeg"
    assert b"GPS" not in clean and b"Exif" not in clean and b"xmpmeta" not in clean
    assert b"Someone" not in clean
    assert b"JFIF" in clean and clean.endswith(b"\xff\xd9") and b"\x00\x11\x22" * 50 in clean


def test_png_and_webp_lose_their_metadata_too() -> None:
    mime, clean = clean_image(png())
    assert mime == "image/png" and b"GPS" not in clean and b"Someone" not in clean
    assert b"IDAT" in clean and b"IEND" in clean
    mime, clean = clean_image(webp())
    assert mime == "image/webp" and b"GPS" not in clean and b"EXIF" not in clean
    assert clean[:4] == b"RIFF" and struct.unpack("<I", clean[4:8])[0] == len(clean) - 8
    assert clean[20] & 0x08 == 0  # the VP8X flag for Exif is cleared
    assert b"VP8 " in clean


def test_what_is_not_a_small_jpeg_png_or_webp_is_refused() -> None:
    for data, code in (
        (b"", "photo_empty"),
        (b"GIF89a....", "photo_type"),
        (b"%PDF-1.4", "photo_type"),
    ):
        with pytest.raises(ImageError) as error:
            clean_image(data)
        assert error.value.code == code
    with pytest.raises(ImageError) as big:
        clean_image(jpeg(pixels=b"\x00" * (300 * 1024)))
    assert big.value.code == "photo_too_big" and big.value.status == 413
    with pytest.raises(ImageError) as broken:
        clean_image(b"\xff\xd8\xff\xe1\xff\xff")
    assert broken.value.code == "photo_corrupt"


# --------------------------------------------------------------------------- the date


async def test_a_playlist_is_made_from_a_year_and_a_month(world: World) -> None:
    made = await world.client.post(
        SETS, headers=AS_A, json={"title": "Summer retreat", "event_year": 2024, "event_month": 8}
    )
    assert made.status_code == 201, made.text
    item = made.json()
    assert (item["event_year"], item["event_month"]) == (2024, 8)
    assert item["starts_on"] == "2024-08-01" and item["ends_on"] is None
    assert item["place"] is None and item["cover_url"] is None


async def test_the_month_is_optional_and_the_day_falls_on_the_first_of_january(
    world: World,
) -> None:
    item = await make_set(world, title="Old tape", starts_on=None, ends_on=None, event_year=1998)
    assert (item["event_year"], item["event_month"]) == (1998, None)
    assert item["starts_on"] == "1998-01-01"


async def test_year_and_month_are_checked(world: World) -> None:
    body = {"title": "T"}
    for extra in (
        {"event_year": 1850},
        {"event_year": YEAR + 1},
        {"event_year": 2020, "event_month": 0},
        {"event_year": 2020, "event_month": 13},
        {},
    ):
        response = await world.client.post(SETS, headers=AS_A, json=body | extra)
        assert response.status_code == 422, extra
    # this year, a month that has not started yet, is in the future
    if date.today().month < 12:
        later = {"event_year": YEAR, "event_month": date.today().month + 1}
        assert (await world.client.post(SETS, headers=AS_A, json=body | later)).status_code == 422


async def test_an_older_app_that_sends_a_day_still_works_and_the_year_and_month_follow(
    world: World,
) -> None:
    made = await world.client.post(
        SETS,
        headers=AS_A,
        json={"title": "Old app", "starts_on": "2023-05-12", "ends_on": "2023-05-14"},
    )
    assert made.status_code == 201, made.text
    item = made.json()
    assert (item["event_year"], item["event_month"]) == (2023, 5)
    assert item["starts_on"] == "2023-05-12" and item["ends_on"] == "2023-05-14"


async def test_changing_the_year_or_month_moves_the_day_and_drops_the_old_range(
    world: World,
) -> None:
    item = await make_set(world, starts_on="2023-05-12", ends_on="2023-05-14")
    url = f"{SETS}/{item['id']}"
    moved = await world.client.patch(
        url, headers=AS_A, json={"event_year": 2022, "event_month": 11}
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["starts_on"] == "2022-11-01" and moved.json()["ends_on"] is None
    only_month = await world.client.patch(url, headers=AS_A, json={"event_month": 3})
    assert (only_month.json()["event_year"], only_month.json()["event_month"]) == (2022, 3)
    forgot = await world.client.patch(url, headers=AS_A, json={"event_month": None})
    assert forgot.json()["event_month"] is None and forgot.json()["starts_on"] == "2022-01-01"
    bad = await world.client.patch(url, headers=AS_A, json={"event_year": 1800})
    assert bad.status_code == 422
    # a title edit leaves the date alone
    titled = await world.client.patch(url, headers=AS_A, json={"title": "New name"})
    assert titled.json()["starts_on"] == "2022-01-01" and titled.json()["title"] == "New name"


# --------------------------------------------------------------------------- the cover


async def put_cover(world: World, set_id: str, data: bytes, who: dict[str, str] = AS_A):  # noqa: ANN201
    return await world.client.put(
        f"{SETS}/{set_id}/cover",
        headers=who | {"Content-Type": "application/octet-stream"},
        content=data,
    )


async def test_the_owner_adds_a_cover_that_is_stripped_shown_and_removable(world: World) -> None:
    item = await make_set(world)
    assert item["cover_url"] is None
    saved = await put_cover(world, item["id"], jpeg())
    assert saved.status_code == 200, saved.text
    url = saved.json()["cover_url"]
    assert url.startswith(f"/api/v1/recording-sets/{item['id']}/cover?v=")
    # a draft (no live track yet) is the owner's business
    assert (await world.client.get(f"{SETS}/{item['id']}/cover")).status_code == 404
    mine = await world.client.get(f"{SETS}/{item['id']}/cover", headers=AS_A)
    assert mine.status_code == 200 and mine.headers["content-type"] == "image/jpeg"
    assert b"GPS" not in mine.content and b"Exif" not in mine.content
    assert mine.headers["x-content-type-options"] == "nosniff"
    assert (await add_track(world, item["id"], 1)).status_code == 201
    anyone = await world.client.get(f"{SETS}/{item['id']}/cover")
    assert anyone.status_code == 200 and anyone.content == mine.content
    assert (await detail(world, item["id"], None)).json()["cover_url"] == url
    # a new picture changes the address, so the old one is not cached
    again = await put_cover(world, item["id"], png())
    assert again.json()["cover_url"] != url
    removed = await world.client.delete(f"{SETS}/{item['id']}/cover", headers=AS_A)
    assert removed.status_code == 200 and removed.json()["cover_url"] is None
    assert (await world.client.get(f"{SETS}/{item['id']}/cover", headers=AS_A)).status_code == 404


async def test_a_cover_is_for_the_owner_only_and_must_be_a_small_picture(world: World) -> None:
    item = await make_set(world)
    assert (await put_cover(world, item["id"], jpeg(), AS_B)).status_code == 403
    assert (await world.client.put(f"{SETS}/{item['id']}/cover", content=jpeg())).status_code == 401
    assert (
        await world.client.delete(f"{SETS}/{item['id']}/cover", headers=AS_B)
    ).status_code == 403
    assert (await put_cover(world, item["id"], b"")).status_code == 422
    assert (await put_cover(world, item["id"], b"not a picture")).status_code == 415
    big = await put_cover(world, item["id"], jpeg(pixels=b"\x00" * (301 * 1024)))
    assert big.status_code == 413
    huge = await put_cover(world, item["id"], b"\xff\xd8\xff" + b"\x00" * (700 * 1024))
    assert huge.status_code == 413
    assert (await world.client.get(f"{SETS}/{item['id']}", headers=AS_A)).json()[
        "cover_url"
    ] is None


async def test_a_removed_playlist_hides_its_cover_from_everyone_but_its_owner(world: World) -> None:
    item = await make_set(world)
    await put_cover(world, item["id"], jpeg())
    assert (await add_track(world, item["id"], 2)).status_code == 201
    taken = await world.client.post(
        f"/api/v1/admin/recording-sets/{item['id']}/remove", json={"reason": "not ours"}
    )
    assert taken.status_code == 200, taken.text
    assert (await world.client.get(f"{SETS}/{item['id']}/cover")).status_code == 404
    assert (await world.client.get(f"{SETS}/{item['id']}/cover", headers=AS_A)).status_code == 200


async def test_the_teams_own_cover_link_still_shows_until_a_picture_is_uploaded(
    world: World,
) -> None:
    item = await make_set(world, cover_url="https://example.org/cover.jpg")
    assert item["cover_url"] == "https://example.org/cover.jpg"
    saved = await put_cover(world, item["id"], jpeg())
    assert saved.json()["cover_url"].startswith("/api/v1/recording-sets/")
    gone = await world.client.delete(f"{SETS}/{item['id']}/cover", headers=AS_A)
    assert gone.json()["cover_url"] == "https://example.org/cover.jpg"


async def test_deleting_a_playlist_deletes_its_picture(world: World) -> None:
    from sqlalchemy import func, select

    from app.models.recording_collections import RecordingCollectionCover

    item = await make_set(world)
    await put_cover(world, item["id"], jpeg())
    gone = await world.client.delete(f"{SETS}/{item['id']}", headers=AS_A)
    assert gone.status_code == 204
    async with world.sessions() as session:
        count = await session.scalar(select(func.count()).select_from(RecordingCollectionCover))
    assert count == 0
