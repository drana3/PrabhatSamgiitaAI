"""The chord cycle of a Kiirtan: tunes (melodies) with a ring of chords, the start slot, the
optional number of rounds; same review queue, versions, twins and daily allowance as every other
chord sheet."""

from __future__ import annotations

from uuid import UUID

import pytest

from app.models.recording_extras import RecordingChordSheet
from app.models.song_chords import SongChordOffer
from app.schemas.recording_extras import CycleIn
from app.services import kiirtan_cycles
from tests.extras_support import MEMBER_B, REC, World, recording
from tests.extras_support import world_fixture as world_fixture  # noqa: F401

URL = "/api/v1/recording-chords"
BHAJAN = UUID("3333333a-3333-3333-3333-33333333333b")


def tune(
    chords=("Em", "C", "G", "D"), start=0, times=None, name=None, number=None, key=None
) -> dict:
    out = {"name": name, "chords": list(chords), "start": start, "times": times, "key": key}
    if number is not None:
        out["number"] = number
    return out


def payload(*tunes: dict, tune_count: int | None = None, **extra) -> dict:
    return {
        "instrument": "guitar",
        "chart_key": "Em",
        "cycle": {
            "tunes": list(tunes) or [tune()],
            **({"tune_count": tune_count} if tune_count else {}),
        },
        "played_it": True,
        **extra,
    }


async def offer(world: World, who: str | None = "a", rec: UUID = REC, **kwargs):
    return await world.call(
        "POST", f"{URL}/recordings/{rec}", who, json=payload(*kwargs.pop("tunes", ()), **kwargs)
    )


async def listing(world: World, who: str | None = None, rec: UUID = REC):
    response = await world.call("GET", f"{URL}/recordings/{rec}", who)
    assert response.status_code == 200, response.text
    return response.json()["items"]


# --------------------------------------------------------------------------- the shape


def test_the_text_written_from_a_cycle_names_each_tune_its_key_its_start_and_its_rounds() -> None:
    cycle = {
        "tune_count": 3,
        "tunes": [
            {
                "number": 1,
                "name": "Slow",
                "key": "G",
                "chords": ["Em", "C", "G", "D"],
                "start": 1,
                "times": 4,
            },
            {
                "number": 3,
                "name": None,
                "key": None,
                "chords": ["Am", "G"],
                "start": 0,
                "times": None,
            },
        ],
    }
    assert kiirtan_cycles.cycle_body(cycle) == (
        "Tune 1 (Slow): Em - C - G - D (key G, starts on C, x4)\n"
        "Tune 2: no chords yet\n"
        "Tune 3: Am - G (starts on Am)"
    )


async def test_a_cycle_is_stored_and_read_back_with_every_tune(world: World) -> None:
    created = await offer(
        world, "team", tunes=[tune(name="Slow", times=4), tune(("Am", "G", "F", "E", "Am", "G"), 2)]
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "published"
    assert body["lines"] is None
    assert [f["chords"] for f in body["cycle"]["tunes"]] == [
        ["Em", "C", "G", "D"],
        ["Am", "G", "F", "E", "Am", "G"],
    ]
    assert body["cycle"]["tunes"][0]["name"] == "Slow" and body["cycle"]["tunes"][0]["times"] == 4
    assert body["cycle"]["tunes"][1]["start"] == 2
    assert body["chords_count"] == 10
    assert body["body"].startswith("Tune 1 (Slow): Em - C - G - D (starts on Em, x4)")
    seen = (await listing(world))[0]
    assert seen["cycle"] == body["cycle"]


async def test_three_tunes_are_three_rings(world: World) -> None:
    body = (
        await offer(world, "team", tunes=[tune(), tune(("Am", "Dm", "E", "Am")), tune(("C", "G"))])
    ).json()
    assert len(body["cycle"]["tunes"]) == 3


@pytest.mark.parametrize(
    "bad",
    [
        [tune(("Em",), 0)],  # a ring of one
        [tune(("Em", "C", "G", "D", "Em", "C", "G", "D", "Em"), 0)],  # nine slots
        [tune(start=4)],  # the start is not a slot of the ring
        [tune(times=0)],
        [tune(times=100)],
        [tune(("Em", "Cfoo", "G", "D"))],  # not a chord name
        [tune(("A", "A", "A", "A"))],  # one lonely plain letter is no cycle
        [tune(name="see https://example.org")],
        [tune(name="x" * 40)],
        [tune(number=1), tune(number=1)],  # two tunes with the same number
        [tune(number=31)],  # more than thirty tunes
        [tune(key="H")],  # not a key
    ],
)
async def test_a_bad_cycle_is_refused_and_costs_nothing(world: World, bad: list[dict]) -> None:
    response = await offer(world, "a", tunes=bad)
    assert response.status_code == 422, response.text
    assert await world.rows(SongChordOffer) == []
    assert await world.rows(RecordingChordSheet) == []


async def test_the_start_is_required(world: World) -> None:
    body = payload()
    del body["cycle"]["tunes"][0]["start"]
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
    assert (await listing(world))[0]["cycle"]["tunes"][0]["chords"] == ["Em", "C", "G", "D"]


async def test_the_same_cycle_twice_is_a_duplicate_and_a_different_one_is_not(world: World) -> None:
    assert (await offer(world, "a")).status_code == 201
    again = await offer(world, "a")
    assert again.status_code == 409 and again.headers["X-Error-Code"] == "chords_duplicate"
    assert (await offer(world, "a", tunes=[tune(start=1)])).status_code == 201


async def test_three_cycles_wait_at_most_and_a_plain_sheet_does_not_use_their_places(
    world: World,
) -> None:
    for start in range(3):
        assert (await offer(world, "a", tunes=[tune(start=start)])).status_code == 201
    too_many = await offer(world, "a", tunes=[tune(start=3)])
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
    blocked = await offer(world, "b", tunes=[tune(start=2)])
    assert blocked.status_code == 429
    assert blocked.headers["X-Error-Code"] == "chords_daily_limit"
    assert (await offer(world, "team", tunes=[tune(start=2)])).status_code == 201


async def test_a_cycle_without_tunes_is_refused(world: World) -> None:
    body = payload()
    body["cycle"] = {"tunes": []}
    assert (await world.call("POST", f"{URL}/recordings/{REC}", "a", json=body)).status_code == 422


async def test_a_new_version_replaces_the_live_cycle_once_it_is_live(world: World) -> None:
    old = (await offer(world, "team")).json()
    new = await offer(world, "team", tunes=[tune(("Am", "G", "F", "E"), 0)], replaces_id=old["id"])
    assert new.status_code == 201, new.text
    live = await listing(world)
    assert [s["id"] for s in live] == [new.json()["id"]]


async def test_a_member_fixes_a_waiting_cycle_and_it_keeps_its_kind(world: World) -> None:
    created = (await offer(world, "a")).json()
    fixed = await world.call(
        "PUT", f"{URL}/{created['id']}", "a", json=payload(tune(("Dm", "G", "C", "A"), 2, 8))
    )
    assert fixed.status_code == 200, fixed.text
    assert fixed.json()["cycle"]["tunes"][0]["chords"] == ["Dm", "G", "C", "A"]
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


# ----------------------------------------------------------- several tunes in one recording


async def test_a_tune_without_chords_stays_in_the_recording_as_no_chords_yet(world: World) -> None:
    """Three tunes are played, the member has chords for the first and the third."""
    created = await offer(
        world,
        "team",
        tunes=[tune(number=1, key="G"), tune(("Am", "G", "F", "E"), 0, number=3, key="Am")],
        tune_count=3,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["cycle"]["tune_count"] == 3
    assert [t["number"] for t in body["cycle"]["tunes"]] == [1, 3]
    assert [t["key"] for t in body["cycle"]["tunes"]] == ["G", "Am"]
    assert "Tune 2: no chords yet" in body["body"]
    # the sheet is listed under the key of its first tune
    assert body["chart_key"] == "G"


async def test_the_numbers_of_tunes_follow_their_place_when_not_sent(world: World) -> None:
    body = (await offer(world, "team", tunes=[tune(), tune(("Am", "G"), 0)])).json()
    assert [t["number"] for t in body["cycle"]["tunes"]] == [1, 2]
    assert body["cycle"]["tune_count"] == 2


@pytest.mark.parametrize(
    "extra",
    [
        {"tune_count": 31},
        {"tune_count": 1, "tunes": [tune(number=2)]},  # a number above the count
    ],
)
async def test_the_count_of_tunes_is_checked(world: World, extra: dict) -> None:
    body = payload(tune())
    body["cycle"].update(extra)
    response = await world.call("POST", f"{URL}/recordings/{REC}", "a", json=body)
    assert response.status_code == 422, response.text


async def test_two_tunes_may_share_the_same_chords(world: World) -> None:
    created = await offer(world, "team", tunes=[tune(), tune()])
    assert created.status_code == 201, created.text
    assert len(created.json()["cycle"]["tunes"]) == 2


async def test_a_cycle_of_the_first_build_is_read_as_tunes(world: World) -> None:
    """Old rows keep `forms` in the database and old clients send `forms`: both are tunes."""
    sent = await world.call(
        "POST",
        f"{URL}/recordings/{REC}",
        "team",
        json={
            "instrument": "guitar",
            "cycle": {"forms": [tune(name="Slow"), tune(("Am", "G"), 0)]},
            "played_it": True,
        },
    )
    assert sent.status_code == 201, sent.text
    assert [t["number"] for t in sent.json()["cycle"]["tunes"]] == [1, 2]
    stored = {
        "forms": [
            {"name": "Slow", "chords": ["Em", "C", "G", "D"], "start": 0, "times": 4},
            {"name": None, "chords": ["Am", "G"], "start": 1, "times": None},
        ]
    }
    shaped = kiirtan_cycles.normalize(stored)
    assert shaped["tune_count"] == 2
    assert [t["number"] for t in shaped["tunes"]] == [1, 2]
    out = kiirtan_cycles.cycle_out(stored)
    assert out is not None and out.tunes[0].name == "Slow" and out.tunes[1].key is None
    assert kiirtan_cycles.cycle_body(stored).startswith("Tune 1 (Slow): Em - C - G - D")


# --------------------------------------------------------------------------- thirty tunes

LONG_CHORDS = (
    "C#m7b5/G",
    "Abmaj7sus4",
    "F#m7/C#",
    "Ebmaj7/Bb",
    "G#m7b5",
    "Dsus4/F#",
    "Bbmaj7#11",
    "Am7/G",
)


def thirty() -> list[dict]:
    return [
        tune(
            tuple(LONG_CHORDS[(i + n) % 8] for i in range(8)),
            start=n % 8,
            times=1 + n % 99,
            name=f"Round number {n + 1} of the long kiirtan"[:30],
            key=["C", "D#", "F#", "Bb", "A"][n % 5],
            number=n + 1,
        )
        for n in range(30)
    ]


async def test_thirty_rings_of_eight_chords_go_through_whole(world: World) -> None:
    sent = await offer(world, "team", tunes=thirty())
    assert sent.status_code == 201, sent.text
    body = sent.json()
    assert body["cycle"]["tune_count"] == 30
    assert [t["number"] for t in body["cycle"]["tunes"]] == list(range(1, 31))
    assert all(len(t["chords"]) == 8 for t in body["cycle"]["tunes"])
    assert body["body"].count("\n") == 29
    assert (await listing(world))[0]["cycle"] == body["cycle"]


async def test_thirty_one_tunes_are_too_many(world: World) -> None:
    too_many = thirty() + [tune(number=31)]
    response = await offer(world, "a", tunes=too_many)
    assert response.status_code == 422, response.text
    assert await world.rows(RecordingChordSheet) == []


def test_the_text_of_thirty_long_tunes_fits_what_a_reader_without_cycles_shows() -> None:
    """The worst a member can send: 30 tunes, each with a name, a key, 8 long chords, rounds."""
    cycle = kiirtan_cycles.clean_cycle(
        CycleIn.model_validate({"tune_count": 30, "tunes": thirty()})
    )
    text = kiirtan_cycles.cycle_body(cycle)
    assert text.count("\n") == 29
    assert len(text) < kiirtan_cycles.MAX_BODY


async def test_thirty_tunes_of_which_only_a_few_have_chords(world: World) -> None:
    sent = await offer(
        world, "team", tunes=[tune(number=1), tune(number=8), tune(number=30)], tune_count=30
    )
    assert sent.status_code == 201, sent.text
    body = sent.json()
    assert body["cycle"]["tune_count"] == 30
    assert [t["number"] for t in body["cycle"]["tunes"]] == [1, 8, 30]
    assert body["body"].count("no chords yet") == 27
