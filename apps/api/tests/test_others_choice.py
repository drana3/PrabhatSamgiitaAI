"""Others (kind `other_mantra`, once "Other mantras"): what it is is a REQUIRED single choice.

Pins docs/others-category.md: no default, the six listed choices, "Something else" with a name that
waits for the team like every own word, and old rows that stay readable.
"""

# ruff: noqa: F811
from __future__ import annotations

import os
from uuid import UUID

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
from fastapi import HTTPException, Request
from sqlalchemy import select
from test_recordings import MEMBER_A, World, mp3, world  # noqa: F401

from app.api.v1.extras_common import get_team_member
from app.models import UserAccount
from app.models.recordings import MANTRA_TYPES, MemberNotice, Recording, ValueSuggestion
from app.services.value_suggestions import MANTRA, listed_code

AS_A = {"X-Test-Member": "a"}
AS_B = {"X-Test-Member": "b"}
QUEUE = "/api/v1/recordings/value-suggestions"
LISTED = ("guru_puja", "pitriyajina", "samgacchadhvam", "nityam_shuddham", "ananda_sutram", "shlokas")


def make(world: World, seed: int, who: str = "a", **fields: object):  # type: ignore[no-untyped-def]
    return world.publish(who, mp3(seed), kind="other_mantra", style=None, **fields)


def test_the_choices_are_the_six_names_and_something_else() -> None:
    assert MANTRA_TYPES == (*LISTED, "other")


def test_a_typed_name_that_is_a_listed_one_is_that_choice() -> None:
    assert listed_code(MANTRA, "Guru Pújá") == "guru_puja"
    assert listed_code(MANTRA, "Pitri Yajna") == "pitriyajina"
    assert listed_code(MANTRA, "pitr  yajina") == "pitriyajina"
    assert listed_code(MANTRA, "Saḿgacchadhvaḿ") == "samgacchadhvam"
    assert listed_code(MANTRA, "Nityam Shudham") == "nityam_shuddham"
    assert listed_code(MANTRA, "Ánanda Sútram") == "ananda_sutram"
    assert listed_code(MANTRA, "Slokas") == "shlokas"
    assert listed_code(MANTRA, "Hanuman Chalisa") is None


async def test_nothing_is_pre_selected_the_person_must_choose(world: World) -> None:
    # no type at all, an unknown one, and "other" without a name are all refused
    for seed, fields in (
        (6000, {}),
        (6001, {"type": "bnk"}),
        (6002, {"type": "banana"}),
        (6003, {"type": "other"}),
        (6004, {"type": "other", "type_other": "  "}),
    ):
        refused = await make(world, seed, **fields)
        assert refused.status_code == 422, (fields, refused.text)
        assert "Choose what this is" in refused.text or "type" in refused.text
    assert await world.scalar(select(Recording.id)) is None


@pytest.mark.parametrize("choice", LISTED)
async def test_each_listed_choice_is_stored_and_read_back(world: World, choice: str) -> None:
    seed = 6100 + LISTED.index(choice)
    made = await make(world, seed, type=choice, type_other="ignored")
    assert made.status_code == 201, made.text
    body = made.json()
    assert (body["kind"], body["type"], body["type_other"]) == ("other_mantra", choice, None)
    listed = (await world.client.get("/api/v1/recordings", params={"kind": "other_mantra"})).json()
    assert [i["type"] for i in listed["items"]] == [choice]
    assert await world.scalar(select(ValueSuggestion.id)) is None


async def test_something_else_with_a_listed_name_becomes_that_choice(world: World) -> None:
    made = await make(world, 6200, type="other", type_other=" Guru Puja ")
    assert made.status_code == 201, made.text
    assert (made.json()["type"], made.json()["type_other"]) == ("guru_puja", None)
    assert await world.scalar(select(ValueSuggestion.id)) is None


async def test_something_else_needs_a_name_of_2_to_40_characters(world: World) -> None:
    for seed, word in ((6210, "x"), (6211, "y" * 41)):
        refused = await make(world, seed, type="other", type_other=word)
        assert refused.status_code == 422, (word, refused.text)


async def test_a_new_name_is_seen_by_its_author_only_until_the_team_accepts_it(
    world: World,
) -> None:
    made = await make(world, 6300, type="other", type_other="Hanuman Chalisa")
    assert made.status_code == 201, made.text
    rid = made.json()["id"]
    assert (made.json()["type"], made.json()["type_other"]) == ("other", "Hanuman Chalisa")
    own = (await world.client.get(f"/api/v1/recordings/{rid}", headers=AS_A)).json()
    assert own["type_other"] == "Hanuman Chalisa"
    stranger = (await world.client.get(f"/api/v1/recordings/{rid}", headers=AS_B)).json()
    assert (stranger["type"], stranger["type_other"], stranger["type_other_checked"]) == (
        "other",
        None,
        False,
    )
    listed = (await world.client.get("/api/v1/recordings")).json()["items"]
    assert listed[0]["type_other"] is None
    row = await world.scalar(select(ValueSuggestion))
    assert (row.field, row.label, row.status) == ("mantra", "Hanuman Chalisa", "pending")


@pytest.fixture
def as_team(world: World):  # type: ignore[no-untyped-def]
    app = world.client._transport.app  # type: ignore[attr-defined]

    async def team(request: Request) -> UserAccount:
        if request.headers.get("X-Test-Team") != "1":
            raise HTTPException(status_code=403, detail="Only the team can do this.")
        async with world.sessions() as session:
            return await session.get(UserAccount, MEMBER_A)  # type: ignore[return-value]

    app.dependency_overrides[get_team_member] = team
    return {"X-Test-Team": "1"}


async def _queue_one(world: World, seed: int, word: str) -> tuple[str, str]:
    made = await make(world, seed, type="other", type_other=word)
    assert made.status_code == 201, made.text
    row = await world.scalar(select(ValueSuggestion).where(ValueSuggestion.key == word.lower()))
    return made.json()["id"], str(row.id)


async def test_accepting_shows_the_name_to_everybody(world: World, as_team) -> None:  # type: ignore[no-untyped-def]
    rid, sid = await _queue_one(world, 6400, "Hanuman Chalisa")
    done = await world.client.post(
        f"{QUEUE}/{sid}/decision", headers=as_team, json={"action": "accept"}
    )
    assert done.status_code == 200 and done.json()["field"] == "mantra"
    seen = (await world.client.get(f"/api/v1/recordings/{rid}", headers=AS_B)).json()
    assert (seen["type"], seen["type_other"], seen["type_other_checked"]) == (
        "other",
        "Hanuman Chalisa",
        True,
    )
    options = (
        await world.client.get("/api/v1/recordings/value-options", params={"field": "mantra"})
    ).json()
    assert options["accepted"] == [{"key": "hanuman chalisa", "label": "Hanuman Chalisa"}]
    again = await make(world, 6401, "b", type="other", type_other="hanuman chalisa")
    assert again.status_code == 201
    assert again.json()["type_other_checked"] is True


async def test_merging_makes_the_recording_one_of_the_listed_choices(world: World, as_team) -> None:  # type: ignore[no-untyped-def]
    rid, sid = await _queue_one(world, 6410, "Nityam Shuddhm")
    bad = await world.client.post(
        f"{QUEUE}/{sid}/decision",
        headers=as_team,
        json={"action": "merge", "merge_into": "bnk"},
    )
    assert bad.status_code == 422
    done = await world.client.post(
        f"{QUEUE}/{sid}/decision",
        headers=as_team,
        json={"action": "merge", "merge_into": "nityam_shuddham"},
    )
    assert done.status_code == 200
    got = (await world.client.get(f"/api/v1/recordings/{rid}", headers=AS_A)).json()
    assert (got["type"], got["type_other"]) == ("nityam_shuddham", None)
    again = await make(world, 6411, "b", type="other", type_other="nityam shuddhm")
    assert again.json()["type"] == "nityam_shuddham"


async def test_rejecting_drops_the_name_tells_the_author_and_refuses_it_next_time(
    world: World,
    as_team,  # type: ignore[no-untyped-def]
) -> None:
    rid, sid = await _queue_one(world, 6420, "Nonsense")
    done = await world.client.post(
        f"{QUEUE}/{sid}/decision", headers=as_team, json={"action": "reject"}
    )
    assert done.status_code == 200
    got = (await world.client.get(f"/api/v1/recordings/{rid}", headers=AS_A)).json()
    assert (got["kind"], got["type"], got["type_other"]) == ("other_mantra", "other", None)
    async with world.sessions() as session:
        notice = (await session.scalars(select(MemberNotice))).one()
    assert notice.kind == "value_rejected" and "Nonsense" in notice.body
    again = await make(world, 6421, "b", type="other", type_other="nonsense")
    assert again.status_code == 422 and "did not accept" in again.text


async def test_an_old_row_with_the_old_ids_still_reads(world: World) -> None:
    made = await make(world, 6500, type="pitriyajina")
    assert made.status_code == 201
    got = (await world.client.get(f"/api/v1/recordings/{made.json()['id']}")).json()
    assert got["type"] == "pitriyajina"
    # a row imported with the plain "other" and no name (the library import) reads as it is
    async with world.sessions() as session:
        row = await session.get(Recording, UUID(made.json()["id"]))
        row.type, row.type_other = "other", None
        await session.commit()
    again = (await world.client.get(f"/api/v1/recordings/{made.json()['id']}")).json()
    assert (again["type"], again["type_other"]) == ("other", None)
