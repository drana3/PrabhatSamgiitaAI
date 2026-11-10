"""A guest's saved songs go into the account when the guest signs in (docs/guest-saves.md).

The merge route adds what the account lacks and removes nothing, so a person who already has saves
ends with the union, and a second send of the same list changes nothing.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select

from app.models import UserFavorite
from tests.member_session_support import OTHER_ID, PLAIN_ID, World
from tests.member_session_support import world_fixture as world_fixture  # noqa: F401

FAV = "/api/v1/members/favorites"


async def bearer(world: World, account_id: UUID = PLAIN_ID) -> dict[str, str]:
    return world.bearer(await world.tokens_for(account_id))


async def stored(world: World, account_id: UUID = PLAIN_ID) -> list[int]:
    async with world.sessions() as session:
        rows = await session.scalars(
            select(UserFavorite.song_number)
            .where(UserFavorite.user_id == account_id)
            .order_by(UserFavorite.song_number)
        )
        return list(rows)


async def test_merge_into_an_empty_account_keeps_every_song(world: World) -> None:
    headers = await bearer(world)

    response = await world.client.post(
        f"{FAV}/merge", json={"song_numbers": [3, 135, 12]}, headers=headers
    )

    assert response.status_code == 200
    assert sorted(response.json()) == [3, 12, 135]
    assert await stored(world) == [3, 12, 135]


async def test_merge_is_the_union_when_the_account_already_has_saves(world: World) -> None:
    headers = await bearer(world)
    await world.client.post(FAV, json={"song_number": 1}, headers=headers)
    await world.client.post(FAV, json={"song_number": 3}, headers=headers)

    response = await world.client.post(
        f"{FAV}/merge", json={"song_numbers": [3, 5, 8]}, headers=headers
    )

    assert sorted(response.json()) == [1, 3, 5, 8]
    assert await stored(world) == [1, 3, 5, 8]


async def test_merge_never_doubles_a_song_and_never_removes_one(world: World) -> None:
    headers = await bearer(world)
    await world.client.post(FAV, json={"song_number": 7}, headers=headers)

    # the same song twice in the list, one the account holds, and an empty second send
    first = await world.client.post(
        f"{FAV}/merge", json={"song_numbers": [9, 9, 7]}, headers=headers
    )
    second = await world.client.post(f"{FAV}/merge", json={"song_numbers": [9, 7]}, headers=headers)
    empty = await world.client.post(f"{FAV}/merge", json={"song_numbers": []}, headers=headers)

    assert sorted(first.json()) == sorted(second.json()) == sorted(empty.json()) == [7, 9]
    assert await stored(world) == [7, 9]


async def test_merge_only_touches_the_signed_in_account(world: World) -> None:
    mine = await bearer(world)
    theirs = await bearer(world, OTHER_ID)
    await world.client.post(FAV, json={"song_number": 2}, headers=theirs)

    await world.client.post(f"{FAV}/merge", json={"song_numbers": [4]}, headers=mine)

    assert await stored(world) == [4]
    assert await stored(world, OTHER_ID) == [2]


async def test_merge_refuses_a_song_that_does_not_exist_and_a_missing_session(
    world: World,
) -> None:
    headers = await bearer(world)

    too_big = await world.client.post(
        f"{FAV}/merge", json={"song_numbers": [1, 5019]}, headers=headers
    )
    zero = await world.client.post(f"{FAV}/merge", json={"song_numbers": [0]}, headers=headers)
    nobody = await world.client.post(f"{FAV}/merge", json={"song_numbers": [1]})

    assert too_big.status_code == 422
    assert zero.status_code == 422
    assert nobody.status_code in (401, 403)
    assert await stored(world) == []
