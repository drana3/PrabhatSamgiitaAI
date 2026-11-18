"""Proof of identity for claiming recordings: sending a proof, the team's answer, how many proofs a
name needs, the e-mail code, the clock (reminder after 5 days, close after 14), the song-number
search and what a second page must never see. Rules: docs/author-profiles.md ("Proof of
identity")."""

# ruff: noqa: F811
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
import pytest_asyncio
from test_author_claims import (
    ADMIN,
    CLAIMS,
    DESK,
    claim,
    notices,
    verified_page,
)
from test_author_profiles import (
    AS,
    AS_TEAM,
    MEMBER_A,
    MEMBER_B,
    MEMBER_C,
    TEAM,
    World,
    world,  # noqa: F401
)

from app.models.author_profiles import AuthorClaim, AuthorClaimProof
from app.models.base import Base
from app.services import author_claims as claims_service
from app.services import author_proofs as proofs_service

PROOFS = f"{CLAIMS}/proofs"


@pytest_asyncio.fixture
async def pworld(world: World) -> AsyncIterator[World]:
    """The shared test world plus the table of proofs."""
    async with world.sessions() as session:
        connection = await session.connection()
        await connection.run_sync(
            lambda c: Base.metadata.create_all(c, tables=[AuthorClaimProof.__table__])  # type: ignore[list-item]
        )
        await session.commit()
    yield world


async def unverified_page(world: World, who: str = "a", **overrides: Any) -> str:
    r = await world.create(who, **overrides)
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def send(
    world: World, kind: str = "link", value: str = "https://youtube.com/@madhu", **extra: Any
) -> Any:
    r = await world.client.post(
        PROOFS, headers=AS["a"], json={"kind": kind, "value": value, **extra}
    )
    return r


async def state(world: World, who: str = "a") -> dict[str, Any]:
    r = await world.client.get(f"{CLAIMS}/request", headers=AS[who])
    assert r.status_code == 200, r.text
    return r.json()


async def proof_rows(world: World) -> list[AuthorClaimProof]:
    return await world.rows(AuthorClaimProof)


async def decide(world: World, proof_id: str, action: str, **body: Any) -> Any:
    return await world.client.post(f"{DESK}/proofs/{proof_id}/{action}", headers=AS_TEAM, json=body)


# --------------------------------------------------------------------------- sending a proof


async def test_a_request_without_a_proof_waits_on_the_person(pworld: World) -> None:
    await unverified_page(pworld)
    rid = await pworld.recording(MEMBER_B, author="Madhu Vrata")
    result = await claim(pworld, [rid])
    assert result["results"][0]["outcome"] == "pending"
    body = await state(pworld)
    assert body["stage"] == "no_proof" and body["verified"] is False
    assert body["pending_claims"] == 1 and body["required"] == 1 and body["have"] == 0
    assert body["closes_at"] is not None and body["answer_by"] is None


async def test_a_link_proof_goes_to_the_team_and_starts_the_three_day_clock(pworld: World) -> None:
    await unverified_page(pworld)
    r = await send(pworld, value="youtube.com/@madhu-vrata")
    assert r.status_code == 201, r.text
    assert r.json()["value"] == "https://youtube.com/@madhu-vrata"
    assert r.json()["status"] == "waiting"
    body = await state(pworld)
    assert body["stage"] == "with_team"
    assert len(body["proofs"]) == 1
    # nothing a code or a hash could leak
    assert "code_hash" not in str(body) and "profile" not in str(body["proofs"][0]).lower()


@pytest.mark.parametrize(
    ("kind", "value", "code"),
    [
        ("link", "javascript:alert(1)", "proof_link_invalid"),
        ("link", "http://example.org/x", "proof_link_invalid"),
        ("email", "not-an-address", "proof_email_invalid"),
        ("voice", "   ", "proof_empty"),
    ],
)
async def test_a_bad_proof_is_refused_with_a_reason(
    pworld: World, kind: str, value: str, code: str
) -> None:
    await unverified_page(pworld)
    r = await send(pworld, kind, value)
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == code


async def test_the_same_proof_twice_and_too_many_proofs_are_refused(pworld: World) -> None:
    await unverified_page(pworld)
    assert (await send(pworld)).status_code == 201
    again = await send(pworld)
    assert again.status_code == 409 and again.json()["detail"]["code"] == "proof_repeated"
    for i in range(proofs_service.PROOFS_MAX - 1):
        assert (await send(pworld, "voice", f"note {i}")).status_code == 201
    full = await send(pworld, "voice", "one more")
    assert full.status_code == 429 and full.json()["detail"]["code"] == "proofs_limit"


async def test_a_person_can_take_a_waiting_proof_back(pworld: World) -> None:
    await unverified_page(pworld)
    pid = (await send(pworld)).json()["id"]
    r = await pworld.client.delete(f"{PROOFS}/{pid}", headers=AS["a"])
    assert r.status_code == 204
    assert (await state(pworld))["stage"] == "no_proof"
    # somebody else's proof is not theirs to take back
    await pworld.create("b", slug="other-one", display_name="Other One")
    other = await pworld.client.delete(f"{PROOFS}/{pid}", headers=AS["b"])
    assert other.status_code == 404


# --------------------------------------------------------------------------- the team's answer


async def test_one_accepted_proof_verifies_the_page_and_approves_the_waiting_claims(
    pworld: World,
) -> None:
    pid = await unverified_page(pworld)
    rid = await pworld.recording(MEMBER_B, author="Madhu Vrata")
    assert (await claim(pworld, [rid]))["results"][0]["team_reason"] == "unverified_page"
    proof = (await send(pworld)).json()["id"]
    # the uploader is told nothing while the request waits
    assert await notices(pworld, MEMBER_B) == []
    r = await decide(pworld, proof, "ok", approve_waiting=True)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ok"
    body = await state(pworld)
    assert body["stage"] == "verified" and body["have"] == 1
    page = (await pworld.client.get(f"{DESK}/pages/{pid}", headers=AS_TEAM)).json()
    assert page["verified"] is True and page["approved"] == 1
    # the claim was approved, so the uploader hears of it now, and only now
    assert [n.kind for n in await notices(pworld, MEMBER_B)] == ["claim_on_your_recording"]
    assert "claim_proof_ok" in [n.kind for n in await notices(pworld, MEMBER_A)]


async def test_a_famous_name_needs_two_proofs_and_a_team_member_counts_for_two(
    pworld: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(claims_service, "FAMOUS_AFTER", 2)
    for i in range(3):
        await pworld.recording(None, title=f"Library {i}", author="Madhu Vrata")
    pid = await unverified_page(pworld)
    first = (await send(pworld)).json()["id"]
    second = (await send(pworld, "voice", "a note of my voice")).json()["id"]
    assert (await state(pworld))["required"] == 2
    assert (await state(pworld))["why_required"] == "famous"
    await decide(pworld, first, "ok")
    mid = await state(pworld)
    assert mid["verified"] is False and mid["have"] == 1
    await decide(pworld, second, "ok")
    assert (await state(pworld))["verified"] is True
    # a team member who knows the person is enough alone
    await pworld.client.post(f"{ADMIN}/{pid}/unverify", headers=AS_TEAM)
    vouch = (await send(pworld, "team", "Dada")).json()["id"]
    await decide(pworld, vouch, "ok")
    assert (await state(pworld))["verified"] is True


async def test_a_group_needs_two_proofs(pworld: World) -> None:
    await unverified_page(pworld, author_type="group")
    only = (await send(pworld)).json()["id"]
    body = await state(pworld)
    assert body["required"] == 2 and body["why_required"] == "group"
    await decide(pworld, only, "ok")
    assert (await state(pworld))["verified"] is False


async def test_decline_and_ask_for_more_tell_the_person_why(pworld: World) -> None:
    await unverified_page(pworld)
    proof = (await send(pworld)).json()["id"]
    missing = await decide(pworld, proof, "more")
    assert missing.status_code == 422 and missing.json()["detail"]["code"] == "note_needed"
    r = await decide(pworld, proof, "more", note="Add the link back to your page")
    assert r.status_code == 200 and r.json()["status"] == "more_needed"
    body = await state(pworld)
    assert body["stage"] == "need_more"
    assert body["proofs"][0]["team_note"] == "Add the link back to your page"
    kinds = [n.kind for n in await notices(pworld, MEMBER_A)]
    assert "claim_more_proof" in kinds
    # sending something new is the answer: the question is closed
    assert (await send(pworld, "voice", "my voice")).status_code == 201
    assert (await state(pworld))["stage"] == "with_team"
    other = (await state(pworld))["proofs"][-1]["id"]
    r = await decide(pworld, other, "decline", note="Cannot hear a name")
    assert r.json()["status"] == "declined"
    assert "claim_proof_declined" in [n.kind for n in await notices(pworld, MEMBER_A)]
    done = await decide(pworld, other, "ok")
    assert done.status_code == 409 and done.json()["detail"]["code"] == "proof_closed"


async def test_the_team_can_ask_for_more_when_nothing_was_sent(pworld: World) -> None:
    pid = await unverified_page(pworld)
    r = await pworld.client.post(
        f"{DESK}/pages/{pid}/ask-more", headers=AS_TEAM, json={"note": "Send a link"}
    )
    assert r.status_code == 200
    body = await state(pworld)
    assert body["stage"] == "need_more"
    assert body["proofs"][0]["team_note"] == "Send a link"
    assert "claim_more_proof" in [n.kind for n in await notices(pworld, MEMBER_A)]


async def test_only_the_team_sees_the_desk(pworld: World) -> None:
    pid = await unverified_page(pworld)
    proof = (await send(pworld)).json()["id"]
    for path in (f"{DESK}/proofs", f"{DESK}/pages/{pid}"):
        assert (await pworld.client.get(path, headers=AS["a"])).status_code == 403
    assert (await decide_as_member(pworld, proof)).status_code == 403
    listing = (await pworld.client.get(f"{DESK}/proofs", headers=AS_TEAM)).json()
    assert listing["total"] == 1 and listing["items"][0]["profile_slug"] == "madhu-vrata"
    summary = (await pworld.client.get(f"{DESK}/summary", headers=AS_TEAM)).json()
    assert summary["proofs_waiting"] == 1 and summary["overdue"] == 0


async def decide_as_member(world: World, proof_id: str) -> Any:
    return await world.client.post(f"{DESK}/proofs/{proof_id}/ok", headers=AS["a"], json={})


# --------------------------------------------------------------------------- the e-mail code


async def test_an_email_proof_is_confirmed_with_a_code_the_team_sends(
    pworld: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    await unverified_page(pworld)
    mails: list[dict[str, str]] = []

    def fake(**kwargs: str) -> bool:
        mails.append(kwargs)
        return True

    monkeypatch.setattr(proofs_service, "send_transactional_email", fake)
    proof = (await send(pworld, "email", "Madhu@Example.org")).json()
    assert proof["value"] == "madhu@example.org"
    sent = await pworld.client.post(f"{DESK}/proofs/{proof['id']}/send-code", headers=AS_TEAM)
    assert sent.json() == {"sent": True}
    assert mails[0]["to_address"] == "madhu@example.org"
    code = next(w for w in mails[0]["plain_text"].split() if w.rstrip(".").isdigit()).rstrip(".")
    assert (await state(pworld))["stage"] == "code"
    wrong = await pworld.client.post(
        f"{PROOFS}/{proof['id']}/code", headers=AS["a"], json={"code": "000000"}
    )
    assert wrong.status_code == 422 and wrong.json()["detail"]["code"] == "code_wrong"
    right = await pworld.client.post(
        f"{PROOFS}/{proof['id']}/code", headers=AS["a"], json={"code": code}
    )
    assert right.status_code == 200 and right.json()["code_confirmed"] is True
    assert right.json()["status"] == "waiting"
    assert (await state(pworld))["stage"] == "with_team"
    rows = await proof_rows(pworld)
    assert rows[0].code_hash is None  # a code is used once


async def test_five_wrong_codes_lock_the_code_and_a_missing_mail_server_is_told(
    pworld: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    await unverified_page(pworld)
    proof = (await send(pworld, "email", "madhu@example.org")).json()["id"]
    monkeypatch.setattr(proofs_service, "send_transactional_email", lambda **_: False)
    nothing = await pworld.client.post(f"{DESK}/proofs/{proof}/send-code", headers=AS_TEAM)
    assert nothing.json() == {"sent": False}
    assert (await state(pworld))["stage"] == "with_team"  # nothing left the server
    monkeypatch.setattr(proofs_service, "send_transactional_email", lambda **_: True)
    await pworld.client.post(f"{DESK}/proofs/{proof}/send-code", headers=AS_TEAM)
    last: Any = None
    for _ in range(proofs_service.CODE_TRIES_MAX):
        last = await pworld.client.post(
            f"{PROOFS}/{proof}/code", headers=AS["a"], json={"code": "111111"}
        )
    assert last.status_code == 429 and last.json()["detail"]["code"] == "code_locked"
    again = await pworld.client.post(
        f"{PROOFS}/{proof}/code", headers=AS["a"], json={"code": "111111"}
    )
    assert again.json()["detail"]["code"] == "code_not_sent"


async def test_a_code_is_only_for_an_email_proof(pworld: World) -> None:
    await unverified_page(pworld)
    proof = (await send(pworld)).json()["id"]
    r = await pworld.client.post(f"{DESK}/proofs/{proof}/send-code", headers=AS_TEAM)
    assert r.status_code == 422 and r.json()["detail"]["code"] == "proof_not_email"


# --------------------------------------------------------------------------- the clock


async def test_a_request_nobody_answers_closes_after_14_days_and_opens_with_a_proof(
    pworld: World,
) -> None:
    await unverified_page(pworld)
    rid = await pworld.recording(MEMBER_B, author="Madhu Vrata")
    await claim(pworld, [rid])
    now = datetime.now(UTC)
    async with pworld.sessions() as session:
        assert await proofs_service.run_timers(session, now + timedelta(days=13)) == 0
        assert await proofs_service.run_timers(session, now + timedelta(days=15)) == 1
    rows = await pworld.rows(AuthorClaim)
    assert rows[0].status == "rejected" and rows[0].decision_note == "no_proof"
    assert rows[0].decided_by == "system"
    assert (await state(pworld))["stage"] == "closed"
    assert "claim_closed_no_proof" in [n.kind for n in await notices(pworld, MEMBER_A)]
    # the person sends a proof: the request opens again
    assert (await send(pworld)).status_code == 201
    body = await state(pworld)
    assert body["stage"] == "with_team" and body["pending_claims"] == 1


async def test_a_request_that_waits_on_the_team_never_closes_but_reminds_after_5_days(
    pworld: World,
) -> None:
    await unverified_page(pworld)
    rid = await pworld.recording(MEMBER_B, author="Madhu Vrata")
    await claim(pworld, [rid])
    await send(pworld)
    now = datetime.now(UTC)
    async with pworld.sessions() as session:
        assert await proofs_service.run_timers(session, now + timedelta(days=4)) == 0
        first = await proofs_service.run_timers(session, now + timedelta(days=6))
        assert first >= 1
        assert await proofs_service.run_timers(session, now + timedelta(days=7)) == 0  # once
        assert await proofs_service.run_timers(session, now + timedelta(days=30)) == 0  # not closed
    assert (await state(pworld))["pending_claims"] == 1
    team = [n.kind for n in await notices(pworld, TEAM)]
    assert team == ["claim_team_reminder"]
    summary = (await pworld.client.get(f"{DESK}/summary", headers=AS_TEAM)).json()
    assert summary["proofs_waiting"] == 1


# --------------------------------------------------------------------------- what is hidden


async def test_a_second_page_asking_for_the_same_name_sees_nothing_about_the_first(
    pworld: World,
) -> None:
    await verified_page(pworld, "a")
    await unverified_page(pworld, "c", slug="chitra-songs", display_name="Chitra Songs")
    first = await pworld.recording(MEMBER_B, author="Chitra Songs")
    await claim(pworld, [first], "c")  # waits for the team
    # page a (a different name) asks for the same credit
    out = await pworld.client.post(CLAIMS, headers=AS["a"], json={"recording_ids": [str(first)]})
    assert out.status_code == 201
    assert out.json()["results"][0]["outcome"] == "pending"
    assert out.json()["results"][0]["team_reason"] is None
    mine = (await pworld.client.get(CLAIMS, headers=AS["a"])).json()
    assert "taken_by_other" not in str(mine) and "chitra-songs" not in str(mine)
    # the team does see it
    desk = (await pworld.client.get(DESK, headers=AS_TEAM)).json()
    row = next(i for i in desk["items"] if i["profile_slug"] == "madhu-vrata")
    assert row["team_reason"] == "taken_by_other"


async def test_a_look_alike_name_keeps_what_the_person_says_it_is_for_the_team(
    pworld: World,
) -> None:
    await verified_page(pworld)
    rid = await pworld.recording(MEMBER_B, author="Madhu Vrat")
    r = await pworld.client.post(
        CLAIMS,
        headers=AS["a"],
        json={"recording_ids": [str(rid)], "note": "My name on an old record label"},
    )
    assert r.json()["results"][0]["outcome"] == "pending"
    row = (await pworld.rows(AuthorClaim))[0]
    assert row.person_note == "My name on an old record label"
    desk = (await pworld.client.get(DESK, headers=AS_TEAM)).json()
    assert desk["items"][0]["person_note"] == "My name on an old record label"
    mine = (await pworld.client.get(CLAIMS, headers=AS["a"])).json()
    assert "person_note" not in str(mine)


# --------------------------------------------------------------------------- the team's two pages


async def test_the_team_sees_who_else_asks_and_can_put_a_recording_on_both_pages(
    pworld: World,
) -> None:
    await unverified_page(pworld, "a", slug="madhu-vrata", display_name="Madhu Vrata")
    await unverified_page(pworld, "b", slug="ravi-kiirtan", display_name="Ravi Kiirtan")
    shared = await pworld.recording(MEMBER_C, title="Duet", author="Madhu Vrata & Ravi Kiirtan")
    await claim(pworld, [shared], "a")
    await claim(pworld, [shared], "b")
    desk = (await pworld.client.get(DESK, headers=AS_TEAM)).json()
    assert desk["total"] == 2
    for item in desk["items"]:
        others = item["also_claimed_by"]
        assert len(others) == 1 and others[0]["slug"] != item["profile_slug"]
    first = next(i for i in desk["items"] if i["profile_slug"] == "madhu-vrata")
    r = await pworld.client.post(
        f"{DESK}/{first['id']}/approve", headers=AS_TEAM, json={"with_others": True}
    )
    assert r.json()["changed"] == 2
    rows = await pworld.rows(AuthorClaim)
    assert {c.status for c in rows} == {"approved"}


async def test_approve_can_verify_the_page_in_the_same_step(pworld: World) -> None:
    pid = await unverified_page(pworld)
    rid = await pworld.recording(MEMBER_B, author="Madhu Vrata")
    claim_id = (await claim(pworld, [rid]))["results"][0]["claim_id"]
    r = await pworld.client.post(
        f"{DESK}/{claim_id}/approve", headers=AS_TEAM, json={"verify_page": True}
    )
    assert r.status_code == 200
    page = (await pworld.client.get(f"{DESK}/pages/{pid}", headers=AS_TEAM)).json()
    assert page["verified"] is True and page["stage"] == "verified"
    assert "Madhu Vrata" in page["names"]


# --------------------------------------------------------------------------- song numbers


async def test_a_prabhat_samgiita_song_number_finds_its_recordings(pworld: World) -> None:
    await unverified_page(pworld)
    song = await pworld.recording(
        MEMBER_B,
        title="Ghano tamasaa",
        kind="prabhat_samgiita",
        author="Somebody Else",
        ps_song_number=1042,
    )
    await pworld.recording(
        MEMBER_B,
        title="Another song",
        kind="prabhat_samgiita",
        author="Somebody Else",
        ps_song_number=2001,
    )
    for query in ("1042", "#1042", "PS 1042", "Prabhat Samgiita 1042"):
        r = await pworld.client.get(f"{CLAIMS}/search", headers=AS["a"], params={"q": query})
        ids = [i["recording"]["id"] for i in r.json()["items"]]
        assert ids == [str(song)], query
    none = await pworld.client.get(f"{CLAIMS}/search", headers=AS["a"], params={"q": "9999"})
    assert none.json()["items"] == []


async def test_housekeeping_runs_the_claim_clock(pworld: World) -> None:
    from app.services import housekeeping

    assert "claim_timers" in {name for name, _ in housekeeping.CLEANUPS}
    async with pworld.sessions() as session:
        cfg = housekeeping.HousekeepingConfig.from_env()
        assert await housekeeping.run_claim_timers(session, datetime.now(UTC), cfg) == 0
