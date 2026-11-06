"""Recording categories, the extra fields, and the team exemption from the daily limit.

Dada's decisions: one mantra only (no mantra groups, no mantra endpoints), four categories
(Kiirtan, Bhajan, Devotional song, Prabhat Samgiita), a required performer, and no daily limit
for the team so a bulk upload is never stopped. The fixtures come from test_recordings.py.
"""

# ruff: noqa: F811
from __future__ import annotations

import os
from datetime import datetime

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
from sqlalchemy import select
from test_recordings import (  # noqa: F401  (fixtures are used by name)
    MEMBER_A,
    World,
    file_world,
    mp3,
    world,
)

from app.models.member import UserAccount
from app.models.recordings import RECORDING_KINDS, Recording
from app.schemas.recordings import RecordingCreate

AS_A = {"X-Test-Member": "a"}


def test_there_are_four_categories() -> None:
    assert RECORDING_KINDS == ("kiirtan", "bhajan", "devotional_song", "prabhat_samgiita")


async def test_every_category_can_be_published(world: World) -> None:
    for number, kind in enumerate(("kiirtan", "bhajan", "devotional_song")):
        response = await world.publish("a", mp3(300 + number), kind=kind, title=f"Song {kind}")
        assert response.status_code == 201, response.text
        assert response.json()["kind"] == kind
        assert response.json()["type"] == "other"
        assert response.json()["ps_song_number"] is None
    ps = await world.publish(
        "a", mp3(310), kind="prabhat_samgiita", title="Bandhu hate", ps_song_number=1
    )
    assert ps.status_code == 201, ps.text
    assert ps.json()["kind"] == "prabhat_samgiita" and ps.json()["ps_song_number"] == 1


async def test_a_prabhat_samgiita_recording_needs_a_valid_song_number(world: World) -> None:
    for bad in (None, 0, -3, 5019):
        extra = {} if bad is None else {"ps_song_number": bad}
        response = await world.publish("a", mp3(320), kind="prabhat_samgiita", **extra)
        assert response.status_code == 422, (bad, response.text)
    assert (
        await world.publish("a", mp3(321), kind="prabhat_samgiita", ps_song_number=5018)
    ).status_code == 201


async def test_a_song_number_is_refused_for_the_other_categories(world: World) -> None:
    for kind in ("kiirtan", "bhajan", "devotional_song"):
        response = await world.publish("a", mp3(330), kind=kind, ps_song_number=7)
        assert response.status_code == 422, (kind, response.text)


async def test_the_performer_is_required(world: World) -> None:
    for author in ("", "   "):
        response = await world.publish("a", mp3(340), author=author)
        assert response.status_code == 422, (author, response.text)
    missing = world.body("k")
    missing.pop("author")
    with pytest.raises(ValueError):
        RecordingCreate(**missing)


async def test_the_new_fields_are_stored_and_returned(world: World) -> None:
    response = await world.publish(
        "a",
        mp3(350),
        kind="devotional_song",
        title="Tumi amar",
        language="bengali",
        credits="Words and music by A. Sen",
        year=1998,
        notes="Recorded at the retreat",
    )
    assert response.status_code == 201, response.text
    item = response.json()
    assert item["language"] == "bengali"
    assert item["credits"] == "Words and music by A. Sen"
    assert item["year"] == 1998
    assert item["notes"] == "Recorded at the retreat"
    assert item["author"] == "Sample group"
    row = await world.scalar(select(Recording))
    assert row is not None and row.language == "bengali" and row.year == 1998
    # they are optional
    plain = await world.publish("a", mp3(351), title="Plain")
    assert plain.status_code == 201
    assert plain.json()["language"] is None and plain.json()["year"] is None


async def test_the_language_must_be_one_of_the_list(world: World) -> None:
    for n, language in enumerate(("bengali", "sanskrit", "hindi", "english", "other")):
        ok = await world.publish("a", mp3(500 + n * 7), language=language, title=f"L {language}")
        assert ok.status_code == 201, (language, ok.text)
    assert (await world.publish("a", mp3(361), language="klingon")).status_code == 422


async def test_the_year_cannot_be_in_the_future_or_before_1900(world: World) -> None:
    next_year = datetime.now().year + 1
    for bad in (1899, 0, next_year):
        assert (await world.publish("a", mp3(370), year=bad)).status_code == 422, bad
    assert (await world.publish("a", mp3(371), year=datetime.now().year)).status_code == 201


async def test_the_length_of_credits_and_notes_is_limited(world: World) -> None:
    assert (await world.publish("a", mp3(380), credits="x" * 301)).status_code == 422
    assert (await world.publish("a", mp3(381), notes="x" * 501)).status_code == 422


async def test_the_list_is_filtered_by_category_and_by_song(world: World) -> None:
    await world.publish("a", mp3(390), kind="kiirtan", title="K one")
    await world.publish("a", mp3(391), kind="bhajan", title="B one")
    await world.publish("a", mp3(392), kind="devotional_song", title="D one")
    await world.publish("a", mp3(393), kind="prabhat_samgiita", title="P1 a", ps_song_number=1)
    await world.publish("a", mp3(394), kind="prabhat_samgiita", title="P1 b", ps_song_number=1)
    await world.publish("a", mp3(395), kind="prabhat_samgiita", title="P2", ps_song_number=2)

    async def titles(**params: object) -> list[str]:
        data = (await world.client.get("/api/v1/recordings", params=params)).json()
        return sorted(item["title"] for item in data["items"])

    assert len(await titles()) == 6
    assert await titles(kind="kiirtan") == ["K one"]
    assert await titles(kind="devotional_song") == ["D one"]
    assert await titles(kind="prabhat_samgiita") == ["P1 a", "P1 b", "P2"]
    assert await titles(kind="prabhat_samgiita", song_number=1) == ["P1 a", "P1 b"]
    assert await titles(song_number=2) == ["P2"]
    bad = await world.client.get("/api/v1/recordings", params={"song_number": 5019})
    assert bad.status_code == 422
    bad_kind = await world.client.get("/api/v1/recordings", params={"kind": "mantra"})
    assert bad_kind.status_code == 422


async def test_the_mantra_endpoints_are_gone(world: World) -> None:
    for path in ("/mantras", "/mantras/suggest", "/mantras/lookup", "/mantras/1"):
        response = await world.client.get(f"/api/v1/recordings{path}")
        # "/mantras" now reads as a recording id, so it is refused as a bad id, not served
        assert response.status_code in (404, 422), (path, response.status_code)
    from app.api.v1 import recordings as api

    paths = [getattr(route, "path", "") for route in api.router.routes + api.admin_router.routes]
    assert not [path for path in paths if "mantra" in path]
    merge = await world.client.post(
        "/api/v1/admin/recordings/mantras/merge", json={"source_id": 1, "target_id": 2}
    )
    assert merge.status_code in (404, 405)
    item = (await world.publish("a", mp3(400))).json()
    assert "mantra_title" not in item and "mantra_group_id" not in item


async def _make_admin(world: World, **flags: object) -> None:
    async with world.sessions() as session:
        member = await session.get(UserAccount, MEMBER_A)
        assert member is not None
        for name, value in flags.items():
            setattr(member, name, value)
        await session.commit()


async def test_the_team_has_no_daily_limit(world: World) -> None:
    world.settings.recording_uploads_per_day = 2
    await _make_admin(world, is_admin=True)
    for n in range(5):
        response = await world.publish("a", mp3(410 + n), title=f"Team chant {n}")
        assert response.status_code == 201, (n, response.text)
    # ... and member B, who is not in the team, is still limited
    world.settings.recording_uploads_per_day = 1
    assert (await world.publish("b", mp3(420), title="B one")).status_code == 201
    refused = await world.client.post(
        "/api/v1/recordings/uploads",
        headers={"X-Test-Member": "b"},
        json={"file_name": "x.mp3", "content_type": "audio/mpeg", "size_bytes": 100},
    )
    assert refused.status_code == 429
    assert refused.headers["X-Error-Code"] == "upload_daily_limit"


async def test_a_super_admin_and_an_owner_email_are_the_team_too(world: World) -> None:
    from app.services import recordings as service

    async with world.sessions() as session:
        member = await session.get(UserAccount, MEMBER_A)
        assert member is not None
        assert service.is_team_member(member, world.settings) is False
        member.is_super_admin = True
        assert service.is_team_member(member, world.settings) is True
        member.is_super_admin = False
        member.email = "owner@example.org"
        world.settings.default_admin_emails = "Owner@Example.org"
        assert service.is_team_member(member, world.settings) is True
        member.email = None
        assert service.is_team_member(member, world.settings) is False


async def test_the_team_is_also_not_stopped_when_publishing(world: World) -> None:
    world.settings.recording_uploads_per_day = 1
    await _make_admin(world, is_admin=True)
    keys = [await world.upload("a", mp3(430 + n)) for n in range(3)]
    for n, key in enumerate(keys):
        response = await world.client.post(
            "/api/v1/recordings", headers=AS_A, json=world.body(key, title=f"Bulk {n}")
        )
        assert response.status_code == 201, (n, response.text)
