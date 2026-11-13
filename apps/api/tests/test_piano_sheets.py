"""Piano notes: shape rules, who goes live, limits, versions, reports, review, privacy."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.models.piano_sheets import PianoSheet
from app.models.recordings import MemberNotice, Recording
from app.schemas.piano_sheets import PianoSheetCreate
from app.services import piano_sheets as service
from tests.extras_support import MEMBER_A, MEMBER_B, REC, REC_REMOVED, TEAM, World
from tests.piano_support import world_fixture as world_fixture  # noqa: F401

URL = "/api/v1/piano-notes"


def steps(*notes: int, beats: float = 1) -> list[dict]:
    return [{"k": [n] if n is not None else [], "b": beats} for n in notes]


def sheet(*notes: int, **extra) -> dict:
    base = {"sa_key": "C", "rows": [{"steps": steps(*(notes or (0, 2, 4, 5)))}]}
    return {**base, **extra}


async def offer(world: World, who: str | None = "a", rec=REC, **kwargs):
    return await world.call("POST", f"{URL}/recordings/{rec}", who, json=sheet(**kwargs))


async def listing(world: World, who: str | None = None, rec=REC):
    response = await world.call("GET", f"{URL}/recordings/{rec}", who)
    assert response.status_code == 200, response.text
    return response.json()["items"]


# --------------------------------------------------------------------------- shape rules


def test_steps_are_sorted_and_beats_come_in_quarters() -> None:
    parsed = PianoSheetCreate.model_validate(
        {"rows": [{"steps": [{"k": [7, 0, 0, 4], "b": 1.5}, {"k": [2], "b": 0.25}]}]}
    )
    assert parsed.rows[0].steps[0].k == [0, 4, 7]
    with pytest.raises(ValueError):
        PianoSheetCreate.model_validate({"rows": [{"steps": [{"k": [0], "b": 0.3}]}]})
    with pytest.raises(ValueError):
        PianoSheetCreate.model_validate({"rows": [{"steps": [{"k": [99], "b": 1}]}]})
    with pytest.raises(ValueError):
        PianoSheetCreate.model_validate({"rows": []})


def test_clean_rows_works_out_the_level_and_counts_sounding_steps() -> None:
    right = PianoSheetCreate.model_validate(
        {"rows": [{"steps": [{"k": [0], "b": 1}, {"k": [], "b": 1}, {"k": [2], "b": 1}]}]}
    )
    score, sounding, level = service.clean_rows(right)
    assert (sounding, level) == (2, "one_finger") and score["rows"][0]["hand"] == "right"
    both = PianoSheetCreate.model_validate(
        {
            "rows": [
                {"steps": [{"k": [0], "b": 1}, {"k": [2], "b": 1}]},
                {"hand": "left", "steps": [{"k": [-12], "b": 2}]},
            ]
        }
    )
    assert service.clean_rows(both)[2] == "two_hands"


def test_one_note_is_not_a_sheet() -> None:
    one = PianoSheetCreate.model_validate({"rows": [{"steps": [{"k": [0], "b": 1}]}]})
    with pytest.raises(HTTPException) as caught:
        service.clean_rows(one)
    assert caught.value.status_code == 422


@pytest.mark.parametrize(
    "link",
    [
        "http://example.org/a.pdf",
        "https://localhost/a",
        "https://127.0.0.1/a",
        "https://user:pw@example.org/a",
        "https://example.org/a b",
        "ftp://example.org/a",
        "https://nodot/a",
    ],
)
def test_bad_links_are_refused(link: str) -> None:
    with pytest.raises(HTTPException):
        service.clean_link(link)


def test_a_https_link_passes_and_empty_is_none() -> None:
    assert service.clean_link(" https://example.org/notes.pdf ") == "https://example.org/notes.pdf"
    assert service.clean_link("  ") is None


def test_links_in_a_note_are_refused() -> None:
    with pytest.raises(HTTPException):
        service.clean_note("see https://example.org")
    assert service.clean_note("easy tune") == "easy tune"


def test_who_goes_live() -> None:
    assert service.goes_live(team=True, owner=False, link=None)
    assert service.goes_live(team=True, owner=False, link="https://example.org/x")
    assert service.goes_live(team=False, owner=True, link=None)
    assert not service.goes_live(team=False, owner=True, link="https://example.org/x")
    assert not service.goes_live(team=False, owner=False, link=None)


# --------------------------------------------------------------------------- offering


async def test_a_stranger_waits_for_review_and_sees_only_her_own(world: World) -> None:
    response = await offer(world, "a")
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "pending" and body["mine"] is True and body["level"] == "one_finger"
    assert await listing(world, None) == []
    assert await listing(world, "b") == []
    assert [i["id"] for i in await listing(world, "a")] == [body["id"]]


async def test_sign_in_is_required_to_offer(world: World) -> None:
    assert (await offer(world, None)).status_code == 401


async def test_the_team_goes_live_at_once(world: World) -> None:
    body = (await offer(world, "team")).json()
    assert body["status"] == "published"
    assert [i["id"] for i in await listing(world, None)] == [body["id"]]


async def test_the_author_of_the_recording_goes_live_at_once(world: World) -> None:
    await world.update(Recording, REC, author_id=MEMBER_A)
    body = (await offer(world, "a")).json()
    assert body["status"] == "published" and body["by_recording_author"] is True
    # somebody else's sheet still waits
    assert (await offer(world, "b")).json()["status"] == "pending"


async def test_the_author_with_a_link_still_waits(world: World) -> None:
    await world.update(Recording, REC, author_id=MEMBER_A)
    body = (await offer(world, "a", link_url="https://example.org/notes.pdf")).json()
    assert body["status"] == "pending" and body["link_url"] == "https://example.org/notes.pdf"


async def test_a_removed_recording_takes_no_notes(world: World) -> None:
    assert (await offer(world, "a", rec=REC_REMOVED)).status_code == 404


async def test_a_song_sheet_is_live_only_for_the_team(world: World) -> None:
    mine = await world.call("POST", f"{URL}/songs/1", "a", json=sheet())
    assert mine.status_code == 201 and mine.json()["status"] == "pending"
    assert mine.json()["song_number"] == 1
    team = await world.call("POST", f"{URL}/songs/1", "team", json=sheet(0, 2, 4, 7))
    assert team.json()["status"] == "published"
    listed = (await world.call("GET", f"{URL}/songs/1")).json()
    assert [i["id"] for i in listed["items"]] == [team.json()["id"]]
    assert (await world.call("POST", f"{URL}/songs/9999", "a", json=sheet())).status_code == 422


async def test_the_same_notes_twice_are_a_duplicate(world: World) -> None:
    assert (await offer(world, "a")).status_code == 201
    again = await offer(world, "a")
    assert again.status_code == 409 and again.headers["X-Error-Code"] == "piano_duplicate"
    # other key of Sa = other sheet
    assert (await offer(world, "a", sa_key="D")).status_code == 201


async def test_three_open_sheets_per_recording(world: World) -> None:
    for notes in ((1, 2), (1, 4), (1, 5)):
        response = await world.call("POST", f"{URL}/recordings/{REC}", "a", json=sheet(*notes))
        assert response.status_code == 201
    blocked = await world.call("POST", f"{URL}/recordings/{REC}", "a", json=sheet(3, 6))
    assert blocked.status_code == 409 and blocked.headers["X-Error-Code"] == "piano_open_limit"
    # another recording is a fresh place
    await world.update(Recording, REC_REMOVED, status="published")
    other = await world.call("POST", f"{URL}/recordings/{REC_REMOVED}", "a", json=sheet(3, 6))
    assert other.status_code == 201


async def test_the_daily_limit_and_a_deleted_sheet_gives_the_place_back(world: World) -> None:
    async with world.sessions() as session:
        for index in range(10):
            session.add(
                PianoSheet(
                    id=uuid4(),
                    recording_id=REC,
                    target_key=f"recording:{REC}",
                    member_id=MEMBER_B,
                    score={"rows": [{"steps": [{"k": [index], "b": 1}]}]},
                    status="rejected",
                    created_at=datetime.now(UTC) - timedelta(hours=1),
                )
            )
            await session.commit()
    blocked = await offer(world, "b")
    assert blocked.status_code == 429 and blocked.headers["X-Error-Code"] == "piano_daily_limit"
    # the team has no daily limit
    assert (await offer(world, "team")).status_code == 201
    rows = await world.rows(PianoSheet)
    victim = next(r for r in rows if r.member_id == MEMBER_B)
    assert (await world.call("DELETE", f"{URL}/{victim.id}", "b")).status_code == 204
    assert (await offer(world, "b")).status_code == 201


async def test_the_hourly_limit(world: World) -> None:
    codes = []
    for index in range(8):
        response = await world.call(
            "POST", f"{URL}/recordings/{REC}", "team", json=sheet(index, index + 1)
        )
        codes.append(response.status_code)
    assert codes == [201] * 8  # the team hour is 120
    service.limiter.reset()
    seen = []
    for index in range(7):
        # a member: delete each so the open limit never trips
        response = await world.call(
            "POST", f"{URL}/recordings/{REC}", "b", json=sheet(index + 20, index + 21)
        )
        seen.append(response.status_code)
        if response.status_code == 201:
            await world.call("DELETE", f"{URL}/{response.json()['id']}", "b")
    assert seen[:6] == [201] * 6 and seen[6] == 429


async def test_bad_content_costs_no_hourly_place(world: World) -> None:
    for _ in range(10):
        bad = await world.call(
            "POST", f"{URL}/recordings/{REC}", "a", json={"rows": [{"steps": steps(0)}]}
        )
        assert bad.status_code == 422
    assert (await offer(world, "a")).status_code == 201


# --------------------------------------------------------------------------- versions


async def test_a_changed_version_archives_the_old_one(world: World) -> None:
    await world.update(Recording, REC, author_id=MEMBER_A)
    first = (await offer(world, "a")).json()
    changed = await world.call(
        "POST",
        f"{URL}/recordings/{REC}",
        "a",
        json=sheet(0, 2, 4, 7, replaces_id=first["id"]),
    )
    assert changed.status_code == 201 and changed.json()["status"] == "published"
    assert changed.json()["replaces"] == first["id"]
    ids = [i["id"] for i in await listing(world, None)]
    assert ids == [changed.json()["id"]]


async def test_a_strangers_id_in_replaces_is_ignored(world: World) -> None:
    team = (await offer(world, "team")).json()
    response = await world.call(
        "POST", f"{URL}/recordings/{REC}", "a", json=sheet(0, 7, replaces_id=team["id"])
    )
    assert response.status_code == 201 and response.json()["replaces"] is None
    assert [i["id"] for i in await listing(world, None)] == [team["id"]]


async def test_based_on_credits_the_original_while_it_is_live(world: World) -> None:
    original = (await offer(world, "team")).json()
    copy = await world.call(
        "POST", f"{URL}/recordings/{REC}", "a", json=sheet(0, 2, 7, based_on_id=original["id"])
    )
    assert copy.json()["based_on"] == {"id": original["id"], "name": "Carya"}
    await world.update(PianoSheet, UUID(original["id"]), is_anonymous=True)
    mine = [i for i in await listing(world, "a") if i["id"] == copy.json()["id"]][0]
    assert mine["based_on"]["name"] is None


async def test_live_notes_are_not_edited_in_place(world: World) -> None:
    live = (await offer(world, "team")).json()
    response = await world.call("PUT", f"{URL}/{live['id']}", "team", json=sheet(0, 3))
    assert response.status_code == 409 and response.headers["X-Error-Code"] == "piano_not_editable"


async def test_the_author_fixes_a_rejected_sheet_and_sends_it_again(world: World) -> None:
    waiting = (await offer(world, "a")).json()
    rejected = await world.call(
        "POST", f"{URL}/review/{waiting['id']}/reject", "team", json={"reason": "wrong octave"}
    )
    assert rejected.status_code == 200 and rejected.json()["status"] == "rejected"
    mine = (await world.call("GET", f"{URL}/mine", "a")).json()["items"][0]
    assert mine["status"] == "rejected" and mine["rejected_reason"] == "wrong octave"
    fixed = await world.call("PUT", f"{URL}/{waiting['id']}", "a", json=sheet(0, 2, 4, 9))
    assert fixed.status_code == 200 and fixed.json()["status"] == "pending"
    assert fixed.json()["rejected_reason"] is None
    # a stranger cannot even learn that it exists
    assert (
        await world.call("PUT", f"{URL}/{waiting['id']}", "b", json=sheet(1, 2))
    ).status_code == 404
    assert (await world.call("DELETE", f"{URL}/{waiting['id']}", "b")).status_code == 404


# --------------------------------------------------------------------------- review


async def test_review_is_for_the_team_only(world: World) -> None:
    waiting = (await offer(world, "a")).json()
    assert (await world.call("GET", f"{URL}/review/queue", "a")).status_code in (401, 403)
    assert (await world.call("GET", f"{URL}/review/queue")).status_code in (401, 403)
    approve = await world.call("POST", f"{URL}/review/{waiting['id']}/approve", "b")
    assert approve.status_code in (401, 403)


async def test_approve_publishes_and_tells_the_author(world: World) -> None:
    waiting = (await offer(world, "a")).json()
    queue = (await world.call("GET", f"{URL}/review/queue", "team")).json()
    assert queue["total"] == 1 and queue["items"][0]["author_name"] == "Ananda"
    done = await world.call("POST", f"{URL}/review/{waiting['id']}/approve", "team")
    assert done.status_code == 200 and done.json()["status"] == "published"
    notices = await world.rows(MemberNotice)
    assert [(n.kind, n.user_id) for n in notices] == [("piano_published", MEMBER_A)]
    assert notices[0].payload["piano_sheet_id"] == waiting["id"]
    assert [i["id"] for i in await listing(world, None)] == [waiting["id"]]
    # approving twice changes nothing
    again = await world.call("POST", f"{URL}/review/{waiting['id']}/approve", "team")
    assert again.status_code == 200
    assert len(await world.rows(MemberNotice)) == 1


async def test_reject_needs_a_reason_notifies_and_can_be_restored(world: World) -> None:
    waiting = (await offer(world, "a")).json()
    short = await world.call(
        "POST", f"{URL}/review/{waiting['id']}/reject", "team", json={"reason": "x"}
    )
    assert short.status_code == 422
    ok = await world.call(
        "POST", f"{URL}/review/{waiting['id']}/reject", "team", json={"reason": "not this tune"}
    )
    assert ok.status_code == 200
    notices = await world.rows(MemberNotice)
    assert notices[0].kind == "piano_rejected" and "not this tune" in notices[0].body
    again = await world.call(
        "POST", f"{URL}/review/{waiting['id']}/reject", "team", json={"reason": "again"}
    )
    assert again.status_code == 409
    restored = await world.call("POST", f"{URL}/review/{waiting['id']}/restore", "team")
    assert restored.status_code == 200 and restored.json()["status"] == "published"
    not_rejected = await world.call("POST", f"{URL}/review/{waiting['id']}/restore", "team")
    assert not_rejected.status_code == 409


async def test_approving_a_new_version_archives_the_old_live_one(world: World) -> None:
    old = (await offer(world, "team")).json()
    async with world.sessions() as session:
        newer = PianoSheet(
            id=uuid4(),
            recording_id=REC,
            target_key=f"recording:{REC}",
            member_id=MEMBER_A,
            score={"rows": [{"steps": [{"k": [0], "b": 1}, {"k": [3], "b": 1}]}]},
            steps_count=2,
            status="pending",
            replaces_id=UUID(old["id"]),
        )
        session.add(newer)
        await session.commit()
        newer_id = newer.id
    await world.call("POST", f"{URL}/review/{newer_id}/approve", "team")
    assert [i["id"] for i in await listing(world, None)] == [str(newer_id)]


# --------------------------------------------------------------------------- reports


async def test_reports_once_each_and_not_for_own_or_not_live(world: World) -> None:
    live = (await offer(world, "team")).json()
    first = await world.call(
        "POST", f"{URL}/{live['id']}/report", "b", json={"reason": "wrong_notes"}
    )
    assert first.status_code == 201 and first.json()["status"] == "received"
    second = await world.call(
        "POST", f"{URL}/{live['id']}/report", "b", json={"reason": "wrong_notes"}
    )
    assert second.json()["status"] == "already_reported"
    anon = await world.call("POST", f"{URL}/{live['id']}/report", json={"reason": "spam"})
    assert anon.status_code == 201
    own = await world.call("POST", f"{URL}/{live['id']}/report", "team", json={"reason": "spam"})
    assert own.status_code == 422
    row = (await world.rows(PianoSheet))[0]
    assert row.reports_count == 2
    queue = (await world.call("GET", f"{URL}/review/queue?filter=reported", "team")).json()
    assert queue["total"] == 1 and queue["items"][0]["reports_count"] == 2
    waiting = (await offer(world, "a")).json()
    quiet = await world.call("POST", f"{URL}/{waiting['id']}/report", "b", json={"reason": "spam"})
    assert quiet.json()["message"].endswith("not live.")
    missing = await world.call("POST", f"{URL}/{uuid4()}/report", "b", json={"reason": "spam"})
    assert missing.status_code == 404


# --------------------------------------------------------------------------- privacy, shelf


async def test_an_anonymous_sheet_carries_no_trace_of_its_author(world: World) -> None:
    live = (await offer(world, "team", is_anonymous=True)).json()
    public = (await world.call("GET", f"{URL}/recordings/{REC}")).text
    assert live["id"] in public
    for trace in ("Carya", str(TEAM), "carya@example.org", "author_id"):
        assert trace not in public
    named = (await offer(world, "team", **{"sa_key": "G"})).json()
    assert named["author"] == {"name": "Carya"}


async def test_listing_is_never_shared_between_viewers(world: World) -> None:
    response = await world.call("GET", f"{URL}/recordings/{REC}")
    assert response.headers["cache-control"] == "private, no-store"


async def test_the_shelf_ids_hold_only_recordings_with_live_notes(world: World) -> None:
    assert (await world.call("GET", f"{URL}/recordings")).json() == {"recording_ids": []}
    await offer(world, "a")  # waiting: not counted
    assert (await world.call("GET", f"{URL}/recordings")).json()["recording_ids"] == []
    await offer(world, "team")
    response = await world.call("GET", f"{URL}/recordings")
    assert response.json()["recording_ids"] == [str(REC)]
    assert "max-age" in response.headers["cache-control"]
    await world.update(Recording, REC, status="removed")
    assert (await world.call("GET", f"{URL}/recordings")).json()["recording_ids"] == []


async def test_deleting_a_sheet_removes_its_reports_and_unlinks_copies(world: World) -> None:
    original = (await offer(world, "a")).json()
    await world.update(PianoSheet, UUID(original["id"]), status="published")
    copy = (
        await world.call(
            "POST", f"{URL}/recordings/{REC}", "b", json=sheet(0, 5, based_on_id=original["id"])
        )
    ).json()
    await world.call("POST", f"{URL}/{original['id']}/report", "b", json={"reason": "spam"})
    assert (await world.call("DELETE", f"{URL}/{original['id']}", "a")).status_code == 204
    left = await world.rows(PianoSheet)
    assert [str(r.id) for r in left] == [copy["id"]] and left[0].based_on_id is None
    rows = (await world.call("GET", f"{URL}/mine", "b")).json()["items"]
    assert rows[0]["recording_title"] == "Baba Nam Kevalam"
    assert (await world.call("GET", f"{URL}/mine")).status_code == 401
