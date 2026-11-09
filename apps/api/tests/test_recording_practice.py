"""Avarta Kiirtan (a practice flag on a Kiirtan), the Kiirtan style that is now required, and the
event playlist that only needs a title. Pins docs/kiirtan-practice.md and docs/kiirtan-sets.md.

Fixtures come from test_recordings.py.
"""

# ruff: noqa: F811
from __future__ import annotations

import os
from uuid import UUID

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from test_recording_sets import AS_A, AS_B, SETS, add_track, detail
from test_recordings import World, mp3, world  # noqa: F401

from app.models.member import UserAccount
from app.models.recordings import Recording
from app.services.recording_practice import PRACTICES

AS_BOTH = {"a": AS_A, "b": AS_B}


def url(rid: str) -> str:
    return f"/api/v1/recordings/{rid}/practice"


# --------------------------------------------------------------------------- the style is required


async def test_a_kiirtan_without_a_style_is_refused_and_other_with_a_name_counts(
    world: World,
) -> None:
    none = await world.publish("a", mp3(1000), style=None)
    assert none.status_code == 422 and "style" in none.text.lower()
    no_name = await world.publish("a", mp3(1001), style="other")
    assert no_name.status_code == 422
    ok = await world.publish("a", mp3(1002), style="other", style_other="Lila Kiirtan")
    assert ok.status_code == 201 and ok.json()["style_other"] == "Lila Kiirtan"


async def test_the_other_kinds_are_not_asked_for_a_style(world: World) -> None:
    for seed, kind in ((1010, "bhajan"), (1011, "dance_song"), (1012, "baba_audio")):
        extra: dict[str, object] = (
            {"language": "en"} if kind != "dance_song" else {"dance": "tandava"}
        )
        done = await world.publish("a", mp3(seed), kind=kind, style=None, **extra)
        assert done.status_code == 201, done.text
        assert done.json()["style"] is None


# --------------------------------------------------------------------------- the practice flag


def test_the_only_practice_today_is_avarta() -> None:
    assert PRACTICES == ("avarta",)


async def test_an_upload_can_be_marked_avarta_and_an_unmarked_one_says_null(world: World) -> None:
    marked = await world.publish("a", mp3(1020), practice="avarta")
    assert marked.status_code == 201 and marked.json()["practice"] == "avarta"
    usual = await world.publish("a", mp3(1021))
    assert usual.json()["practice"] is None
    odd = await world.publish("a", mp3(1022), practice="nonsense")
    assert odd.status_code == 422
    # the list shows the flag, case does not matter
    loud = await world.publish("a", mp3(1023), practice=" AVARTA ")
    assert loud.json()["practice"] == "avarta"
    listed = (await world.client.get("/api/v1/recordings", params={"kind": "kiirtan"})).json()
    assert sorted(str(i["practice"]) for i in listed["items"]) == ["None", "avarta", "avarta"]


async def test_only_a_kiirtan_carries_the_flag(world: World) -> None:
    bhajan = await world.publish("a", mp3(1030), kind="bhajan", language="en", practice="avarta")
    assert bhajan.status_code == 201 and bhajan.json()["practice"] is None


async def test_the_owner_changes_the_flag_later_and_clears_it(world: World) -> None:
    made = (await world.publish("a", mp3(1040))).json()
    on = await world.client.patch(url(made["id"]), headers=AS_A, json={"practice": "avarta"})
    assert on.status_code == 200 and on.json()["practice"] == "avarta"
    seen = await world.client.get(f"/api/v1/recordings/{made['id']}")
    assert seen.json()["practice"] == "avarta"
    off = await world.client.patch(url(made["id"]), headers=AS_A, json={"practice": None})
    assert off.status_code == 200 and off.json()["practice"] is None


async def test_who_may_change_it_and_what_is_refused(world: World) -> None:
    made = (await world.publish("a", mp3(1050))).json()
    rid = made["id"]
    assert (
        await world.client.patch(url(rid), headers=AS_B, json={"practice": "avarta"})
    ).status_code == 403
    assert (await world.client.patch(url(rid), json={"practice": "avarta"})).status_code == 401
    assert (
        await world.client.patch(url(rid), headers=AS_A, json={"practice": "nonsense"})
    ).status_code == 422
    missing = "00000000-0000-0000-0000-0000000000ff"
    assert (
        await world.client.patch(url(missing), headers=AS_A, json={"practice": "avarta"})
    ).status_code == 404
    # the team may
    async with world.sessions() as session:
        member_b = await session.get(UserAccount, UUID("00000000-0000-0000-0000-00000000000b"))
        assert member_b is not None
        member_b.is_admin = True
        await session.commit()
    team = await world.client.patch(url(rid), headers=AS_B, json={"practice": "avarta"})
    assert team.status_code == 200 and team.json()["practice"] == "avarta"


async def test_a_bhajan_and_a_removed_kiirtan_cannot_be_marked(world: World) -> None:
    bhajan = (await world.publish("a", mp3(1060), kind="bhajan", language="en")).json()
    assert (
        await world.client.patch(url(bhajan["id"]), headers=AS_A, json={"practice": "avarta"})
    ).status_code == 422
    kiirtan = (await world.publish("a", mp3(1061))).json()
    async with world.sessions() as session:
        row = await session.get(Recording, UUID(kiirtan["id"]))
        assert row is not None
        row.status = "removed"
        await session.commit()
    assert (
        await world.client.patch(url(kiirtan["id"]), headers=AS_A, json={"practice": "avarta"})
    ).status_code == 409


async def test_the_same_file_as_avarta_and_as_a_usual_kiirtan_is_one_recording(
    world: World,
) -> None:
    data = mp3(1070)
    first = await world.publish("a", data, practice="avarta")
    assert first.status_code == 201
    again = await world.publish("a", data)
    # the exact-duplicate rule does not care about the flag
    assert again.status_code == 409


# --------------------------------------------------------------------------- playlist: title only


async def test_a_playlist_needs_only_a_title(world: World) -> None:
    made = await world.client.post(SETS, headers=AS_A, json={"title": "Just a title"})
    assert made.status_code == 201, made.text
    item = made.json()
    assert item["event_year"] is None and item["event_month"] is None
    assert item["starts_on"] is None and item["place"] is None and item["cover_url"] is None
    got = await detail(world, item["id"])
    assert got.status_code == 200 and got.json()["event_year"] is None
    empty = await world.client.post(SETS, headers=AS_A, json={"title": "  "})
    assert empty.status_code in (422,)


async def test_a_month_without_a_year_is_dropped_and_the_date_can_be_taken_away(
    world: World,
) -> None:
    item = (
        await world.client.post(SETS, headers=AS_A, json={"title": "T", "event_month": 5})
    ).json()
    assert item["event_year"] is None and item["event_month"] is None
    dated = await world.client.patch(
        f"{SETS}/{item['id']}", headers=AS_A, json={"event_year": 2022, "event_month": 6}
    )
    assert dated.json()["starts_on"] == "2022-06-01"
    cleared = await world.client.patch(
        f"{SETS}/{item['id']}", headers=AS_A, json={"event_year": None}
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["event_year"] is None and cleared.json()["starts_on"] is None
    month_alone = await world.client.patch(
        f"{SETS}/{item['id']}", headers=AS_A, json={"event_month": 4}
    )
    assert month_alone.status_code == 422  # a month needs a year


async def test_my_list_and_the_public_list_survive_a_playlist_with_no_date(world: World) -> None:
    dated = (
        await world.client.post(SETS, headers=AS_A, json={"title": "Dated", "event_year": 2020})
    ).json()
    undated = (await world.client.post(SETS, headers=AS_A, json={"title": "Undated"})).json()
    for item in (dated, undated):
        assert (await add_track(world, item["id"], 1100 + len(item["title"]))).status_code == 201
    mine = (await world.client.get(f"{SETS}/mine", headers=AS_A)).json()["items"]
    assert [i["title"] for i in mine][:2] == ["Dated", "Undated"]  # no date goes last
    public = (await world.client.get(SETS)).json()
    assert {i["title"] for i in public["items"]} == {"Dated", "Undated"}


async def test_a_kiirtan_track_of_a_playlist_still_needs_its_style(world: World) -> None:
    item = (await world.client.post(SETS, headers=AS_A, json={"title": "K set"})).json()
    refused = await add_track(world, item["id"], 1120, style=None)
    assert refused.status_code == 422, refused.text
    assert "style" in refused.text.lower()
    ok = await add_track(world, item["id"], 1121, style="western")
    assert ok.status_code == 201
