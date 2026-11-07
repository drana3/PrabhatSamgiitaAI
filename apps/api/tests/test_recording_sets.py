"""Playlists from an event: make, fill, order, edit, limits, permissions, moderation.

Fixtures come from test_recordings.py. See docs/kiirtan-sets.md for the rules these pin.
"""

# ruff: noqa: F811
from __future__ import annotations

import os
from datetime import date, timedelta
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
from sqlalchemy import select
from test_recording_categories import _make_admin
from test_recordings import World, mp3, world  # noqa: F401

from app.models.recording_collections import RecordingCollection
from app.models.recordings import MemberNotice, Recording

AS_A = {"X-Test-Member": "a"}
AS_B = {"X-Test-Member": "b"}
SETS = "/api/v1/recording-sets"


def set_body(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "title": "Retreat in Kraków",
        "starts_on": str(date.today() - timedelta(days=3)),
        "ends_on": str(date.today() - timedelta(days=1)),
        "place": "Kraków, Poland",
        "default_kind": "kiirtan",
    }
    body.update(overrides)
    return body


async def make_set(world: World, who: str = "a", **overrides: object) -> dict:
    response = await world.client.post(
        SETS, headers={"X-Test-Member": who}, json=set_body(**overrides)
    )
    assert response.status_code in (200, 201), response.text
    return response.json()


async def add_track(
    world: World, set_id: str, seed: int, who: str = "a", **overrides: object
) -> httpx.Response:
    """Upload one file into the set the way the phone does (target with collection_id, publish)."""
    data = mp3(seed)
    target = await world.client.post(
        "/api/v1/recordings/uploads",
        headers={"X-Test-Member": who},
        json={
            "file_name": "x.mp3",
            "content_type": "audio/mpeg",
            "size_bytes": len(data),
            "collection_id": set_id,
        },
    )
    if target.status_code != 201:
        return target
    info = target.json()
    path = info["url"].split("://", 1)[1].split("/", 1)[1]
    put = await world.client.put("/" + path, content=data, headers=info["headers"])
    assert put.status_code == 204, put.text
    body = world.body(info["key"], title=f"Track {seed}", collection_id=set_id, **overrides)
    if "kind" not in overrides:
        del body["kind"]  # the track says nothing: it takes the set's kind
    return await world.client.post("/api/v1/recordings", headers={"X-Test-Member": who}, json=body)


async def detail(world: World, set_id: str, who: str | None = "a") -> httpx.Response:
    headers = {"X-Test-Member": who} if who else {}
    return await world.client.get(f"{SETS}/{set_id}", headers=headers)


async def test_a_set_is_made_with_its_event_data_and_starts_as_a_draft(world: World) -> None:
    made = await world.client.post(SETS, headers=AS_A, json=set_body(description="Three days."))
    assert made.status_code == 201, made.text
    item = made.json()
    assert item["title"] == "Retreat in Kraków" and item["place"] == "Kraków, Poland"
    assert item["state"] == "draft" and item["tracks_count"] == 0
    assert item["owner_name"] == "Ananda" and item["default_kind"] == "kiirtan"
    got = await detail(world, item["id"])
    assert got.status_code == 200 and got.json()["tracks"] == []


async def test_the_same_client_id_returns_the_same_set(world: World) -> None:
    set_id = str(uuid4())
    first = await world.client.post(SETS, headers=AS_A, json=set_body(id=set_id))
    again = await world.client.post(SETS, headers=AS_A, json=set_body(id=set_id, title="Other"))
    assert first.status_code == 201 and again.status_code == 200
    assert again.json()["id"] == set_id and again.json()["title"] == "Retreat in Kraków"
    stolen = await world.client.post(SETS, headers=AS_B, json=set_body(id=set_id))
    assert stolen.status_code == 409


async def test_a_set_needs_a_member_a_title_and_sane_dates(world: World) -> None:
    assert (await world.client.post(SETS, json=set_body())).status_code == 401
    assert (
        await world.client.post(SETS, headers=AS_A, json=set_body(title="  "))
    ).status_code == 422
    future = str(date.today() + timedelta(days=30))
    assert (
        await world.client.post(SETS, headers=AS_A, json=set_body(starts_on=future))
    ).status_code == 422
    backwards = set_body(starts_on="2025-05-10", ends_on="2025-05-01")
    assert (await world.client.post(SETS, headers=AS_A, json=backwards)).status_code == 422
    no_date = set_body()
    del no_date["starts_on"]
    assert (await world.client.post(SETS, headers=AS_A, json=no_date)).status_code == 422


async def test_set_defaults_follow_the_category_rules(world: World) -> None:
    other = await world.client.post(
        SETS, headers=AS_A, json=set_body(default_kind="spiritual_song", default_language="other")
    )
    assert other.status_code == 422  # "other" needs its name
    ok = await make_set(
        world,
        default_kind="spiritual_song",
        default_language="other",
        default_language_other=" Old Church  Slavonic ",
    )
    assert (
        ok["default_language"] == "other" and ok["default_language_other"] == "Old Church Slavonic"
    )
    kiirtan = await make_set(world, default_kind="kiirtan", default_language="en")
    assert kiirtan["default_language"] is None  # Kiirtan has no language
    bad_dance = await world.client.post(
        SETS, headers=AS_A, json=set_body(default_kind="dance_song", default_dance="waltz")
    )
    assert bad_dance.status_code == 422


async def test_tracks_inherit_the_defaults_and_get_positions_in_order(world: World) -> None:
    made = await make_set(
        world, default_kind="dance_song", default_dance="kaoshiki", default_language="bn"
    )
    ids = []
    for seed in (700, 701, 702):
        r = await add_track(world, made["id"], seed)
        assert r.status_code == 201, r.text
        item = r.json()
        assert item["kind"] == "dance_song" and item["dance"] == "kaoshiki"
        assert item["language"] == "bn" and item["collection_id"] == made["id"]
        ids.append(item["id"])
    got = (await detail(world, made["id"])).json()
    assert [t["id"] for t in got["tracks"]] == ids
    assert [t["position"] for t in got["tracks"]] == [1, 2, 3]
    assert got["tracks_count"] == 3


async def test_a_track_can_override_the_set_defaults(world: World) -> None:
    made = await make_set(world, default_kind="dance_song", default_dance="kaoshiki")
    own = await add_track(world, made["id"], 710, kind="kiirtan")
    assert own.status_code == 201 and own.json()["kind"] == "kiirtan"
    tandava = await add_track(world, made["id"], 711, dance="tandava")
    assert tandava.json()["dance"] == "tandava"
    day = await add_track(world, made["id"], 712, recorded_on=str(date.today() - timedelta(days=2)))
    assert day.json()["recorded_on"] == str(date.today() - timedelta(days=2))


async def test_category_rules_still_hold_inside_a_set(world: World) -> None:
    made = await make_set(world, default_kind="kiirtan")
    no_language = await add_track(world, made["id"], 720, kind="spiritual_song")
    assert no_language.status_code == 422 and "language" in no_language.text.lower()
    no_dance = await add_track(world, made["id"], 721, kind="dance_song")
    assert no_dance.status_code == 422 and "dance" in no_dance.text.lower()
    fine = await add_track(world, made["id"], 722, kind="spiritual_song", language="ru")
    assert fine.status_code == 201


async def test_a_draft_is_private_and_a_published_set_is_public(world: World) -> None:
    made = await make_set(world)
    assert (await detail(world, made["id"], who=None)).status_code == 404
    assert (await detail(world, made["id"], who="b")).status_code == 404
    assert (await world.client.get(SETS)).json()["total"] == 0
    assert (await add_track(world, made["id"], 730)).status_code == 201
    public = await detail(world, made["id"], who=None)
    assert public.status_code == 200 and public.json()["tracks_count"] == 1
    assert public.json()["state"] in ("uploading", "published")
    listed = (await world.client.get(SETS)).json()
    assert [s["id"] for s in listed["items"]] == [made["id"]]
    mine = (await world.client.get(f"{SETS}/mine", headers=AS_A)).json()
    assert [s["id"] for s in mine["items"]] == [made["id"]]
    assert (await world.client.get(f"{SETS}/mine", headers=AS_B)).json()["total"] == 0
    assert (await world.client.get(f"{SETS}/mine")).status_code == 401


async def test_state_is_uploading_until_all_files_arrived_or_the_member_finishes(
    world: World,
) -> None:
    made = await make_set(world, tracks_expected=3)
    await add_track(world, made["id"], 740)
    assert (await detail(world, made["id"])).json()["state"] == "uploading"
    await add_track(world, made["id"], 741)
    await add_track(world, made["id"], 742)
    assert (await detail(world, made["id"])).json()["state"] == "published"
    # a set where one file failed: the member says the upload is over
    partial = await make_set(world, tracks_expected=3, title="Partial")
    await add_track(world, partial["id"], 743)
    assert (await detail(world, partial["id"])).json()["state"] == "uploading"
    done = await world.client.post(f"{SETS}/{partial['id']}/finish", headers=AS_A)
    assert done.status_code == 200 and done.json()["state"] == "published"
    assert done.json()["tracks_expected"] == 1
    assert (
        await world.client.post(f"{SETS}/{partial['id']}/finish", headers=AS_B)
    ).status_code == 403


async def test_a_duplicate_file_fails_alone_and_the_set_keeps_going(world: World) -> None:
    made = await make_set(world)
    first = await add_track(world, made["id"], 750)
    assert first.status_code == 201
    # the very same bytes cannot be uploaded again (SHA-256 block) ...
    data = mp3(751)
    ok = await world.client.post(
        "/api/v1/recordings/uploads",
        headers=AS_A,
        json={
            "file_name": "a.mp3",
            "content_type": "audio/mpeg",
            "size_bytes": len(data),
            "collection_id": made["id"],
        },
    )
    assert ok.status_code == 201
    # ... other tracks still go in afterwards: partial success
    after = await add_track(world, made["id"], 752)
    assert after.status_code == 201
    assert (await detail(world, made["id"])).json()["tracks_count"] == 2


async def test_only_the_owner_edits_the_set(world: World) -> None:
    made = await make_set(world)
    sid = made["id"]
    t = (await add_track(world, sid, 760)).json()
    assert (
        await world.client.patch(f"{SETS}/{sid}", headers=AS_B, json={"title": "Mine now"})
    ).status_code == 403
    assert (await world.client.patch(f"{SETS}/{sid}", json={"title": "x"})).status_code == 401
    assert (await world.client.delete(f"{SETS}/{sid}", headers=AS_B)).status_code == 403
    order = {"recording_ids": [t["id"]]}
    assert (
        await world.client.put(f"{SETS}/{sid}/order", headers=AS_B, json=order)
    ).status_code == 403
    assert (
        await world.client.delete(f"{SETS}/{sid}/tracks/{t['id']}", headers=AS_B)
    ).status_code == 403
    assert (await world.client.get(f"{SETS}/{uuid4()}", headers=AS_A)).status_code == 404
    # B cannot upload into A's set either
    refused = await add_track(world, sid, 761, who="b")
    assert refused.status_code == 403


async def test_rename_and_change_event_data(world: World) -> None:
    made = await make_set(world)
    sid = made["id"]
    patched = await world.client.patch(
        f"{SETS}/{sid}",
        headers=AS_A,
        json={
            "title": "  Winter retreat ",
            "place": None,
            "description": "Notes",
            "tracks_expected": 12,
        },
    )
    assert patched.status_code == 200, patched.text
    out = patched.json()
    assert out["title"] == "Winter retreat" and out["place"] is None
    assert out["description"] == "Notes" and out["tracks_expected"] == 12
    assert out["starts_on"] == made["starts_on"]  # untouched fields stay
    bad = await world.client.patch(f"{SETS}/{sid}", headers=AS_A, json={"ends_on": "2000-01-01"})
    assert bad.status_code == 422


async def test_reorder_needs_every_live_track_exactly_once(world: World) -> None:
    made = await make_set(world)
    sid = made["id"]
    ids = [(await add_track(world, sid, 770 + n)).json()["id"] for n in range(3)]
    flipped = list(reversed(ids))
    ok = await world.client.put(
        f"{SETS}/{sid}/order", headers=AS_A, json={"recording_ids": flipped}
    )
    assert ok.status_code == 200, ok.text
    assert [t["id"] for t in ok.json()["tracks"]] == flipped
    assert [t["id"] for t in (await detail(world, sid)).json()["tracks"]] == flipped
    for wrong in (ids[:2], ids + [ids[0]], [*ids[:2], str(uuid4())]):
        r = await world.client.put(
            f"{SETS}/{sid}/order", headers=AS_A, json={"recording_ids": wrong}
        )
        assert r.status_code == 422, wrong


async def test_edit_a_track_inside_the_set(world: World) -> None:
    made = await make_set(world)
    t = (await add_track(world, made["id"], 780)).json()
    r = await world.client.patch(
        f"{SETS}/{made['id']}/tracks/{t['id']}",
        headers=AS_A,
        json={"title": " Day two, evening ", "recorded_on": str(date.today() - timedelta(days=2))},
    )
    assert r.status_code == 200, r.text
    assert r.json()["title"] == "Day two, evening"
    assert r.json()["recorded_on"] == str(date.today() - timedelta(days=2))
    assert (
        await world.client.patch(
            f"{SETS}/{made['id']}/tracks/{uuid4()}", headers=AS_A, json={"title": "x"}
        )
    ).status_code == 404
    other = await make_set(world, title="Other")
    wrong_set = await world.client.patch(
        f"{SETS}/{other['id']}/tracks/{t['id']}", headers=AS_A, json={"title": "x"}
    )
    assert wrong_set.status_code == 404


async def test_remove_a_track_from_the_set_keeps_it_in_the_library_or_removes_it(
    world: World,
) -> None:
    made = await make_set(world)
    sid = made["id"]
    ids = [(await add_track(world, sid, 790 + n)).json()["id"] for n in range(3)]
    kept = await world.client.delete(f"{SETS}/{sid}/tracks/{ids[0]}", headers=AS_A)
    assert kept.status_code == 200
    assert [t["id"] for t in kept.json()["tracks"]] == ids[1:]
    assert [t["position"] for t in kept.json()["tracks"]] == [1, 2]
    alone = (await world.client.get(f"/api/v1/recordings/{ids[0]}")).json()
    assert alone["collection_id"] is None  # a normal recording on its own
    gone = await world.client.delete(f"{SETS}/{sid}/tracks/{ids[1]}?remove=true", headers=AS_A)
    assert gone.status_code == 200
    live = [t["id"] for t in gone.json()["tracks"] if t["status"] == "published"]
    assert live == [ids[2]]  # the owner still sees the removed one, marked as removed
    assert (await world.client.get(f"/api/v1/recordings/{ids[1]}")).status_code == 404


async def test_attach_an_existing_recording(world: World) -> None:
    made = await make_set(world)
    sid = made["id"]
    mine = (await world.publish("a", mp3(800), title="Solo")).json()
    theirs = (await world.publish("b", mp3(801), title="Not mine")).json()
    ok = await world.client.post(
        f"{SETS}/{sid}/tracks", headers=AS_A, json={"recording_id": mine["id"]}
    )
    assert ok.status_code == 201 and [t["id"] for t in ok.json()["tracks"]] == [mine["id"]]
    again = await world.client.post(
        f"{SETS}/{sid}/tracks", headers=AS_A, json={"recording_id": mine["id"]}
    )
    assert again.status_code == 201 and len(again.json()["tracks"]) == 1
    other = await make_set(world, title="Other")
    taken = await world.client.post(
        f"{SETS}/{other['id']}/tracks", headers=AS_A, json={"recording_id": mine["id"]}
    )
    assert taken.status_code == 409
    foreign = await world.client.post(
        f"{SETS}/{sid}/tracks", headers=AS_A, json={"recording_id": theirs["id"]}
    )
    assert foreign.status_code == 404


async def test_delete_a_set_keeps_or_removes_its_tracks(world: World) -> None:
    keep = await make_set(world, title="Keep")
    kid = (await add_track(world, keep["id"], 810)).json()["id"]
    assert (await world.client.delete(f"{SETS}/{keep['id']}", headers=AS_A)).status_code == 204
    assert (await detail(world, keep["id"])).status_code == 404
    still = await world.client.get(f"/api/v1/recordings/{kid}")
    assert still.status_code == 200 and still.json()["collection_id"] is None
    drop = await make_set(world, title="Drop")
    did = (await add_track(world, drop["id"], 811)).json()["id"]
    assert (
        await world.client.delete(f"{SETS}/{drop['id']}?tracks=remove", headers=AS_A)
    ).status_code == 204
    assert (await world.client.get(f"/api/v1/recordings/{did}")).status_code == 404
    assert (await world.client.delete(f"{SETS}/{drop['id']}", headers=AS_A)).status_code == 404


async def test_a_set_holds_a_limited_number_of_tracks(world: World) -> None:
    world.settings.recording_set_max_tracks = 2
    made = await make_set(world)
    assert (await add_track(world, made["id"], 820)).status_code == 201
    assert (await add_track(world, made["id"], 821)).status_code == 201
    full = await add_track(world, made["id"], 822)
    assert full.status_code == 409
    assert full.json()["detail"]["code"] == "set_full"
    # a second set still takes more
    second = await make_set(world, title="Part two")
    assert (await add_track(world, second["id"], 823)).status_code == 201


async def test_set_tracks_have_their_own_daily_allowance(world: World) -> None:
    world.settings.recording_set_tracks_per_day = 2
    world.settings.recording_uploads_per_day = 1
    made = await make_set(world)
    for seed in (830, 831):
        assert (await add_track(world, made["id"], seed)).status_code == 201
    limited = await add_track(world, made["id"], 832)
    assert limited.status_code == 429 and limited.headers["X-Error-Code"] == "set_daily_limit"
    # single uploads count apart from set tracks: one is still allowed ...
    assert (await world.publish("a", mp3(833), title="Single")).status_code == 201
    # ... and then the single allowance is used up
    blocked = await world.client.post(
        "/api/v1/recordings/uploads",
        headers=AS_A,
        json={"file_name": "x.mp3", "content_type": "audio/mpeg", "size_bytes": 100},
    )
    assert blocked.status_code == 429 and blocked.headers["X-Error-Code"] == "upload_daily_limit"
    # another member is unaffected
    other = await make_set(world, who="b", title="B set")
    assert (await add_track(world, other["id"], 834, who="b")).status_code == 201


async def test_sets_per_day_and_empty_drafts_are_limited(world: World) -> None:
    world.settings.recording_sets_per_day = 2
    await make_set(world, title="One")
    await make_set(world, title="Two")
    refused = await world.client.post(SETS, headers=AS_A, json=set_body(title="Three"))
    assert refused.status_code == 429 and refused.headers["X-Error-Code"] == "set_start_limit"
    world.settings.recording_sets_per_day = 50
    world.settings.recording_set_empty_drafts = 2
    blocked = await world.client.post(SETS, headers=AS_A, json=set_body(title="Three"))
    assert blocked.status_code == 409  # two empty drafts already
    # B has nothing empty and is not blocked
    assert (
        await world.client.post(SETS, headers=AS_B, json=set_body(title="B"))
    ).status_code == 201


async def test_the_team_is_exempt_from_set_limits(world: World) -> None:
    world.settings.recording_sets_per_day = 1
    world.settings.recording_set_empty_drafts = 1
    world.settings.recording_set_max_tracks = 1
    world.settings.recording_set_max_tracks_team = 3
    world.settings.recording_set_tracks_per_day = 1
    await _make_admin(world, is_admin=True)
    sets_ = [await make_set(world, title=f"Team {n}") for n in range(3)]
    sid = sets_[0]["id"]
    for seed in (840, 841, 842):
        assert (await add_track(world, sid, seed)).status_code == 201
    full = await add_track(world, sid, 843)
    assert full.status_code == 409  # even the team has a (higher) cap


async def test_the_team_removes_and_restores_a_whole_set(world: World) -> None:
    made = await make_set(world)
    sid = made["id"]
    ids = [(await add_track(world, sid, 850 + n)).json()["id"] for n in range(3)]
    # one track was already taken down on its own
    one = await world.client.post(
        f"/api/v1/admin/recordings/{ids[0]}/remove", json={"reason": "Not the author's"}
    )
    assert one.status_code == 200, one.text
    r = await world.client.post(
        f"/api/v1/admin/recording-sets/{sid}/remove", json={"reason": "Not your recordings"}
    )
    assert r.status_code == 200 and r.json()["state"] == "removed"
    assert (await detail(world, sid, who=None)).status_code == 404
    assert (await world.client.get(SETS)).json()["total"] == 0
    for rid in ids:
        assert (await world.client.get(f"/api/v1/recordings/{rid}")).status_code == 404
    # the owner sees it, once, with the reason, and cannot edit it
    mine = (await world.client.get(f"{SETS}/mine", headers=AS_A)).json()["items"][0]
    assert mine["state"] == "removed" and mine["removed_reason"] == "Not your recordings"
    assert (
        await world.client.patch(f"{SETS}/{sid}", headers=AS_A, json={"title": "x"})
    ).status_code == 409
    async with world.sessions() as session:
        notices = (
            await session.scalars(
                select(MemberNotice).where(MemberNotice.kind == "recording_set_removed")
            )
        ).all()
    assert len(notices) == 1
    assert (
        await world.client.post(
            f"/api/v1/admin/recording-sets/{sid}/remove", json={"reason": "again"}
        )
    ).status_code == 409
    back = await world.client.post(f"/api/v1/admin/recording-sets/{sid}/restore", json={})
    assert back.status_code == 200 and back.json()["state"] != "removed"
    # the two that went down with the set are back; the one removed alone stays removed
    assert (await world.client.get(f"/api/v1/recordings/{ids[1]}")).status_code == 200
    assert (await world.client.get(f"/api/v1/recordings/{ids[2]}")).status_code == 200
    assert (await world.client.get(f"/api/v1/recordings/{ids[0]}")).status_code == 404
    assert (
        await world.client.post(f"/api/v1/admin/recording-sets/{sid}/restore", json={})
    ).status_code == 409


async def test_the_admin_list_filters_by_state(world: World) -> None:
    live = await make_set(world, title="Live")
    gone = await make_set(world, title="Gone")
    await add_track(world, gone["id"], 860)
    await world.client.post(
        f"/api/v1/admin/recording-sets/{gone['id']}/remove", json={"reason": "Spam run"}
    )
    removed = (await world.client.get("/api/v1/admin/recording-sets?filter=removed")).json()
    assert [s["id"] for s in removed["items"]] == [gone["id"]]
    active = (await world.client.get("/api/v1/admin/recording-sets?filter=active")).json()
    assert [s["id"] for s in active["items"]] == [live["id"]]


async def test_a_set_listing_hides_blocked_owners_and_searches_by_title(world: World) -> None:
    a = await make_set(world, title="Amsterdam DMC")
    b = await make_set(world, who="b", title="Berlin camp")
    await add_track(world, a["id"], 870)
    await add_track(world, b["id"], 871, who="b")
    both = (await world.client.get(SETS)).json()
    assert {s["id"] for s in both["items"]} == {a["id"], b["id"]}
    found = (await world.client.get(SETS, params={"q": "berlin"})).json()
    assert [s["id"] for s in found["items"]] == [b["id"]]
    one_owner = (await world.client.get(SETS, params={"owner_id": a["owner_id"]})).json()
    assert [s["id"] for s in one_owner["items"]] == [a["id"]]


async def test_the_set_is_in_the_database_with_positions(world: World) -> None:
    made = await make_set(world)
    await add_track(world, made["id"], 880)
    await add_track(world, made["id"], 881)
    async with world.sessions() as session:
        rows = (await session.scalars(select(Recording).order_by(Recording.position))).all()
        assert [r.position for r in rows] == [1, 2]
        assert {str(r.collection_id) for r in rows} == {made["id"]}
        assert await session.scalar(select(RecordingCollection)) is not None


# ---------------------------------------------------------------- QA-036, QA-037, Bhajan language


async def test_a_track_without_a_kind_but_with_a_language_inherits_a_spiritual_playlist(
    world: World,
) -> None:
    """QA-037: the schema's kiirtan default used to drop the track's own language."""
    made = await make_set(world, default_kind="spiritual_song")
    own = await add_track(world, made["id"], 730, language="hi")
    assert own.status_code == 201, own.text
    assert own.json()["kind"] == "spiritual_song" and own.json()["language"] == "hi"
    bhajans = await make_set(world, default_kind="bhajan")
    bhajan = await add_track(world, bhajans["id"], 731, language="bn")
    assert bhajan.status_code == 201 and bhajan.json()["language"] == "bn"
    # still a Kiirtan playlist: a language the track sends is dropped, as for a plain upload
    kiirtan = await make_set(world, default_kind="kiirtan")
    plain = await add_track(world, kiirtan["id"], 732, language="hi")
    assert plain.status_code == 201 and plain.json()["language"] is None


async def test_a_bhajan_track_needs_a_language_from_itself_or_the_playlist(world: World) -> None:
    made = await make_set(world, default_kind="bhajan")
    missing = await add_track(world, made["id"], 740)
    assert missing.status_code == 422 and "language" in missing.text.lower()
    with_default = await make_set(world, default_kind="bhajan", default_language="sa")
    ok = await add_track(world, with_default["id"], 741)
    assert ok.status_code == 201 and ok.json()["language"] == "sa"


async def test_a_playlist_title_and_place_lose_invisible_characters(world: World) -> None:
    """QA-036: zero-width and bidi-override characters are dropped, like in comments."""
    dirty_title = "Re​treat ‮in Kra⁦ków⁩﻿"
    dirty_place = "‮Kraków‍,​ Poland"
    made = await make_set(world, title=dirty_title, place=dirty_place, description="A​B")
    assert made["title"] == "Retreat in Kraków"
    assert made["place"] == "Kraków, Poland"
    assert made["description"] == "AB"
    renamed = await world.client.patch(
        f"{SETS}/{made['id']}", headers=AS_A, json={"title": "N​e‮w", "place": "​​"}
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["title"] == "New" and renamed.json()["place"] is None
    only_invisible = await world.client.post(SETS, headers=AS_A, json=set_body(title="​‮ ​"))
    assert only_invisible.status_code == 422  # nothing visible is left: "Add a title."


async def test_an_event_date_before_1900_is_refused(world: World) -> None:
    for field in ("starts_on", "ends_on"):
        body = set_body(starts_on="1850-01-01", ends_on=None)
        if field == "ends_on":
            body = set_body(ends_on="1850-01-01")
        refused = await world.client.post(SETS, headers=AS_A, json=body)
        assert refused.status_code == 422, (field, refused.text)
    first_ok = await world.client.post(
        SETS, headers=AS_A, json=set_body(starts_on="1900-01-01", ends_on=None)
    )
    assert first_ok.status_code in (200, 201), first_ok.text
    made = await make_set(world)
    patched = await world.client.patch(
        f"{SETS}/{made['id']}", headers=AS_A, json={"starts_on": "1899-12-31"}
    )
    assert patched.status_code == 422
    track = await add_track(world, made["id"], 750, recorded_on="1800-05-05")
    assert track.status_code == 422
