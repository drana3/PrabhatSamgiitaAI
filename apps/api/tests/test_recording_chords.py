"""Chord sheets of recordings: the text rules, offering, editing, review, reports, limits."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.models.recording_extras import RecordingChordSheet
from app.models.recordings import MemberNotice
from app.models.song_chords import SongChordOffer
from app.services import recording_chords as service
from tests.extras_support import (
    AVATAR,
    MEMBER_A,
    REC,
    REC_REMOVED,
    World,
)
from tests.extras_support import world_fixture as world_fixture  # noqa: F401

URL = "/api/v1/recording-chords"
CHART = "Am        G\nBaba Nam Kevalam\nF         E7\nBaba Nam Kevalam"


def payload(body: str = CHART, **extra) -> dict:
    return {"instrument": "guitar", "body": body, "played_it": True, **extra}


async def offer(world: World, who: str | None = "a", rec=REC, **kwargs):
    return await world.call("POST", f"{URL}/recordings/{rec}", who, json=payload(**kwargs))


async def listing(world: World, who: str | None = None, rec=REC, **params):
    response = await world.call("GET", f"{URL}/recordings/{rec}", who, params=params)
    assert response.status_code == 200, response.text
    return response.json()["items"]


# --------------------------------------------------------------------------- text rules


def test_chord_lines_and_inline_marks_are_counted() -> None:
    assert service.chord_line_count("Am  G  F | E7") == 4
    assert service.chord_line_count("Am G x2") == 2
    assert service.chord_line_count("Baba Nam Kevalam") == 0
    assert service.chord_line_count("Am and G") == 0
    assert service.chord_line_count("") == 0
    assert service.line_chords("Baba [Am]Nam Ke[G]valam") == 2
    assert service.line_chords("Baba [Hello]Nam") == 0


@pytest.mark.parametrize("raw", ["A", "A\nBaba Nam Kevalam", "Bb\nWords", "A\nA", "C#\nx"])
def test_one_lonely_plain_letter_is_not_a_chart(raw: str) -> None:
    with pytest.raises(HTTPException) as caught:
        service.clean_sheet(raw)
    assert caught.value.status_code == 422 and "single plain letter" in caught.value.detail


@pytest.mark.parametrize(
    "raw",
    ["Am", "Am\nBaba", "A  G\nBaba Nam", "G7", "D/F#\nBaba", "Baba [A]Nam [G]Kevalam", "Cmaj7\nBaba"],
)
def test_real_minimal_charts_pass(raw: str) -> None:
    body, chords = service.clean_sheet(raw)
    assert chords >= 1 and body


def test_what_proves_a_chart() -> None:
    assert not service.proves_a_chart(["A"])
    assert not service.proves_a_chart(["A", "A"])
    assert service.proves_a_chart(["A", "G"])
    assert service.proves_a_chart(["Am"])
    assert service.proves_a_chart(["A", "A7"])


def test_clean_note_refuses_links_like_the_chart_does() -> None:
    assert service.clean_note("  capo on 2  ") == "capo on 2"
    assert service.clean_note("   ") is None
    for bad in ("see https://example.com", "www.example.com", "example.com has it"):
        with pytest.raises(HTTPException):
            service.clean_note(bad)


def test_clean_sheet_removes_invisible_marks_and_keeps_the_alignment() -> None:
    body, chords = service.clean_sheet("‮Am​     G\r\nBaba Nam   \n\n\n\nKevalam\t\n")
    assert body == "Am     G\nBaba Nam\n\nKevalam"
    assert chords == 2


def test_clean_sheet_removes_a_common_left_margin() -> None:
    body, _ = service.clean_sheet("    Am   G\n    Baba Nam")
    assert body == "Am   G\nBaba Nam"


@pytest.mark.parametrize(
    "raw",
    [
        "   \n  ",
        "Baba Nam Kevalam\nOnly words here",
        "Am G\nsee https://example.com for more",
        "Am G\n" + "x" * 121,
        "\n".join(["Am G"] * 251),
        "Am G\n" + "Baba Nam\n" * 1100,
    ],
)
def test_clean_sheet_refuses(raw: str) -> None:
    with pytest.raises(HTTPException) as caught:
        service.clean_sheet(raw)
    assert caught.value.status_code == 422


def test_clean_sheet_refuses_too_many_chords() -> None:
    line = " ".join(["Am"] * 40)
    with pytest.raises(HTTPException):
        service.clean_sheet("\n".join([line] * 60))


def test_same_sheet_ignores_runs_of_spaces() -> None:
    assert service.same_sheet_key("Am   G\nBaba  Nam") == service.same_sheet_key("Am G\nBaba Nam")


# --------------------------------------------------------------------------- offering


async def test_member_sheet_waits_and_only_the_author_sees_it(world: World) -> None:
    created = await offer(world, "a", chart_key="Am", note="  from the 2019 retreat ")
    assert created.status_code == 201, created.text
    out = created.json()
    assert out["status"] == "pending" and out["mine"] is True
    assert out["chords_count"] == 4 and out["note"] == "from the 2019 retreat"
    assert out["chart_key"] == "Am"
    assert len(await listing(world, "a")) == 1
    for who in (None, "b"):
        assert await listing(world, who) == []
    team_view = await listing(world, "team")
    assert team_view == []  # waiting sheets are in the review queue, not on the page


async def test_team_sheet_is_live_at_once(world: World) -> None:
    created = await offer(world, "team")
    assert created.json()["status"] == "published"
    for who in (None, "a"):
        assert len(await listing(world, who)) == 1


async def test_guest_cannot_offer_and_unknown_recordings_are_404(world: World) -> None:
    assert (await offer(world, None)).status_code == 401
    assert (await offer(world, "a", rec=uuid4())).status_code == 404
    assert (await offer(world, "a", rec=REC_REMOVED)).status_code == 404
    assert (await world.call("GET", f"{URL}/recordings/{REC_REMOVED}")).status_code == 404


async def test_the_played_it_box_and_the_key_are_checked(world: World) -> None:
    unticked = await world.call(
        "POST", f"{URL}/recordings/{REC}", "a", json=payload(played_it=False)
    )
    assert unticked.status_code == 422
    for bad in ("H", "Cx", "Amm", "Hm"):
        assert (await offer(world, "a", chart_key=bad)).status_code == 422, bad
    ok = await offer(world, "a", chart_key="F#m")
    assert ok.status_code == 201 and ok.json()["chart_key"] == "F#m"
    bad_instrument = await world.call(
        "POST", f"{URL}/recordings/{REC}", "a", json={**payload(), "instrument": "piano"}
    )
    assert bad_instrument.status_code == 422


async def test_a_note_with_a_link_is_refused_and_costs_nothing(world: World) -> None:
    for _ in range(8):
        refused = await offer(world, "a", note="chords at https://example.com/x")
        assert refused.status_code == 422 and "web links" in refused.json()["detail"]
    assert await world.rows(SongChordOffer) == []
    ok = await offer(world, "a", note="capo on 2")
    assert ok.status_code == 201
    changed = await world.call(
        "PUT", f"{URL}/{ok.json()['id']}", "a", json=payload(note="www.example.com")
    )
    assert changed.status_code == 422


async def test_a_lonely_letter_costs_no_allowance(world: World) -> None:
    for _ in range(8):
        assert (await offer(world, "a", body="A")).status_code == 422
    assert await world.rows(SongChordOffer) == []
    assert (await offer(world, "a", body="Am")).status_code == 201


async def test_a_refused_text_costs_no_allowance(world: World) -> None:
    for _ in range(10):
        assert (await offer(world, "a", body="only words, no chords")).status_code == 422
    assert await world.rows(SongChordOffer) == []
    assert (await offer(world, "a")).status_code == 201


async def test_duplicates_are_refused_per_recording_and_instrument(world: World) -> None:
    assert (await offer(world, "a")).status_code == 201
    again = await offer(world, "a", body=CHART.replace("  ", "   "))
    assert again.status_code == 409 and again.headers["x-error-code"] == "chords_duplicate"
    other_key = await offer(world, "a", chart_key="Am")
    assert other_key.status_code == 201
    other_instrument = await world.call(
        "POST", f"{URL}/recordings/{REC}", "a", json={**payload(), "instrument": "harmonium"}
    )
    assert other_instrument.status_code == 201
    assert (await offer(world, "b")).status_code == 201  # another member may offer the same


async def test_three_live_sheets_per_recording_and_instrument(world: World) -> None:
    for i in range(3):
        assert (await offer(world, "a", body=f"Am G{'7' * i}\nBaba")).status_code == 201
    fourth = await offer(world, "a", body="Am G9\nBaba")
    assert fourth.status_code == 409 and fourth.headers["x-error-code"] == "chords_open_limit"
    # the team has no cap
    for i in range(4):
        assert (await offer(world, "team", body=f"Em A{i}\nBaba")).status_code == 201
    # a deleted sheet frees the place (but not the daily allowance)
    mine = [s for s in await listing(world, "a") if s["mine"]]
    assert (await world.call("DELETE", f"{URL}/{mine[0]['id']}", "a")).status_code == 204
    assert (await offer(world, "a", body="Am G9\nBaba")).status_code == 201


async def test_anonymous_sheet_has_no_author_in_any_public_view(world: World) -> None:
    created = await offer(world, "team", is_anonymous=True)
    assert created.json()["author"] is None
    named = await offer(world, "team", body="Em A\nBaba", is_anonymous=False)
    assert named.json()["author"] == {"name": "Carya"}
    for who in (None, "a", "b"):
        items = [i for i in await listing(world, who) if i["is_anonymous"]]
        text = json.dumps(items)
        for needle in (str(MEMBER_A), "Carya", "carya@example.org", AVATAR):
            assert needle not in text
    queue = (
        await world.call("GET", f"{URL}/review/queue", "team", params={"filter": "all"})
    ).json()
    anonymous = [i for i in queue["items"] if i["is_anonymous"]]
    assert anonymous and anonymous[0]["author_name"] == "Carya"


# --------------------------------------------------------------------------- limits


async def test_daily_allowance_is_shared_with_song_chords_and_survives_deleting(
    world: World,
) -> None:
    async with world.sessions() as session:
        for _ in range(9):
            session.add(SongChordOffer(member_id=MEMBER_A))
        await session.commit()
    created = await offer(world, "a")
    assert created.status_code == 201
    assert (await world.call("DELETE", f"{URL}/{created.json()['id']}", "a")).status_code == 204
    blocked = await offer(world, "a", body="Em A\nBaba")
    assert blocked.status_code == 429
    assert blocked.headers["x-error-code"] == "chords_daily_limit"
    assert (await offer(world, "team", body="Em A\nBaba")).status_code == 201


async def test_old_offers_do_not_count(world: World) -> None:
    old = datetime.now(UTC) - timedelta(hours=25)
    async with world.sessions() as session:
        for _ in range(10):
            session.add(SongChordOffer(member_id=MEMBER_A, created_at=old))
        await session.commit()
    assert (await offer(world, "a")).status_code == 201


async def test_hourly_brake(world: World) -> None:
    codes = []
    for i in range(7):
        codes.append((await offer(world, "a", body=f"Am G{i}\nBaba {i}")).status_code)
        if i % 3 == 2:
            # keep the three-live cap and the daily allowance out of the way
            for item in await listing(world, "a"):
                await world.call("DELETE", f"{URL}/{item['id']}", "a")
    assert 429 in codes


# --------------------------------------------------------------------------- editing


async def test_author_edits_a_waiting_sheet_and_not_a_live_one(world: World) -> None:
    sheet = (await offer(world, "a")).json()
    changed = await world.call(
        "PUT", f"{URL}/{sheet['id']}", "a", json=payload("Dm Em\nBaba Nam", chart_key="Dm")
    )
    assert changed.status_code == 200 and changed.json()["body"] == "Dm Em\nBaba Nam"
    stranger = await world.call("PUT", f"{URL}/{sheet['id']}", "b", json=payload())
    assert stranger.status_code == 404
    await world.call("POST", f"{URL}/review/{sheet['id']}/approve", "team")
    live = await world.call("PUT", f"{URL}/{sheet['id']}", "a", json=payload("Dm Em\nBaba"))
    assert live.status_code == 409 and live.headers["x-error-code"] == "chords_not_editable"


async def test_edit_keeps_the_instrument_and_refuses_a_twin(world: World) -> None:
    first = (await offer(world, "a")).json()
    second = (await offer(world, "a", body="Em A\nBaba")).json()
    wrong = await world.call(
        "PUT", f"{URL}/{first['id']}", "a", json={**payload(), "instrument": "harmonium"}
    )
    assert wrong.status_code == 422
    twin = await world.call("PUT", f"{URL}/{second['id']}", "a", json=payload())
    assert twin.status_code == 409 and twin.headers["x-error-code"] == "chords_duplicate"


async def test_a_rejected_sheet_comes_back_to_pending_when_fixed(world: World) -> None:
    sheet = (await offer(world, "a")).json()
    await world.call(
        "POST", f"{URL}/review/{sheet['id']}/reject", "team", json={"reason": "wrong key"}
    )
    mine = (await world.call("GET", f"{URL}/mine", "a")).json()["items"]
    assert mine[0]["status"] == "rejected" and mine[0]["rejected_reason"] == "wrong key"
    assert mine[0]["recording_title"] == "Baba Nam Kevalam"
    fixed = await world.call("PUT", f"{URL}/{sheet['id']}", "a", json=payload("Em A\nBaba"))
    assert fixed.json()["status"] == "pending" and fixed.json()["rejected_reason"] is None


async def test_delete_is_for_the_author_only_and_clears_reports(world: World) -> None:
    sheet = (await offer(world, "team")).json()
    await world.call("POST", f"{URL}/{sheet['id']}/report", "b", json={"reason": "spam"})
    assert (await world.call("DELETE", f"{URL}/{sheet['id']}", "b")).status_code == 404
    assert (await world.call("DELETE", f"{URL}/{sheet['id']}", None)).status_code == 401
    assert (await world.call("DELETE", f"{URL}/{sheet['id']}", "team")).status_code == 204
    assert await world.rows(RecordingChordSheet) == []


# --------------------------------------------------------------------------- review


async def test_review_is_for_the_team_and_writes_notices(world: World) -> None:
    sheet = (await offer(world, "a")).json()
    for method, path in (
        ("GET", "/review/queue"),
        ("POST", f"/review/{sheet['id']}/approve"),
    ):
        assert (await world.call(method, f"{URL}{path}", "a")).status_code == 403
        assert (await world.call(method, f"{URL}{path}", None)).status_code == 401
    queue = (await world.call("GET", f"{URL}/review/queue", "team")).json()
    assert queue["total"] == 1 and queue["items"][0]["author_id"] == str(MEMBER_A)
    approved = await world.call("POST", f"{URL}/review/{sheet['id']}/approve", "team")
    assert approved.json()["status"] == "published"
    assert len(await listing(world, None)) == 1
    again = await world.call("POST", f"{URL}/review/{sheet['id']}/approve", "team")
    assert again.status_code == 200
    rejected = await world.call(
        "POST", f"{URL}/review/{sheet['id']}/reject", "team", json={"reason": "not these chords"}
    )
    assert rejected.json()["status"] == "rejected"
    assert await listing(world, None) == []
    restored = await world.call("POST", f"{URL}/review/{sheet['id']}/restore", "team")
    assert restored.json()["status"] == "published"
    notices = await world.rows(MemberNotice)
    assert [n.kind for n in notices] == ["chords_published", "chords_rejected", "chords_published"]
    assert all(n.user_id == MEMBER_A and n.recording_id == REC for n in notices)


async def test_review_state_rules(world: World) -> None:
    sheet = (await offer(world, "a")).json()
    short = await world.call(
        "POST", f"{URL}/review/{sheet['id']}/reject", "team", json={"reason": "x"}
    )
    assert short.status_code == 422
    assert (
        await world.call("POST", f"{URL}/review/{sheet['id']}/restore", "team")
    ).status_code == 409
    await world.call(
        "POST", f"{URL}/review/{sheet['id']}/reject", "team", json={"reason": "no good"}
    )
    assert (
        await world.call("POST", f"{URL}/review/{sheet['id']}/approve", "team")
    ).status_code == 409
    assert (
        await world.call(
            "POST", f"{URL}/review/{sheet['id']}/reject", "team", json={"reason": "again"}
        )
    ).status_code == 409
    assert (await world.call("POST", f"{URL}/review/{uuid4()}/approve", "team")).status_code == 404


async def test_queue_filters(world: World) -> None:
    waiting = (await offer(world, "a")).json()
    live = (await offer(world, "team", body="Em A\nBaba")).json()
    await world.call("POST", f"{URL}/{live['id']}/report", "b", json={"reason": "wrong_chords"})
    for name, expected in (
        ("pending", 1),
        ("reported", 1),
        ("published", 1),
        ("rejected", 0),
        ("all", 2),
    ):
        got = (
            await world.call("GET", f"{URL}/review/queue", "team", params={"filter": name})
        ).json()
        assert got["total"] == expected, name
    assert waiting["status"] == "pending"
    assert (
        await world.call("GET", f"{URL}/review/queue", "team", params={"filter": "nope"})
    ).status_code == 422


# --------------------------------------------------------------------------- reports


async def test_reports_one_each_not_on_own_or_waiting_sheets(world: World) -> None:
    live = (await offer(world, "team")).json()
    first = await world.call("POST", f"{URL}/{live['id']}/report", None, json={"reason": "spam"})
    assert first.status_code == 201 and first.json()["status"] == "received"
    again = await world.call("POST", f"{URL}/{live['id']}/report", None, json={"reason": "spam"})
    assert again.json()["status"] == "already_reported"
    member = await world.call(
        "POST",
        f"{URL}/{live['id']}/report",
        "b",
        json={"reason": "wrong_chords", "note": "G not F"},
    )
    assert member.json()["status"] == "received"
    own = await world.call("POST", f"{URL}/{live['id']}/report", "team", json={"reason": "spam"})
    assert own.status_code == 422
    (row,) = await world.rows(RecordingChordSheet)
    assert row.reports_count == 2
    waiting = (await offer(world, "a", body="Em A\nBaba")).json()
    quiet = await world.call("POST", f"{URL}/{waiting['id']}/report", "b", json={"reason": "spam"})
    assert quiet.status_code == 201 and "not live" in quiet.json()["message"]
    bad = await world.call("POST", f"{URL}/{live['id']}/report", "b", json={"reason": "nope"})
    assert bad.status_code == 422
    missing = await world.call("POST", f"{URL}/{uuid4()}/report", "b", json={"reason": "spam"})
    assert missing.status_code == 404


async def test_instrument_filter_and_oldest_first(world: World) -> None:
    ids = [
        (await offer(world, "team", body="Em A\nOne")).json()["id"],
        (
            await world.call(
                "POST",
                f"{URL}/recordings/{REC}",
                "team",
                json={**payload("Dm G\nTwo"), "instrument": "harmonium"},
            )
        ).json()["id"],
        (await offer(world, "team", body="Cm Fm\nThree")).json()["id"],
    ]
    base = datetime.now(UTC) - timedelta(hours=1)
    for i, sheet_id in enumerate(ids):  # unambiguous order on a fast machine
        await world.update(
            RecordingChordSheet, UUID(sheet_id), created_at=base + timedelta(minutes=i)
        )
    items = await listing(world, None)
    assert [i["body"].split("\n")[1] for i in items] == ["One", "Two", "Three"]
    only = await listing(world, None, instrument="harmonium")
    assert len(only) == 1 and only[0]["instrument"] == "harmonium"
    assert "member_id" not in json.dumps(items)
