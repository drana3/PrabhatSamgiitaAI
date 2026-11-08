"""The type of recording, the tempo, solo or group, and the English-only title of a Kiirtan.
Pins docs/kiirtan-recording-info.md (the lists match the phone and anandamarga.org/music).
"""

# ruff: noqa: F811
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
from test_recording_sets import AS_A, SETS, add_track
from test_recordings import World, mp3, world  # noqa: F401

from app.schemas.recordings import RecordingCreate
from app.services.recording_info import (
    PERFORMANCES,
    RECORDING_TYPES,
    TEMPOS,
    has_non_latin_letters,
    normalize_performance,
    normalize_recording_type,
    normalize_tempo,
)


def test_the_lists_are_the_ones_the_phone_uses() -> None:
    assert RECORDING_TYPES == ("studio", "live", "home", "ai")
    assert TEMPOS == ("slow", "medium", "fast")
    assert PERFORMANCES == ("solo", "group")
    assert normalize_recording_type(" AI ") == "ai"
    assert normalize_tempo("") is None and normalize_performance(None) is None
    with pytest.raises(ValueError, match="how this was recorded"):
        normalize_recording_type("tape")
    with pytest.raises(ValueError, match="tempo"):
        normalize_tempo("presto")
    with pytest.raises(ValueError, match="solo or group"):
        normalize_performance("duet")


def test_latin_letters_with_accents_pass_and_other_scripts_do_not() -> None:
    assert not has_non_latin_letters("Bábá Nám Kevalam – Śiva, 2nd take (live)")
    assert not has_non_latin_letters("")
    assert has_non_latin_letters("Баба Нам Кевалам")
    assert has_non_latin_letters("बाबा नाम केवलम्")
    assert has_non_latin_letters("Baba নাম")


# --------------------------------------------------------------------------- the fields


async def test_a_kiirtan_needs_a_recording_type_and_says_so(world: World) -> None:
    none = await world.publish("a", mp3(2000), recording_type=None)
    assert none.status_code == 422 and "recorded" in none.text.lower()
    wrong = await world.publish("a", mp3(2001), recording_type="tape")
    assert wrong.status_code == 422
    ok = await world.publish(
        "a", mp3(2002), recording_type="live", tempo="fast", performance="group"
    )
    assert ok.status_code == 201, ok.text
    body = ok.json()
    assert (body["recording_type"], body["tempo"], body["performance"]) == ("live", "fast", "group")


async def test_tempo_and_performance_are_optional_for_a_kiirtan(world: World) -> None:
    done = await world.publish("a", mp3(2010), tempo=None, performance=None)
    assert done.status_code == 201
    assert done.json()["tempo"] is None and done.json()["performance"] is None


async def test_an_ai_kiirtan_is_stored_and_shown_as_ai(world: World) -> None:
    made = await world.publish("a", mp3(2020), recording_type="ai")
    assert made.status_code == 201
    rid = made.json()["id"]
    got = (await world.client.get(f"/api/v1/recordings/{rid}")).json()
    assert got["recording_type"] == "ai"
    listed = (await world.client.get("/api/v1/recordings")).json()["items"]
    assert [i["recording_type"] for i in listed] == ["ai"]


async def test_each_category_keeps_only_the_fields_it_carries(world: World) -> None:
    dance = await world.publish(
        "a",
        mp3(2030),
        kind="dance_song",
        dance="tandava",
        recording_type="studio",
        tempo="slow",
        performance="solo",
    )
    assert dance.status_code == 201, dance.text
    assert (dance.json()["recording_type"], dance.json()["tempo"]) == ("studio", "slow")
    assert dance.json()["performance"] is None  # dance music has no solo or group
    bhajan = await world.publish(
        "a",
        mp3(2031),
        kind="bhajan",
        language="hi",
        style=None,
        recording_type="home",
        tempo="fast",
        performance="solo",
    )
    assert bhajan.status_code == 201, bhajan.text
    assert (bhajan.json()["recording_type"], bhajan.json()["performance"]) == ("home", "solo")
    assert bhajan.json()["tempo"] is None
    ps = await world.publish(
        "a",
        mp3(2032),
        kind="prabhat_samgiita",
        ps_song_number=7,
        style=None,
        recording_type="studio",
    )
    assert ps.status_code == 201, ps.text
    assert ps.json()["recording_type"] is None  # not carried by this category


async def test_a_recording_made_by_ai_is_refused_in_a_bhajan_not_dropped(world: World) -> None:
    refused = await world.publish(
        "a", mp3(2040), kind="bhajan", language="hi", style=None, recording_type="ai"
    )
    assert refused.status_code == 422 and "AI" in refused.text
    spiritual = await world.publish(
        "a", mp3(2041), kind="spiritual_song", language="en", style=None, recording_type="ai"
    )
    assert spiritual.status_code == 201 and spiritual.json()["recording_type"] == "ai"


async def test_a_kiirtan_track_of_a_playlist_carries_its_fields(world: World) -> None:
    item = (await world.client.post(SETS, headers=AS_A, json={"title": "Retreat"})).json()
    refused = await add_track(world, item["id"], 2050, recording_type=None)
    assert refused.status_code == 422, refused.text
    ok = await add_track(world, item["id"], 2051, recording_type="live", tempo="medium")
    assert ok.status_code == 201, ok.text
    assert (ok.json()["recording_type"], ok.json()["tempo"]) == ("live", "medium")


# --------------------------------------------------------------------------- the title


async def test_the_title_of_a_kiirtan_is_written_in_english(world: World) -> None:
    russian = await world.publish("a", mp3(2060), title="Баба Нам Кевалам")
    assert russian.status_code == 422 and "English" in russian.text
    mixed = await world.publish("a", mp3(2061), title="Baba Nam बाबा")
    assert mixed.status_code == 422
    accents = await world.publish("a", mp3(2062), title="Bábá Nám Kevalam – 2nd take")
    assert accents.status_code == 201


async def test_the_other_categories_keep_their_own_alphabet_in_the_title(world: World) -> None:
    done = await world.publish(
        "a", mp3(2070), kind="bhajan", language="hi", style=None, title="बाबा का भजन"
    )
    assert done.status_code == 201, done.text


async def test_a_kiirtan_track_of_a_playlist_has_an_english_title_too(world: World) -> None:
    item = (await world.client.post(SETS, headers=AS_A, json={"title": "Retreat 2"})).json()
    refused = await add_track(world, item["id"], 2080, title="Баба Нам")
    assert refused.status_code == 422, refused.text


def test_the_schema_accepts_a_kiirtan_with_the_three_fields_cleaned() -> None:
    made = RecordingCreate(
        key="recordings-some-member-file.mp3",
        kind="kiirtan",
        title="Baba Nam Kevalam",
        author="x",
        terms_accepted=True,
        terms_version="x",
        style="bengali",
        recording_type=" Home ",
        tempo=" FAST ",
        performance="",
    )
    assert (made.recording_type, made.tempo, made.performance) == ("home", "fast", None)


# --------------------------------------------------------------------------- migration 0046

import sqlalchemy as sa  # noqa: E402
from alembic.config import Config  # noqa: E402
from alembic.script import ScriptDirectory  # noqa: E402
from test_practice_migration import at_0041, engine  # noqa: E402, F401
from test_recording_duplicates_migration import VERSIONS, load, run  # noqa: E402


def test_0046_is_the_one_head_and_adds_three_nullable_columns_twice_safely(
    engine: sa.Engine,  # noqa: F811
) -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0046_recording_info")
    assert revision is not None and revision.down_revision == "0045_author_claims"
    m46 = load("0046_recording_info")
    at_0041(engine)
    run(engine, m46.upgrade)
    run(engine, m46.upgrade)
    columns = {c["name"]: c for c in sa.inspect(engine).get_columns("recordings")}
    for name in ("recording_type", "tempo", "performance"):
        assert name in columns and columns[name]["nullable"] is True
    run(engine, m46.downgrade)
    assert "tempo" not in {c["name"] for c in sa.inspect(engine).get_columns("recordings")}
    run(engine, m46.upgrade)
