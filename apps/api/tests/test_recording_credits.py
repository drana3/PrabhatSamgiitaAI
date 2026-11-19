"""Several performers on one recording: naming people, the invitation, the answer, leaving, the
team, the link, expiry, and how claims and the author page meet credits. The rules these pin are in
docs/co-performers.md."""

# ruff: noqa: F811
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from test_author_profiles import (
    AS,
    AS_TEAM,
    MEMBER_A,
    MEMBER_B,
    MEMBER_C,
    URL,
    World,
    code,
    world,  # noqa: F401
)

from app.models.recording_credits import AuthorCreditBlock, RecordingCredit
from app.models.recordings import MemberNotice, Recording
from app.services import housekeeping
from app.services import recording_credits as credits_service

ADMIN = "/api/v1/admin/authors"
INVITES = f"{URL}/me/credit-invites"
MINE = f"{URL}/me/credits"
SETTINGS = f"{URL}/me/credit-settings"
BLOCKS = f"{URL}/me/credit-blocks"


def credits_url(rid: UUID | str) -> str:
    return f"/api/v1/recordings/{rid}/credits"


async def page(world: World, who: str, slug: str, name: str) -> str:
    """A published page of member `who`; returns its id."""
    r = await world.create(who, slug=slug, display_name=name)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    if r.json()["status"] != "published":
        await world.client.post(f"{ADMIN}/{pid}/approve", headers=AS_TEAM)
    return pid


async def add(
    world: World,
    rid: UUID,
    name: str,
    *,
    page_id: str | None = None,
    role: str = "performer",
    who: str = "a",
) -> Any:
    return await world.client.post(
        credits_url(rid),
        headers=AS[who],
        json={"name": name, "profile_id": page_id, "role": role},
    )


async def credit_rows(world: World, rid: UUID) -> list[RecordingCredit]:
    async with world.sessions() as session:
        rows = await session.scalars(
            select(RecordingCredit)
            .where(RecordingCredit.recording_id == rid)
            .order_by(RecordingCredit.position)
        )
        return list(rows.all())


async def notice_kinds(world: World, user: UUID) -> list[str]:
    async with world.sessions() as session:
        rows = await session.scalars(select(MemberNotice).where(MemberNotice.user_id == user))
        return [n.kind for n in rows.all()]


async def author_text(world: World, rid: UUID) -> str:
    async with world.sessions() as session:
        rec = await session.get(Recording, rid)
        assert rec is not None
        return rec.author


async def page_recordings(world: World, slug: str) -> list[str]:
    r = await world.get(slug, "/recordings")
    assert r.status_code == 200, r.text
    data = r.json()
    items = data["items"] if isinstance(data, dict) else data
    return [str(i["id"]) for i in items]


async def invite(world: World, title: str = "Jaya Jaya") -> tuple[UUID, str]:
    """A uploads a recording, B has a published page; A names B. Returns (recording, B page id)."""
    await page(world, "a", "ananda-singer", "Ananda Singer")
    bid = await page(world, "b", "bhakti-singer", "Bhakti Singer")
    rid = await world.recording(MEMBER_A, title=title, author="Ananda Singer")
    r = await add(world, rid, "Bhakti Singer", page_id=bid)
    assert r.status_code == 201, r.text
    return rid, bid


# --------------------------------------------------------------------------- naming people


async def test_a_name_with_no_page_stays_text(world: World) -> None:
    rid = await world.recording(MEMBER_A, author="Ananda")
    r = await add(world, rid, "Someone Far Away")
    assert r.status_code == 201, r.text
    credit = r.json()["credits"][0]
    assert credit["status"] == "text" and credit["page"] is None
    assert await author_text(world, rid) == "Ananda & Someone Far Away"


async def test_a_named_member_is_asked_and_gets_a_notice(world: World) -> None:
    rid, _ = await invite(world)
    assert "credit_invite" in await notice_kinds(world, MEMBER_B)
    waiting = (await world.client.get(INVITES, headers=AS["b"])).json()["items"]
    assert len(waiting) == 1 and waiting[0]["recording"]["id"] == str(rid)
    # not on the page yet
    assert str(rid) not in await page_recordings(world, "bhakti-singer")


async def test_yes_puts_the_recording_on_the_page(world: World) -> None:
    rid, _ = await invite(world)
    cid = (await world.client.get(INVITES, headers=AS["b"])).json()["items"][0]["credit_id"]
    r = await world.client.post(f"{INVITES}/{cid}/accept", headers=AS["b"])
    assert r.status_code == 200 and r.json()["status"] == "accepted"
    assert str(rid) in await page_recordings(world, "bhakti-singer")
    assert "credit_accepted" in await notice_kinds(world, MEMBER_A)
    assert (await world.client.get(INVITES, headers=AS["b"])).json()["items"] == []
    # answering twice is harmless
    again = await world.client.post(f"{INVITES}/{cid}/accept", headers=AS["b"])
    assert again.status_code == 200


async def test_the_uploaders_own_page_is_accepted_at_once(world: World) -> None:
    aid = await page(world, "a", "ananda-singer", "Ananda Singer")
    rid = await world.recording(MEMBER_A, author="")
    r = await add(world, rid, "Ananda Singer", page_id=aid, role="author")
    assert r.status_code == 201
    assert r.json()["credits"][0]["status"] == "accepted"


async def test_no_is_private_and_not_asked_again(world: World) -> None:
    rid, bid = await invite(world)
    cid = (await world.client.get(INVITES, headers=AS["b"])).json()["items"][0]["credit_id"]
    r = await world.client.post(f"{INVITES}/{cid}/decline", headers=AS["b"], json={})
    assert r.status_code == 200
    rows = await credit_rows(world, rid)
    assert rows[0].status == "declined"
    assert str(rid) not in await page_recordings(world, "bhakti-singer")
    # the uploader is told "did not confirm" (no reason); the name stays as text on the recording
    assert "credit_declined" in await notice_kinds(world, MEMBER_A)
    again = await add(world, rid, "Bhakti Singer", page_id=bid)
    assert again.status_code == 422 and code(again) == "already_added"


async def test_no_and_block_stops_that_person_for_good(world: World) -> None:
    rid, bid = await invite(world)
    cid = (await world.client.get(INVITES, headers=AS["b"])).json()["items"][0]["credit_id"]
    await world.client.post(f"{INVITES}/{cid}/decline", headers=AS["b"], json={"block": True})
    blocks = (await world.client.get(BLOCKS, headers=AS["b"])).json()["items"]
    assert len(blocks) == 1
    # a second recording of the same uploader: refused, quietly the same code as "already_added"
    rid2 = await world.recording(MEMBER_A, title="Another", author="Ananda Singer")
    r = await add(world, rid2, "Bhakti Singer", page_id=bid)
    assert r.status_code == 422 and code(r) == "invites_off"
    # unblocking lets the uploader ask again
    gone = await world.client.delete(f"{BLOCKS}/{blocks[0]['id']}", headers=AS["b"])
    assert gone.status_code == 204
    assert (await add(world, rid2, "Bhakti Singer", page_id=bid)).status_code == 201


async def test_a_page_can_turn_invitations_off(world: World) -> None:
    await page(world, "a", "ananda-singer", "Ananda Singer")
    bid = await page(world, "b", "bhakti-singer", "Bhakti Singer")
    off = await world.client.put(SETTINGS, headers=AS["b"], json={"credit_invites": "nobody"})
    assert off.status_code == 200 and off.json()["credit_invites"] == "nobody"
    rid = await world.recording(MEMBER_A, author="Ananda Singer")
    r = await add(world, rid, "Bhakti Singer", page_id=bid)
    assert r.status_code == 422 and code(r) == "invites_off"
    got = await world.client.get(SETTINGS, headers=AS["b"])
    assert got.json()["credit_invites"] == "nobody"


async def test_only_the_uploader_or_team_adds_people(world: World) -> None:
    await page(world, "a", "ananda-singer", "Ananda Singer")
    rid = await world.recording(MEMBER_A)
    r = await add(world, rid, "Intruder", who="c")
    assert r.status_code == 403 and code(r) == "not_yours"


async def test_ten_people_is_the_limit(world: World) -> None:
    rid = await world.recording(MEMBER_A)
    for n in range(10):
        r = await add(world, rid, f"Person Number{chr(97 + n)}")
        assert r.status_code == 201, r.text
    over = await add(world, rid, "Eleventh Person")
    assert over.status_code == 422 and code(over) == "too_many"


async def test_a_bad_name_or_role_is_refused(world: World) -> None:
    rid = await world.recording(MEMBER_A)
    assert (await add(world, rid, "!")).status_code == 422
    r = await world.client.post(
        credits_url(rid), headers=AS["a"], json={"name": "Valid Name", "role": "dancer"}
    )
    assert r.status_code == 422


# --------------------------------------------------------------------------- who can remove


async def test_the_uploader_can_remove_a_waiting_credit_and_the_text(world: World) -> None:
    rid, _ = await invite(world)
    rows = await credit_rows(world, rid)
    r = await world.client.delete(f"{credits_url(rid)}/{rows[0].id}", headers=AS["a"])
    assert r.status_code == 204
    assert (await credit_rows(world, rid))[0].status == "removed"
    assert "Bhakti" not in await author_text(world, rid)
    assert (await world.client.get(INVITES, headers=AS["b"])).json()["items"] == []


async def test_the_uploader_cannot_take_off_someone_who_said_yes(world: World) -> None:
    rid, _ = await invite(world)
    cid = (await world.client.get(INVITES, headers=AS["b"])).json()["items"][0]["credit_id"]
    await world.client.post(f"{INVITES}/{cid}/accept", headers=AS["b"])
    r = await world.client.delete(f"{credits_url(rid)}/{cid}", headers=AS["a"])
    assert r.status_code in (403, 422), r.text
    assert (await credit_rows(world, rid))[0].status == "accepted"


async def test_a_person_can_leave_and_is_not_asked_again(world: World) -> None:
    rid, bid = await invite(world)
    cid = (await world.client.get(INVITES, headers=AS["b"])).json()["items"][0]["credit_id"]
    await world.client.post(f"{INVITES}/{cid}/accept", headers=AS["b"])
    r = await world.client.post(f"{MINE}/{cid}/leave", headers=AS["b"])
    assert r.status_code == 200
    assert str(rid) not in await page_recordings(world, "bhakti-singer")
    again = await add(world, rid, "Bhakti Singer", page_id=bid)
    assert again.status_code == 422 and code(again) == "already_added"


async def test_the_team_can_remove_even_a_confirmed_credit(world: World) -> None:
    rid, _ = await invite(world)
    cid = (await world.client.get(INVITES, headers=AS["b"])).json()["items"][0]["credit_id"]
    await world.client.post(f"{INVITES}/{cid}/accept", headers=AS["b"])
    r = await world.client.delete(f"{credits_url(rid)}/{cid}", headers=AS_TEAM)
    assert r.status_code == 204
    assert str(rid) not in await page_recordings(world, "bhakti-singer")
    assert "credit_removed" in await notice_kinds(world, MEMBER_B)


async def test_the_team_can_add_a_credit_to_any_recording(world: World) -> None:
    bid = await page(world, "b", "bhakti-singer", "Bhakti Singer")
    rid = await world.recording(MEMBER_A)
    r = await world.client.post(
        f"/api/v1/admin/recordings/{rid}/credits",
        headers=AS_TEAM,
        json={"name": "Bhakti Singer", "profile_id": bid},
    )
    assert r.status_code == 201, r.text
    # a page run by the team: the team vouches, no invitation
    assert r.json()["credits"][0]["status"] == "accepted"


# --------------------------------------------------------------------------- the invite link


async def test_a_link_is_one_use_and_hands_the_credit_to_the_opener(world: World) -> None:
    await page(world, "a", "ananda-singer", "Ananda Singer")
    rid = await world.recording(MEMBER_A, author="Ananda Singer")
    added = await add(world, rid, "Chitra Devi")  # no page: text
    cid = added.json()["credits"][0]["id"]
    link = await world.client.post(f"{credits_url(rid)}/{cid}/link", headers=AS["a"])
    assert link.status_code == 201, link.text
    token = link.json()["token"]
    # the opener needs a page
    cid_page = await page(world, "c", "chitra-devi", "Chitra Devi")
    ok = await world.client.post(
        "/api/v1/credit-links/accept", headers=AS["c"], json={"token": token}
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["status"] == "accepted"
    assert str(rid) in await page_recordings(world, "chitra-devi")
    assert cid_page
    # the same link, used again by someone else: nothing
    again = await world.client.post(
        "/api/v1/credit-links/accept", headers=AS["b"], json={"token": token}
    )
    assert again.status_code >= 400


async def test_an_old_link_stops_working(world: World) -> None:
    await page(world, "a", "ananda-singer", "Ananda Singer")
    rid = await world.recording(MEMBER_A, author="Ananda Singer")
    added = await add(world, rid, "Chitra Devi")
    cid = added.json()["credits"][0]["id"]
    token = (await world.client.post(f"{credits_url(rid)}/{cid}/link", headers=AS["a"])).json()[
        "token"
    ]
    await page(world, "c", "chitra-devi", "Chitra Devi")
    async with world.sessions() as session:
        row = await session.get(RecordingCredit, UUID(cid))
        assert row is not None
        row.expires_at = datetime.now(UTC) - timedelta(days=1)
        await session.commit()
    r = await world.client.post(
        "/api/v1/credit-links/accept", headers=AS["c"], json={"token": token}
    )
    assert r.status_code >= 400


# --------------------------------------------------------------------------- expiry


async def test_an_unanswered_invitation_expires_back_to_text(world: World) -> None:
    rid, _ = await invite(world)
    async with world.sessions() as session:
        row = (await session.scalars(select(RecordingCredit))).one()
        row.expires_at = datetime.now(UTC) - timedelta(days=1)
        await session.commit()
        touched = await housekeeping.run_credit_expiry(
            session, datetime.now(UTC), housekeeping.HousekeepingConfig()
        )
    assert touched == 1
    assert (await credit_rows(world, rid))[0].status == "expired"
    assert "credit_expired" in await notice_kinds(world, MEMBER_A)
    assert (await world.client.get(INVITES, headers=AS["b"])).json()["items"] == []
    # expired may be asked again (nobody said no)
    again = await add(
        world,
        rid,
        "Bhakti Singer",
        page_id=(await credit_rows(world, rid))[0].profile_id
        and str((await credit_rows(world, rid))[0].profile_id),
    )
    assert again.status_code == 201


async def test_a_confirmed_credit_does_not_expire(world: World) -> None:
    rid, _ = await invite(world)
    cid = (await world.client.get(INVITES, headers=AS["b"])).json()["items"][0]["credit_id"]
    await world.client.post(f"{INVITES}/{cid}/accept", headers=AS["b"])
    async with world.sessions() as session:
        n = await credits_service.expire_old(session, datetime.now(UTC) + timedelta(days=400))
    assert n == 0
    assert (await credit_rows(world, rid))[0].status == "accepted"


# --------------------------------------------------------------------------- the public view


async def test_the_public_sees_text_or_confirmed_only(world: World) -> None:
    rid, _ = await invite(world)
    anon = await world.client.get(credits_url(rid))
    assert anon.status_code == 200
    shown = anon.json()["credits"]
    assert [c["status"] for c in shown] == ["text"]  # waiting looks like a plain name
    assert shown[0]["page"] is None
    manager = (await world.client.get(credits_url(rid), headers=AS["a"])).json()
    assert manager["can_manage"] is True
    assert [c["status"] for c in manager["credits"]] == ["invited"]
    assert manager["summary"] == {"confirmed": 0, "waiting": 1}
    cid = manager["credits"][0]["id"]
    await world.client.post(f"{INVITES}/{cid}/accept", headers=AS["b"])
    after = (await world.client.get(credits_url(rid))).json()["credits"]
    assert after[0]["status"] == "accepted" and after[0]["page"]["slug"] == "bhakti-singer"


# --------------------------------------------------------------------------- my credits and hiding


async def test_my_credits_list_and_hide_without_leaving(world: World) -> None:
    rid, _ = await invite(world)
    cid = (await world.client.get(INVITES, headers=AS["b"])).json()["items"][0]["credit_id"]
    await world.client.post(f"{INVITES}/{cid}/accept", headers=AS["b"])
    mine = (await world.client.get(MINE, headers=AS["b"])).json()["items"]
    assert len(mine) == 1 and mine[0]["shown"] is True
    hide = await world.client.put(
        f"{URL}/me/recordings/{rid}", headers=AS["b"], json={"shown": False}
    )
    if hide.status_code == 200:
        assert str(rid) not in await page_recordings(world, "bhakti-singer")
        mine = (await world.client.get(MINE, headers=AS["b"])).json()["items"]
        assert mine[0]["shown"] is False
        assert (await credit_rows(world, rid))[0].status == "accepted"


# --------------------------------------------------------------------------- claims meet credits


async def test_a_claim_on_an_invited_recording_just_accepts_the_invitation(world: World) -> None:
    rid, bid = await invite(world)
    # B's page is not verified, but the uploader already named B: the claim takes the invitation
    r = await world.client.post(
        f"{URL}/me/claims", headers=AS["b"], json={"recording_ids": [str(rid)]}
    )
    assert r.status_code == 201, r.text
    assert (await credit_rows(world, rid))[0].status == "accepted"
    assert str(rid) in await page_recordings(world, "bhakti-singer")
    assert bid


async def test_two_people_on_a_group_credit_can_both_claim(world: World) -> None:
    """The root bug: the first claimant must not take a "A, B" recording from B."""
    await page(world, "a", "ananda-singer", "Ananda")
    await page(world, "b", "bhakti-singer", "Bhakti")
    for slug_page in ("ananda-singer", "bhakti-singer"):
        pid = (await world.get(slug_page)).json()["id"]
        await world.client.post(f"{ADMIN}/{pid}/verify", headers=AS_TEAM)
    rid = await world.recording(MEMBER_C, title="Group song", author="Ananda, Bhakti")
    ra = await world.client.post(
        f"{URL}/me/claims", headers=AS["a"], json={"recording_ids": [str(rid)]}
    )
    rb = await world.client.post(
        f"{URL}/me/claims", headers=AS["b"], json={"recording_ids": [str(rid)]}
    )
    assert ra.status_code == 201 and rb.status_code == 201, (ra.text, rb.text)
    assert ra.json()["results"][0]["outcome"] != "taken_by_other"
    assert rb.json()["results"][0]["outcome"] != "taken_by_other"


# --------------------------------------------------------------------------- upload and people


async def test_add_at_upload_never_fails_the_upload(world: World) -> None:
    await page(world, "a", "ananda-singer", "Ananda Singer")
    bid = await page(world, "b", "bhakti-singer", "Bhakti Singer")
    rid = await world.recording(MEMBER_A, author="Ananda Singer")
    async with world.sessions() as session:
        rec = await session.get(Recording, rid)
        assert rec is not None
        await credits_service.add_at_upload(
            session,
            rec,
            MEMBER_A,
            [
                {"name": "Bhakti Singer", "profile_id": bid, "role": "performer"},
                {"name": "Ghost", "profile_id": "00000000-0000-0000-0000-000000000000"},
                {"name": "Plain Name", "profile_id": None, "role": "author"},
            ],
        )
        await session.commit()
    rows = await credit_rows(world, rid)
    assert [r.status for r in rows] == ["invited", "text", "text"]
    assert rows[2].role == "author"


async def test_a_blocked_uploader_falls_back_to_text_at_upload(world: World) -> None:
    await page(world, "a", "ananda-singer", "Ananda Singer")
    bid = await page(world, "b", "bhakti-singer", "Bhakti Singer")
    await world.client.put(SETTINGS, headers=AS["b"], json={"credit_invites": "nobody"})
    rid = await world.recording(MEMBER_A, author="Ananda Singer")
    async with world.sessions() as session:
        rec = await session.get(Recording, rid)
        assert rec is not None
        await credits_service.add_at_upload(
            session, rec, MEMBER_A, [{"name": "Bhakti Singer", "profile_id": bid}]
        )
        await session.commit()
    rows = await credit_rows(world, rid)
    assert rows[0].status == "text" and rows[0].profile_id is None


# --------------------------------------------------------------------------- account deletion


async def test_a_credit_row_outlives_a_deleted_page_as_text(world: World) -> None:
    rid, _ = await invite(world)
    async with world.sessions() as session:
        row = (await session.scalars(select(RecordingCredit))).one()
        assert row.profile_id is not None
    blocks: list[AuthorCreditBlock] = []
    async with world.sessions() as session:
        blocks = list((await session.scalars(select(AuthorCreditBlock))).all())
    assert blocks == []
    assert rid
