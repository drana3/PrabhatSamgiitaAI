"""Charts over pasted text for Bhajans and Spiritual songs: the cleaning, the kinds, versions,
the credit, the review and the daily allowance shared with every other chord offer."""

from __future__ import annotations

from uuid import UUID

import pytest

from app.models.recording_extras import RecordingChordSheet
from app.models.recordings import Recording
from app.models.song_chords import SongChordOffer
from app.services import recording_chords as service
from tests.extras_support import MEMBER_A, REC, World, recording
from tests.extras_support import world_fixture as world_fixture  # noqa: F401

URL = "/api/v1/recording-chords"
BHAJAN = UUID("3333333a-3333-3333-3333-33333333333b")
SPIRITUAL = UUID("4444444a-4444-4444-4444-44444444444b")
TEXT = ["Baba Nam Kevalam", "Prema Sindhu", "", "Sadguru Murti"]


def lines(*chords: tuple[int, int, str], text: list[str] = TEXT) -> list[dict]:
    """Chart lines: each chord is (line, word, chord)."""
    out = [{"text": t, "placements": []} for t in text]
    for line, word, chord in chords:
        out[line]["placements"].append({"word": word, "chord": chord})
    return out


CHART = lines((0, 0, "Am"), (0, 2, "G"), (1, 0, "F"), (3, 1, "E7"))


def chart_payload(chart: list[dict] | None = None, **extra) -> dict:
    return {
        "instrument": "guitar",
        "chart_key": "C",
        "lines": CHART if chart is None else chart,
        "played_it": True,
        **extra,
    }


async def make_recordings(world: World) -> None:
    async with world.sessions() as session:
        for rec_id, kind, kind_type, language in (
            (BHAJAN, "bhajan", "devotional", None),
            (SPIRITUAL, "spiritual_song", "other", "en"),
        ):
            row: Recording = recording(rec_id, f"Song {kind}")
            row.kind, row.type, row.language = kind, kind_type, language
            row.audio_sha256 = rec_id.hex * 2
            session.add(row)
            await session.commit()


async def offer(world: World, who: str | None = "a", rec: UUID = BHAJAN, **kwargs):
    return await world.call("POST", f"{URL}/recordings/{rec}", who, json=chart_payload(**kwargs))


async def listing(world: World, who: str | None = None, rec: UUID = BHAJAN):
    response = await world.call("GET", f"{URL}/recordings/{rec}", who)
    assert response.status_code == 200, response.text
    return response.json()["items"]


# --------------------------------------------------------------------------- the cleaning


def test_the_body_is_the_chart_written_with_chords_inside_the_words() -> None:
    chart = {"lines": CHART}
    assert service.chart_body(chart) == (
        "[Am]Baba Nam [G]Kevalam\n[F]Prema Sindhu\n\nSadguru [E7]Murti"
    )
    assert service.line_chords("[Am]Baba Nam [G]Kevalam") == 2


async def test_a_chart_is_stored_with_its_text_and_read_back(world: World) -> None:
    await make_recordings(world)
    created = await offer(world, "team")
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "published" and body["chart_key"] == "C"
    assert [line["text"] for line in body["lines"]] == TEXT
    assert body["lines"][0]["placements"] == [
        {"word": 0, "chord": "Am"},
        {"word": 2, "chord": "G"},
    ]
    assert body["chords_count"] == 4
    assert body["body"].startswith("[Am]Baba Nam [G]Kevalam")
    seen = (await listing(world))[0]
    assert seen["lines"] == body["lines"] and seen["capo"] == 0


async def test_the_text_is_cleaned_and_placements_are_sorted_and_deduplicated(
    world: World,
) -> None:
    await make_recordings(world)
    messy = [
        {
            "text": "  Baba​   Nam\tKevalam  ",
            "placements": [
                {"word": 2, "chord": "G"},
                {"word": 0, "chord": "Am"},
                {"word": 0, "chord": "Dm"},
            ],
        },
        {"text": "", "placements": []},
        {"text": "", "placements": []},
        {"text": "Prema", "placements": []},
        {"text": "", "placements": []},
    ]
    body = (await offer(world, "team", chart=messy)).json()
    assert [line["text"] for line in body["lines"]] == ["Baba Nam Kevalam", "", "Prema"]
    assert body["lines"][0]["placements"] == [
        {"word": 0, "chord": "Am"},
        {"word": 2, "chord": "G"},
    ]


@pytest.mark.parametrize(
    "chart",
    [
        lines(),
        lines((0, 9, "Am")),
        lines((0, 0, "A")),
        [{"text": "Baba Nam see https://example.org", "placements": [{"word": 0, "chord": "Am"}]}],
        [{"text": "x" * 130, "placements": [{"word": 0, "chord": "Am"}]}],
        [{"text": "", "placements": [{"word": 0, "chord": "Am"}]}],
    ],
)
async def test_a_bad_chart_is_refused_and_costs_nothing(world: World, chart: list[dict]) -> None:
    await make_recordings(world)
    assert (await offer(world, "a", chart=chart)).status_code in (422,)
    assert await world.rows(SongChordOffer) == []
    assert await world.rows(RecordingChordSheet) == []


async def test_a_chord_that_is_not_a_chord_is_refused(world: World) -> None:
    await make_recordings(world)
    assert (await offer(world, "a", chart=lines((0, 0, "Hello")))).status_code == 422


async def test_the_request_has_text_or_lines_and_a_chart_needs_its_key(world: World) -> None:
    await make_recordings(world)
    both = await world.call(
        "POST", f"{URL}/recordings/{BHAJAN}", "a", json={**chart_payload(), "body": "Am G\nBaba"}
    )
    none = await world.call(
        "POST",
        f"{URL}/recordings/{BHAJAN}",
        "a",
        json={"instrument": "guitar", "played_it": True},
    )
    keyless = await offer(world, "a", chart_key=None)
    assert [both.status_code, none.status_code, keyless.status_code] == [422, 422, 422]
    hm = await offer(world, "a", instrument="harmonium", capo=2)
    assert hm.status_code == 422


# --------------------------------------------------------------------------- the kinds


async def test_a_chart_is_for_a_bhajan_and_a_spiritual_song_never_a_kiirtan(world: World) -> None:
    await make_recordings(world)
    assert (await offer(world, "a", rec=BHAJAN)).status_code == 201
    assert (await offer(world, "a", rec=SPIRITUAL, chart_key="D")).status_code == 201
    kiirtan = await offer(world, "a", rec=REC)
    assert kiirtan.status_code == 422 and "Bhajans and Spiritual songs" in kiirtan.json()["detail"]
    # the plain-text sheet of a Kiirtan is as before
    plain = await world.call(
        "POST",
        f"{URL}/recordings/{REC}",
        "a",
        json={"instrument": "guitar", "body": "Am  G\nBaba Nam", "played_it": True},
    )
    assert plain.status_code == 201 and plain.json()["lines"] is None


async def test_capo_and_strum_are_kept_for_the_guitar(world: World) -> None:
    await make_recordings(world)
    made = (await offer(world, "team", capo=3, strum="D DU UDU")).json()
    assert made["capo"] == 3 and made["strum"] == "D DU UDU"
    bad = await offer(world, "team", chart_key="D", strum="hello")
    assert bad.status_code == 422


# --------------------------------------------------------------------------- the daily allowance


async def test_a_chart_counts_in_the_daily_ten_shared_with_songs_and_sheets(
    world: World,
) -> None:
    await make_recordings(world)
    async with world.sessions() as session:
        for _ in range(9):
            session.add(SongChordOffer(member_id=MEMBER_A))
        await session.commit()
    assert (await offer(world, "a")).status_code == 201
    blocked = await offer(world, "a", chart_key="D")
    assert blocked.status_code == 429
    assert blocked.headers["x-error-code"] == "chords_daily_limit"
    assert len(await world.rows(SongChordOffer)) == 10
    assert (await offer(world, "team", chart_key="D")).status_code == 201


async def test_duplicates_and_the_cap_of_three(world: World) -> None:
    await make_recordings(world)
    assert (await offer(world, "a")).status_code == 201
    twin = await offer(world, "a")
    assert twin.status_code == 409 and twin.headers["x-error-code"] == "chords_duplicate"
    # another capo is another chart
    assert (await offer(world, "a", capo=2)).status_code == 201
    assert (await offer(world, "a", capo=3)).status_code == 201
    over = await offer(world, "a", capo=4)
    assert over.status_code == 409 and over.headers["x-error-code"] == "chords_open_limit"


# --------------------------------------------------------------------------- versions


async def test_a_new_version_archives_the_old_one_when_it_goes_live(world: World) -> None:
    await make_recordings(world)
    old = (await offer(world, "team")).json()
    new = await offer(world, "team", replaces_id=old["id"], chart=lines((0, 0, "Dm"), (1, 0, "G")))
    assert new.status_code == 201
    shown = await listing(world)
    assert [item["id"] for item in shown] == [new.json()["id"]]
    mine = (await world.call("GET", f"{URL}/mine", "team")).json()["items"]
    archived = next(item for item in mine if item["id"] == old["id"])
    assert archived["archived"] is True and archived["replaced_by"] == new.json()["id"]


async def test_a_member_version_waits_and_the_old_one_stays_until_the_team_approves(
    world: World,
) -> None:
    await make_recordings(world)
    old = (await offer(world, "a")).json()
    await world.call("POST", f"{URL}/review/{old['id']}/approve", "team")
    new = (
        await offer(world, "a", replaces_id=old["id"], chart=lines((0, 0, "Dm"), (1, 0, "G")))
    ).json()
    assert new["status"] == "pending" and new["replaces"] == old["id"]
    assert {i["id"] for i in await listing(world)} == {old["id"]}
    assert (
        await world.call("POST", f"{URL}/review/{new['id']}/approve", "team")
    ).status_code == 200
    assert {i["id"] for i in await listing(world)} == {new["id"]}


async def test_a_version_takes_the_place_of_the_old_one_in_the_cap(world: World) -> None:
    await make_recordings(world)
    ids = [(await offer(world, "a", capo=capo)).json()["id"] for capo in (1, 2, 3)]
    assert (await offer(world, "a", capo=4)).status_code == 409
    await world.call("POST", f"{URL}/review/{ids[0]}/approve", "team")
    again = await offer(world, "a", capo=5, replaces_id=ids[0])
    assert again.status_code == 201


async def test_nobody_replaces_somebody_elses_chart(world: World) -> None:
    await make_recordings(world)
    theirs = (await offer(world, "team")).json()
    mine = await offer(world, "a", replaces_id=theirs["id"], chart=lines((0, 0, "Dm"), (1, 0, "G")))
    assert mine.status_code == 201 and mine.json()["replaces"] is None
    assert theirs["id"] in {i["id"] for i in await listing(world)}


async def test_deleting_the_newer_version_clears_the_link(world: World) -> None:
    await make_recordings(world)
    old = (await offer(world, "team")).json()
    new = (
        await offer(world, "team", replaces_id=old["id"], chart=lines((0, 0, "Dm"), (1, 0, "G")))
    ).json()
    assert (await world.call("DELETE", f"{URL}/{new['id']}", "team")).status_code == 204
    rows = {str(r.id): r for r in await world.rows(RecordingChordSheet)}
    assert rows[old["id"]].replaces_id is None


# --------------------------------------------------------------------------- start from this chart


async def test_start_from_this_chart_credits_the_original_as_it_is_now(world: World) -> None:
    await make_recordings(world)
    original = (await offer(world, "team")).json()
    copy = (
        await offer(world, "a", based_on_id=original["id"], chart=lines((0, 0, "Am"), (1, 0, "G")))
    ).json()
    assert copy["based_on"] == {"id": original["id"], "name": "Carya"}
    # the original turns anonymous later: the name goes, the credit stays
    await world.update(RecordingChordSheet, UUID(original["id"]), is_anonymous=True)
    again = (await world.call("GET", f"{URL}/mine", "a")).json()["items"][0]
    assert again["based_on"] == {"id": original["id"], "name": None}
    # and a deleted original gives no credit at all
    await world.call("DELETE", f"{URL}/{original['id']}", "team")
    gone = (await world.call("GET", f"{URL}/mine", "a")).json()["items"][0]
    assert gone["based_on"] is None


async def test_the_credit_is_ignored_for_your_own_or_a_plain_or_a_waiting_chart(
    world: World,
) -> None:
    await make_recordings(world)
    waiting = (await offer(world, "b")).json()
    own = (await offer(world, "a")).json()
    for source in (waiting["id"], own["id"], str(UUID(int=7))):
        made = await offer(world, "a", chart_key="D", based_on_id=source)
        assert made.status_code == 201 and made.json()["based_on"] is None
        await world.call("DELETE", f"{URL}/{made.json()['id']}", "a")


# --------------------------------------------------------------------------- editing and review


async def test_the_author_edits_a_waiting_chart_and_it_keeps_its_kind(world: World) -> None:
    await make_recordings(world)
    sheet = (await offer(world, "a")).json()
    changed = await world.call(
        "PUT",
        f"{URL}/{sheet['id']}",
        "a",
        json=chart_payload(lines((0, 0, "Dm"), (1, 0, "Em"), (3, 0, "A7")), capo=2),
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["capo"] == 2 and changed.json()["chords_count"] == 3
    plain = await world.call(
        "PUT",
        f"{URL}/{sheet['id']}",
        "a",
        json={"instrument": "guitar", "body": "Am G\nBaba", "played_it": True},
    )
    assert plain.status_code == 422
    await world.call("POST", f"{URL}/review/{sheet['id']}/approve", "team")
    live = await world.call("PUT", f"{URL}/{sheet['id']}", "a", json=chart_payload())
    assert live.status_code == 409


async def test_the_review_queue_shows_the_chart_and_its_credit(world: World) -> None:
    await make_recordings(world)
    original = (await offer(world, "team")).json()
    await offer(world, "a", based_on_id=original["id"], chart=lines((0, 0, "Am"), (1, 0, "G")))
    queue = (await world.call("GET", f"{URL}/review/queue", "team")).json()["items"]
    assert len(queue) == 1
    assert queue[0]["lines"][0]["text"] == "Baba Nam Kevalam"
    assert queue[0]["based_on"]["name"] == "Carya"
    assert queue[0]["author_name"] == "Ananda"


async def test_an_anonymous_chart_shows_no_trace_of_its_author(world: World) -> None:
    await make_recordings(world)
    await offer(world, "a", is_anonymous=True)
    await world.call("POST", f"{URL}/review/{(await listing(world, 'a'))[0]['id']}/approve", "team")
    seen = (await world.call("GET", f"{URL}/recordings/{BHAJAN}", "b")).text
    assert "Ananda" not in seen and str(MEMBER_A) not in seen
    assert (await listing(world, "b"))[0]["author"] is None
