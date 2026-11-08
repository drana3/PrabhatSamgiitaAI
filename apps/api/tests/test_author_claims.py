"""Claiming recordings that somebody else added: finding them, the ladder (who decides), the team
desk, the notices and the limits. The rules these pin are in docs/author-profiles.md ("Claiming
recordings")."""

# ruff: noqa: F811
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import select
from test_author_profiles import (
    AS,
    AS_TEAM,
    MEMBER_A,
    MEMBER_B,
    MEMBER_C,
    TEAM,
    URL,
    World,
    code,
    world,  # noqa: F401
)

from app.models.author_profiles import AuthorAlias, AuthorClaim, AuthorClaimEvent
from app.models.recordings import MemberNotice
from app.services import author_claims as claims_service

CLAIMS = f"{URL}/me/claims"
DESK = "/api/v1/admin/authors/claims"
ADMIN = "/api/v1/admin/authors"


async def verified_page(world: World, who: str = "a", **overrides: Any) -> str:
    """A page the team approved and verified; returns its id."""
    r = await world.create(who, **overrides)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    if r.json()["status"] != "published":
        await world.client.post(f"{ADMIN}/{pid}/approve", headers=AS_TEAM)
    await world.client.post(f"{ADMIN}/{pid}/verify", headers=AS_TEAM)
    return pid


async def claim(world: World, ids: list[UUID], who: str = "a") -> Any:
    r = await world.client.post(
        CLAIMS, headers=AS[who], json={"recording_ids": [str(i) for i in ids]}
    )
    assert r.status_code == 201, r.text
    return r.json()


async def notices(world: World, user: UUID) -> list[MemberNotice]:
    async with world.sessions() as session:
        rows = await session.scalars(select(MemberNotice).where(MemberNotice.user_id == user))
        return list(rows.all())


# --------------------------------------------------------------------------- finding recordings


async def test_suggestions_find_the_same_name_and_the_alike_ones(world: World) -> None:
    await world.create()
    same = await world.recording(MEMBER_B, title="One", author="Madhu Vrata")
    spelled = await world.recording(None, title="Two", author="Madhuvrata")
    alike = await world.recording(MEMBER_C, title="Three", author="Madhu Vrat")
    await world.recording(MEMBER_B, title="Other person", author="Somebody Else")
    mine = await world.recording(MEMBER_A, title="My own", author="Madhu Vrata")
    gone = await world.recording(MEMBER_B, title="Removed", author="Madhu Vrata", status="removed")
    r = await world.client.get(f"{CLAIMS}/suggestions", headers=AS["a"])
    assert r.status_code == 200
    body = r.json()
    same_ids = {c["recording"]["id"] for c in body["same"]}
    alike_ids = {c["recording"]["id"] for c in body["alike"]}
    assert same_ids == {str(same), str(spelled)}
    assert alike_ids == {str(alike)}
    assert str(mine) not in same_ids | alike_ids and str(gone) not in same_ids | alike_ids
    library = next(c for c in body["same"] if c["recording"]["id"] == str(spelled))
    assert library["recording"]["library"] is True and library["matched_text"] == "Madhuvrata"
    assert "author_id" not in str(body)  # the uploader's account is never in the answer
    summary = (await world.client.get(f"{CLAIMS}/summary", headers=AS["a"])).json()
    assert summary["suggested"] == 3 and summary["pending"] == 0


async def test_a_name_in_another_script_or_spelling_is_found(world: World) -> None:
    await world.create(slug="priya-devi", display_name="Priya Devi")
    a = await world.recording(MEMBER_B, title="A", author="प्रिया देवी")
    b = await world.recording(MEMBER_B, title="B", author="Priya Devii")
    c = await world.recording(MEMBER_B, title="C", author="Devi Priya")
    body = (await world.client.get(f"{CLAIMS}/suggestions", headers=AS["a"])).json()
    levels = {x["recording"]["id"]: x["level"] for x in body["same"] + body["alike"]}
    assert levels == {str(a): "same", str(b): "same", str(c): "alike"}


async def test_a_name_inside_a_group_credit_is_found(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_B, author="Madhu Vrata & friends")
    body = (await world.client.get(f"{CLAIMS}/suggestions", headers=AS["a"])).json()
    assert [c["recording"]["id"] for c in body["same"]] == [str(rid)]


async def test_the_search_page_looks_in_titles_and_credits(world: World) -> None:
    await world.create()
    by_title = await world.recording(MEMBER_B, title="Night kiirtan with Madhu Vrata", author="")
    by_credit = await world.recording(MEMBER_B, title="Morning", author="Madhu Vrata")
    await world.recording(MEMBER_B, title="Unrelated", author="Somebody")
    r = await world.client.get(f"{CLAIMS}/search", headers=AS["a"], params={"q": "madhu vrata"})
    items = {i["recording"]["id"]: i for i in r.json()["items"]}
    assert set(items) == {str(by_title), str(by_credit)}
    assert items[str(by_credit)]["level"] == "same"
    assert items[str(by_title)]["level"] == "title"
    assert items[str(by_title)]["route"] == "team"
    short = await world.client.get(f"{CLAIMS}/search", headers=AS["a"], params={"q": "m"})
    assert short.json()["items"] == []
    # a stranger who types LIKE wildcards finds nothing special
    wild = await world.client.get(f"{CLAIMS}/search", headers=AS["a"], params={"q": "%%"})
    assert wild.json()["items"] == []


async def test_claim_routes_need_a_page_and_a_sign_in(world: World) -> None:
    assert (await world.client.get(f"{CLAIMS}/suggestions", headers=AS["b"])).status_code == 404
    assert (await world.client.get(f"{CLAIMS}/summary")).status_code == 401


# --------------------------------------------------------------------------- the ladder


async def test_a_same_name_on_a_verified_page_is_approved_at_once(world: World) -> None:
    pid = await verified_page(world)
    rid = await world.recording(MEMBER_B, title="Added by Bhakti", author="Madhu Vrata")
    lib = await world.recording(None, title="From the library", author="madhuvrata")
    result = await claim(world, [rid, lib])
    assert [r["outcome"] for r in result["results"]] == ["approved", "approved"]
    assert result["approved"] == 2 and result["pending"] == 0
    listed = (await world.get("madhu-vrata", "/recordings")).json()
    assert {i["id"] for i in listed["items"]} == {str(rid), str(lib)}
    assert (await world.get("madhu-vrata")).json()["recordings_count"] == 2
    # the uploader is told (a notice, nothing to answer), the library has nobody to tell
    told = await notices(world, MEMBER_B)
    assert [n.kind for n in told] == ["claim_on_your_recording"]
    assert "still yours" in told[0].body and not told[0].payload.get("actions")
    # the recording is not changed and still belongs to its uploader
    async with world.sessions() as session:
        claims = (await session.scalars(select(AuthorClaim))).all()
        assert {c.route for c in claims} == {"self"} and {c.decided_by for c in claims} == {
            "system"
        }
        log = (await session.scalars(select(AuthorClaimEvent))).all()
        assert sorted(e.action for e in log) == ["approved", "approved", "claimed", "claimed"]
    line = (await world.client.get(f"{URL}/by-recording/{rid}")).json()
    assert line["profile"]["slug"] == "madhu-vrata"
    assert pid


async def test_the_plays_of_a_claimed_recording_count(world: World) -> None:
    await verified_page(world)
    rid = await world.recording(MEMBER_B, author="Madhu Vrata")
    await world.listen(rid, 12)
    await claim(world, [rid])
    stats = (await world.client.get(f"{URL}/me/stats", headers=AS["a"])).json()
    assert stats["total_plays"] == 12  # all plays of the recording, not only the later ones


@pytest.mark.parametrize(
    ("credit", "title", "reason"),
    [
        ("Madhu Vrat", "x", "not_same_name"),
        ("Madhu Vrata & friends", "x", "group_credit"),
        ("Somebody Else", "Night kiirtan with Madhu Vrata", "not_same_name"),
    ],
)
async def test_everything_that_is_not_clear_goes_to_the_team(
    world: World, credit: str, title: str, reason: str
) -> None:
    await verified_page(world)
    rid = await world.recording(MEMBER_B, title=title, author=credit)
    result = await claim(world, [rid])
    assert result["results"][0]["outcome"] == "pending"
    assert result["results"][0]["team_reason"] == reason
    assert (await world.get("madhu-vrata", "/recordings")).json()["total"] == 0
    assert await notices(world, MEMBER_B) == []  # nothing is shown yet, so nothing to tell


async def test_a_page_the_team_has_not_verified_goes_to_the_team(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_B, author="Madhu Vrata")
    result = await claim(world, [rid])
    assert result["results"][0]["team_reason"] == "unverified_page"
    assert (await world.client.get(f"{CLAIMS}/suggestions", headers=AS["a"])).json()["same"][0][
        "route"
    ] == "team"


async def test_a_group_page_and_a_draft_page_go_to_the_team(world: World) -> None:
    await verified_page(world, author_type="group")
    rid = await world.recording(MEMBER_B, author="Madhu Vrata")
    assert (await claim(world, [rid]))["results"][0]["team_reason"] == "group_page"
    await verified_page(world, "b", slug="bhakti-songs", display_name="Bhakti Songs", publish=False)
    other = await world.recording(MEMBER_C, author="Bhakti Songs")
    assert (await claim(world, [other], "b"))["results"][0]["team_reason"] == "draft_page"


async def test_a_protected_a_famous_and_a_taken_name_go_to_the_team(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    await verified_page(world)
    monkeypatch.setattr(claims_service, "FAMOUS_RECORDING_COUNT", 3)
    for i in range(3):
        await world.recording(None, title=f"Library {i}", author="Madhu Vrata")
    rid = await world.recording(MEMBER_B, author="Madhu Vrata")
    assert (await claim(world, [rid]))["results"][0]["team_reason"] == "famous_name"
    # the name of a verified page of somebody else is a famous name too
    await verified_page(world, "b", slug="ravi-kiirtan", display_name="Ravi Kiirtan")
    ravi = await world.recording(MEMBER_C, author="Ravi Kiirtan")
    assert (await claim(world, [ravi]))["results"][0]["team_reason"] == "famous_name"
    # another page already holds a claim on this credit
    await world.create("c", slug="chitra-songs", display_name="Chitra Songs")
    first = await world.recording(MEMBER_B, author="Chitra Songs")
    second = await world.recording(MEMBER_B, author="Chitra Songs", title="Second")
    await claim(world, [first], "c")
    # a second page (member a) claims the same credit by an alias... it cannot add that alias, so
    # use a direct claim of the same text through the search page of a page named alike
    r = await world.client.post(
        CLAIMS, headers=AS["a"], json={"recording_ids": [str(first), str(second)]}
    )
    outcomes = {x["recording_id"]: x["team_reason"] for x in r.json()["results"]}
    assert outcomes[str(first)] == "taken_by_other"


async def test_a_protected_name_credit_always_goes_to_the_team(world: World) -> None:
    await verified_page(world, slug="baba-bhajans", display_name="Bhajans By Shrii Anandamurti")
    rid = await world.recording(MEMBER_B, author="Bhajans By Shrii Anandamurti")
    assert (await claim(world, [rid]))["results"][0]["team_reason"] == "protected_name"


# --------------------------------------------------------------------------- aliases


async def test_an_alias_finds_recordings_but_never_approves_them(world: World) -> None:
    await verified_page(world)
    r = await world.client.post(f"{URL}/me/aliases", headers=AS["a"], json={"alias": "Madhu"})
    assert r.status_code == 201, r.text
    rid = await world.recording(MEMBER_B, author="Madhu Kiirtan Group Soloist")
    r = await world.client.post(
        f"{URL}/me/aliases", headers=AS["a"], json={"alias": "Soloist Kiirtan Madhu"}
    )
    assert r.status_code == 201
    only = await world.recording(MEMBER_B, author="Soloist Kiirtan Madhu")
    body = (await world.client.get(f"{CLAIMS}/suggestions", headers=AS["a"])).json()
    found = {c["recording"]["id"]: c for c in body["same"] + body["alike"]}
    assert str(only) in found
    result = await claim(world, [only])
    assert result["results"][0]["outcome"] == "pending"
    assert result["results"][0]["team_reason"] == "alias_match"
    assert rid


async def test_an_alias_cannot_be_the_name_of_another_page_or_a_protected_name(
    world: World,
) -> None:
    await world.create()
    await verified_page(world, "b", slug="ravi-kiirtan", display_name="Ravi Kiirtan")
    for alias in ("Ravi Kiirtan", "Ravi Kirtan", "Sri Sri Anandamurti", "Official Team"):
        r = await world.client.post(f"{URL}/me/aliases", headers=AS["a"], json={"alias": alias})
        assert r.status_code == 422, alias
    rid = await world.recording(MEMBER_C, author="Ravi Kiirtan")
    # the other page's name never reached the ladder of this page
    result = await claim(world, [rid])
    assert result["results"][0]["outcome"] == "pending"
    assert result["results"][0]["team_reason"] == "famous_name"  # never the quick way
    assert await world.rows(AuthorAlias) == []


async def test_aliases_are_capped(world: World) -> None:
    await world.create()
    for i in range(claims_service.MAX_ALIASES):
        r = await world.client.post(
            f"{URL}/me/aliases", headers=AS["a"], json={"alias": f"Zorbaxel Name{'x' * i}"}
        )
        assert r.status_code == 201, r.text
    r = await world.client.post(f"{URL}/me/aliases", headers=AS["a"], json={"alias": "One More"})
    assert r.status_code == 422 and code(r) == "alias_limit"
    listed = (await world.client.get(f"{URL}/me/aliases", headers=AS["a"])).json()["items"]
    assert len(listed) == claims_service.MAX_ALIASES
    key = listed[0]["key"]
    assert (
        await world.client.delete(f"{URL}/me/aliases/{key}", headers=AS["a"])
    ).status_code == 204


async def test_a_verified_page_with_its_exact_known_as_name_still_auto_approves(
    world: World,
) -> None:
    await verified_page(
        world, slug="radha-songs", display_name="Radha Songs", claimed_name="Radha Devi"
    )
    rid = await world.recording(MEMBER_B, author="Radha Devii")
    result = await claim(world, [rid])
    assert result["results"][0]["outcome"] == "approved"


# --------------------------------------------------------------------------- other outcomes


async def test_claim_outcomes_for_repeated_and_unclaimable_recordings(world: World) -> None:
    await verified_page(world)
    mine = await world.recording(MEMBER_A, author="Somebody")
    rid = await world.recording(MEMBER_B, author="Madhu Vrata")
    removed = await world.recording(MEMBER_B, author="Madhu Vrata", status="removed")
    result = await claim(world, [mine, rid, rid, removed])
    assert [r["outcome"] for r in result["results"]] == ["already_yours", "approved", "not_found"]
    again = await claim(world, [rid])
    assert again["results"][0]["outcome"] == "already_approved"
    # a recording that is already on the page by the old rule is not claimed again
    await world.create("c", slug="chitra-songs", display_name="Chitra Songs")
    own = await world.recording(MEMBER_C, author="Chitra Songs")
    assert (await claim(world, [own], "c"))["results"][0]["outcome"] == "already_yours"


async def test_one_recording_may_be_on_several_pages(world: World) -> None:
    await verified_page(world)
    await verified_page(world, "c", slug="madhu-and-co", display_name="Madhu Vrata")
    rid = await world.recording(MEMBER_B, author="Madhu Vrata")
    first = await claim(world, [rid], "a")
    second = await claim(world, [rid], "c")
    assert first["results"][0]["outcome"] in ("approved", "pending")
    assert second["results"][0]["outcome"] in ("approved", "pending")
    mine = (await world.client.get(CLAIMS, headers=AS["c"])).json()
    assert mine["total"] == 1


async def test_taking_a_claim_back_removes_the_recording_from_the_page(world: World) -> None:
    await verified_page(world)
    rid = await world.recording(MEMBER_B, author="Madhu Vrata")
    made = (await claim(world, [rid]))["results"][0]
    assert (await world.get("madhu-vrata", "/recordings")).json()["total"] == 1
    r = await world.client.delete(f"{CLAIMS}/{made['claim_id']}", headers=AS["a"])
    assert r.status_code == 204
    assert (await world.get("madhu-vrata", "/recordings")).json()["total"] == 0
    assert (
        await world.client.delete(f"{CLAIMS}/{made['claim_id']}", headers=AS["a"])
    ).status_code == 409
    assert (
        await world.client.delete(f"{CLAIMS}/{made['claim_id']}", headers=AS["b"])
    ).status_code == 404
    # it can be claimed again
    assert (await claim(world, [rid]))["results"][0]["outcome"] == "approved"
    mine = (await world.client.get(CLAIMS, headers=AS["a"], params={"status": "approved"})).json()
    assert mine["total"] == 1 and mine["items"][0]["status"] == "approved"


# --------------------------------------------------------------------------- the team desk


async def test_the_team_desk_approves_rejects_and_revokes(world: World) -> None:
    await world.create()
    first = await world.recording(MEMBER_B, title="First", author="Madhu Vrata")
    second = await world.recording(MEMBER_B, title="Second", author="Madhu Vrata")
    third = await world.recording(MEMBER_C, title="Third", author="Madhu Vrata")
    await claim(world, [first, second, third])
    assert (await world.client.get(DESK, headers=AS["a"])).status_code == 403
    waiting = (await world.client.get(DESK, headers=AS_TEAM)).json()
    assert waiting["total"] == 3
    assert {i["team_reason"] for i in waiting["items"]} == {"unverified_page"}
    assert all(i["profile_verified"] is False for i in waiting["items"])
    by_title = {i["recording"]["title"]: i["id"] for i in waiting["items"]}

    approved = await world.client.post(
        f"{DESK}/{by_title['First']}/approve", headers=AS_TEAM, json={"note": "Known to us"}
    )
    assert approved.json() == {"changed": 1}
    assert (await world.get("madhu-vrata", "/recordings")).json()["total"] == 1
    assert [n.kind for n in await notices(world, MEMBER_B)] == ["claim_on_your_recording"]
    own = {n.kind: n for n in await notices(world, MEMBER_A)}
    assert "claim_approved" in own and "Known to us" in own["claim_approved"].body

    rejected = await world.client.post(
        f"{DESK}/{by_title['Second']}/reject", headers=AS_TEAM, json={"note": "Not her voice"}
    )
    assert rejected.json() == {"changed": 1}
    assert (
        await world.client.post(f"{DESK}/{by_title['Second']}/reject", headers=AS_TEAM, json={})
    ).status_code == 409
    mine = (await world.client.get(CLAIMS, headers=AS["a"], params={"status": "rejected"})).json()
    assert mine["items"][0]["decision_note"] == "Not her voice"
    again = await claim(world, [second])
    assert again["results"][0]["outcome"] == "rejected_before"

    revoked = await world.client.post(
        f"{DESK}/{by_title['First']}/revoke", headers=AS_TEAM, json={}
    )
    assert revoked.json() == {"changed": 1}
    assert (await world.get("madhu-vrata", "/recordings")).json()["total"] == 0
    assert (await claim(world, [first]))["results"][0]["outcome"] == "revoked_before"

    async with world.sessions() as session:
        actions = [
            e.action
            for e in (
                await session.scalars(select(AuthorClaimEvent).order_by(AuthorClaimEvent.id))
            ).all()
        ]
    assert {"claimed", "approved", "rejected", "revoked"} <= set(actions)


async def test_the_team_desk_works_in_bulk_by_page(world: World) -> None:
    pid = (await world.create()).json()["id"]
    ids = [await world.recording(MEMBER_B, title=f"T{i}", author="Madhu Vrata") for i in range(3)]
    await claim(world, ids)
    done = await world.client.post(
        f"{DESK}/bulk", headers=AS_TEAM, json={"profile_id": pid, "action": "approve"}
    )
    assert done.json() == {"changed": 3}
    assert (await world.get("madhu-vrata", "/recordings")).json()["total"] == 3
    gone = await world.client.post(
        f"{DESK}/bulk",
        headers=AS_TEAM,
        json={
            "profile_id": pid,
            "action": "revoke",
            "ids": [str(i) for i in await _claim_ids(world)][:1],
        },
    )
    assert gone.json() == {"changed": 1}
    assert (await world.get("madhu-vrata", "/recordings")).json()["total"] == 2
    # one notice for the whole decision, not one per recording
    kinds = [n.kind for n in await notices(world, MEMBER_A)]
    assert kinds.count("claim_approved") == 1 and kinds.count("claim_revoked") == 1


async def _claim_ids(world: World) -> list[UUID]:
    async with world.sessions() as session:
        return [c.id for c in (await session.scalars(select(AuthorClaim))).all()]


# --------------------------------------------------------------------------- limits


async def test_claims_per_day_are_capped(world: World, monkeypatch: pytest.MonkeyPatch) -> None:
    await world.create()
    monkeypatch.setattr(claims_service, "CLAIMS_PER_DAY", 2)
    ids = [await world.recording(MEMBER_B, title=f"T{i}", author="Madhu Vrata") for i in range(3)]
    r = await world.client.post(
        CLAIMS, headers=AS["a"], json={"recording_ids": [str(i) for i in ids]}
    )
    assert r.status_code == 429 and code(r) == "claims_per_day"
    assert await world.rows(AuthorClaim) == []  # nothing half done


async def test_too_many_waiting_claims_stop_the_page(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    await world.create()
    monkeypatch.setattr(claims_service, "OPEN_CLAIMS_MAX", 1)
    ids = [await world.recording(MEMBER_B, title=f"T{i}", author="Madhu Vrata") for i in range(2)]
    r = await world.client.post(
        CLAIMS, headers=AS["a"], json={"recording_ids": [str(i) for i in ids]}
    )
    assert r.status_code == 429 and code(r) == "claims_waiting"


async def test_three_refusals_in_a_row_pause_claiming(world: World) -> None:
    pid = (await world.create()).json()["id"]
    ids = [await world.recording(MEMBER_B, title=f"T{i}", author="Madhu Vrata") for i in range(4)]
    await claim(world, ids[:3])
    await world.client.post(
        f"{DESK}/bulk", headers=AS_TEAM, json={"profile_id": pid, "action": "reject"}
    )
    summary = (await world.client.get(f"{CLAIMS}/summary", headers=AS["a"])).json()
    assert summary["paused_until"] is not None
    r = await world.client.post(CLAIMS, headers=AS["a"], json={"recording_ids": [str(ids[3])]})
    assert r.status_code == 429 and code(r) == "claims_paused"


async def test_a_suspended_page_cannot_claim(world: World) -> None:
    pid = (await world.create()).json()["id"]
    rid = await world.recording(MEMBER_B, author="Madhu Vrata")
    await world.client.post(f"{ADMIN}/{pid}/suspend", headers=AS_TEAM, json={"reason": "test"})
    r = await world.client.post(CLAIMS, headers=AS["a"], json={"recording_ids": [str(rid)]})
    assert r.status_code == 403
    assert TEAM
