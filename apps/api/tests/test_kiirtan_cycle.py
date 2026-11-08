"""The chord cycle of a Kiirtan: forms with a ring of chords, the start slot, the optional number of
rounds; same review queue, versions, twins and daily allowance as every other chord sheet."""

from __future__ import annotations

from uuid import UUID

import pytest

from app.models.recording_extras import RecordingChordSheet
from app.models.song_chords import SongChordOffer
from app.services import kiirtan_cycles
from tests.extras_support import MEMBER_B, REC, World, recording
from tests.extras_support import world_fixture as world_fixture  # noqa: F401

URL = "/api/v1/recording-chords"
BHAJAN = UUID("3333333a-3333-3333-3333-33333333333b")


def form(chords=("Em", "C", "G", "D"), start=0, times=None, name=None) -> dict:
    return {"name": name, "chords": list(chords), "start": start, "times": times}


def payload(*forms: dict, **extra) -> dict:
    return {
        "instrument": "guitar",
        "chart_key": "Em",
        "cycle": {"forms": list(forms) or [form()]},
        "played_it": True,
        **extra,
    }


async def offer(world: World, who: str | None = "a", rec: UUID = REC, **kwargs):
    return await world.call(
        "POST", f"{URL}/recordings/{rec}", who, json=payload(*kwargs.pop("forms", ()), **kwargs)
    )


async def listing(world: World, who: str | None = None, rec: UUID = REC):
    response = await world.call("GET", f"{URL}/recordings/{rec}", who)
    assert response.status_code == 200, response.text
    return response.json()["items"]


# --------------------------------------------------------------------------- the shape


def test_the_text_written_from_a_cycle_names_each_form_its_start_and_its_rounds() -> None:
    cycle = {
        "forms": [
            {"name": "Slow", "chords": ["Em", "C", "G", "D"], "start": 1, "times": 4},
            {"name": None, "chords": ["Am", "G"], "start": 0, "times": None},
        ]
    }
    assert kiirtan_cycles.cycle_body(cycle) == (
        "Form 1 (Slow): Em - C - G - D (starts on C, x4)\nForm 2: Am - G (starts on Am)"
    )


async def test_a_cycle_is_stored_and_read_back_with_every_form(world: World) -> None:
    created = await offer(
        world, "team", forms=[form(name="Slow", times=4), form(("Am", "G", "F", "E", "Am", "G"), 2)]
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "published"
    assert body["lines"] is None
    assert [f["chords"] for f in body["cycle"]["forms"]] == [
        ["Em", "C", "G", "D"],
        ["Am", "G", "F", "E", "Am", "G"],
    ]
    assert body["cycle"]["forms"][0]["name"] == "Slow" and body["cycle"]["forms"][0]["times"] == 4
    assert body["cycle"]["forms"][1]["start"] == 2
    assert body["chords_count"] == 10
    assert body["body"].startswith("Form 1 (Slow): Em - C - G - D (starts on Em, x4)")
    seen = (await listing(world))[0]
    assert seen["cycle"] == body["cycle"]


async def test_three_forms_are_three_rings(world: World) -> None:
    body = (
        await offer(world, "team", forms=[form(), form(("Am", "Dm", "E", "Am")), form(("C", "G"))])
    ).json()
    assert len(body["cycle"]["forms"]) == 3


@pytest.mark.parametrize(
    "bad",
    [
        [form(("Em",), 0)],  # a ring of one
        [form(("Em", "C", "G", "D", "Em", "C", "G", "D", "Em"), 0)],  # nine slots
        [form(start=4)],  # the start is not a slot of the ring
        [form(times=0)],
        [form(times=100)],
        [form(("Em", "Cfoo", "G", "D"))],  # not a chord name
        [form(("A", "A", "A", "A"))],  # one lonely plain letter is no cycle
        [form(name="see https://example.org")],
        [form(name="x" * 40)],
        [form(), form()],  # the same form twice
    ],
)
async def test_a_bad_cycle_is_refused_and_costs_nothing(world: World, bad: list[dict]) -> None:
    response = await offer(world, "a", forms=bad)
    assert response.status_code == 422, response.text
    assert await world.rows(SongChordOffer) == []
    assert await world.rows(RecordingChordSheet) == []


async def test_the_start_is_required(world: World) -> None:
    body = payload()
    del body["cycle"]["forms"][0]["start"]
    response = await world.call("POST", f"{URL}/recordings/{REC}", "a", json=body)
    assert response.status_code == 422


async def test_one_kind_at_a_time(world: World) -> None:
    both = payload()
    both["body"] = "Am G"
    assert (await world.call("POST", f"{URL}/recordings/{REC}", "a", json=both)).status_code == 422
    strum = payload(strum="D DU UDU")
    assert (await world.call("POST", f"{URL}/recordings/{REC}", "a", json=strum)).status_code == 422
    harmonium = payload(instrument="harmonium", capo=2)
    assert (
        await world.call("POST", f"{URL}/recordings/{REC}", "a", json=harmonium)
    ).status_code == 422


async def test_only_a_kiirtan_takes_a_cycle(world: World) -> None:
    async with world.sessions() as session:
        row = recording(BHAJAN, "A bhajan")
        row.kind, row.type = "bhajan", "devotional"
        row.audio_sha256 = BHAJAN.hex * 2
        session.add(row)
        await session.commit()
    response = await offer(world, "a", rec=BHAJAN)
    assert response.status_code == 422
    assert "Kiirtans" in response.json()["detail"]


# --------------------------------------------------------------------------- review, like any sheet


async def test_a_members_cycle_waits_for_the_team_and_then_goes_live(world: World) -> None:
    created = (await offer(world, "a")).json()
    assert created["status"] == "pending" and created["cycle"] is not None
    assert await listing(world) == []  # strangers do not see it
    assert [s["id"] for s in await listing(world, "a")] == [created["id"]]
    approved = await world.call("POST", f"{URL}/review/{created['id']}/approve", "team")
    assert approved.status_code == 200, approved.text
    assert [s["status"] for s in await listing(world)] == ["published"]
    assert (await listing(world))[0]["cycle"]["forms"][0]["chords"] == ["Em", "C", "G", "D"]


async def test_the_same_cycle_twice_is_a_duplicate_and_a_different_one_is_not(world: World) -> None:
    assert (await offer(world, "a")).status_code == 201
    again = await offer(world, "a")
    assert again.status_code == 409 and again.headers["X-Error-Code"] == "chords_duplicate"
    assert (await offer(world, "a", forms=[form(start=1)])).status_code == 201


async def test_three_cycles_wait_at_most_and_a_plain_sheet_does_not_use_their_places(
    world: World,
) -> None:
    for start in range(3):
        assert (await offer(world, "a", forms=[form(start=start)])).status_code == 201
    too_many = await offer(world, "a", forms=[form(start=3)])
    assert too_many.status_code == 409 and too_many.headers["X-Error-Code"] == "chords_open_limit"
    plain = await world.call(
        "POST",
        f"{URL}/recordings/{REC}",
        "a",
        json={"instrument": "guitar", "body": "Em  C\nBaba Nam", "played_it": True},
    )
    assert plain.status_code == 201, plain.text


async def test_the_daily_allowance_is_the_one_of_every_chord_offer(world: World) -> None:
    async with world.sessions() as session:
        for _ in range(9):
            session.add(SongChordOffer(member_id=MEMBER_B))
        await session.commit()
    assert (await offer(world, "b")).status_code == 201
    blocked = await offer(world, "b", forms=[form(start=2)])
    assert blocked.status_code == 429
    assert blocked.headers["X-Error-Code"] == "chords_daily_limit"
    assert (await offer(world, "team", forms=[form(start=2)])).status_code == 201


async def test_a_cycle_without_forms_is_refused(world: World) -> None:
    body = payload()
    body["cycle"] = {"forms": []}
    assert (await world.call("POST", f"{URL}/recordings/{REC}", "a", json=body)).status_code == 422


async def test_a_new_version_replaces_the_live_cycle_once_it_is_live(world: World) -> None:
    old = (await offer(world, "team")).json()
    new = await offer(world, "team", forms=[form(("Am", "G", "F", "E"), 0)], replaces_id=old["id"])
    assert new.status_code == 201, new.text
    live = await listing(world)
    assert [s["id"] for s in live] == [new.json()["id"]]


async def test_a_member_fixes_a_waiting_cycle_and_it_keeps_its_kind(world: World) -> None:
    created = (await offer(world, "a")).json()
    fixed = await world.call(
        "PUT", f"{URL}/{created['id']}", "a", json=payload(form(("Dm", "G", "C", "A"), 2, 8))
    )
    assert fixed.status_code == 200, fixed.text
    assert fixed.json()["cycle"]["forms"][0]["chords"] == ["Dm", "G", "C", "A"]
    assert fixed.json()["status"] == "pending"
    as_text = await world.call(
        "PUT",
        f"{URL}/{created['id']}",
        "a",
        json={"instrument": "guitar", "body": "Em C G D", "played_it": True},
    )
    assert as_text.status_code == 422


async def test_an_anonymous_cycle_shows_no_author(world: World) -> None:
    await offer(world, "team", is_anonymous=True)
    seen = (await listing(world))[0]
    assert seen["author"] is None and "Carya" not in str(seen)


async def test_a_plain_sheet_of_a_kiirtan_is_still_a_plain_sheet(world: World) -> None:
    created = await world.call(
        "POST",
        f"{URL}/recordings/{REC}",
        "team",
        json={"instrument": "guitar", "body": "Em      C\nBaba Nam Kevalam", "played_it": True},
    )
    assert created.status_code == 201
    assert created.json()["cycle"] is None and created.json()["lines"] is None
