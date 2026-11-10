"""The team's desks for takedown requests, play flags and new words (docs/team-desks.md).

The routes answer to a signed-in team member (`get_team_member`), not to the admin API key. The
rules themselves are pinned in test_takedown.py, test_play_fraud.py and test_value_suggestions.py;
here: who may call, that the actions reach the same services, and the audit name.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any, cast
from uuid import UUID, uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
os.environ.setdefault("APP_ENV", "test")

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import Table, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v1 import extras_common, team_queues
from app.api.v1 import value_suggestions as words_api
from app.config import Settings, get_settings
from app.core.db import get_session
from app.models import Base, UserAccount
from app.models.author_profiles import PlayDaily
from app.models.play_flag import PlayFlag
from app.models.recordings import (
    MemberNotice,
    Recording,
    ValueSuggestion,
    ValueSuggestionUse,
)
from app.models.takedown import BlockedAudioHash, TakedownRequest

AUTHOR = UUID("00000000-0000-0000-0000-00000000b001")
TEAM = UUID("00000000-0000-0000-0000-00000000b002")
PLAIN = UUID("00000000-0000-0000-0000-00000000b003")
SHA = "b" * 64
AS_TEAM = {"X-Test-Member": "team"}
AS_PLAIN = {"X-Test-Member": "plain"}


@dataclass
class World:
    http: httpx.AsyncClient
    sessions: async_sessionmaker[AsyncSession]
    recording_id: UUID


def now() -> datetime:
    return datetime.now(UTC)


@pytest_asyncio.fixture(name="world")
async def world_fixture() -> AsyncIterator[World]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [
        cast(Table, m.__table__)
        for m in (
            UserAccount,
            Recording,
            MemberNotice,
            TakedownRequest,
            BlockedAudioHash,
            PlayDaily,
            PlayFlag,
            ValueSuggestion,
            ValueSuggestionUse,
        )
    ]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    recording_id = uuid4()
    async with sessions() as session:
        for member_id, name in ((AUTHOR, "Author"), (TEAM, "Tara Team"), (PLAIN, "Plain")):
            session.add(
                UserAccount(
                    id=member_id,
                    external_subject=f"test:{name}",
                    identity_provider="test",
                    display_name=name,
                    email=f"{name.split()[0].lower()}@example.net",
                    last_seen_at=now(),
                )
            )
        session.add(
            Recording(
                id=recording_id,
                kind="kiirtan",
                type="bnk",
                title="Baba Nam Kevalam",
                author="A singer",
                added_by="Author",
                author_id=AUTHOR,
                audio_key="k",
                audio_url="http://t/k",
                audio_sha256=SHA,
                status="published",
            )
        )
        await session.commit()

    app = FastAPI()
    app.include_router(team_queues.router, prefix="/api/v1")
    app.include_router(words_api.router, prefix="/api/v1/recordings")

    async def get_db() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    async def team(request: Request) -> UserAccount:
        who = request.headers.get("X-Test-Member")
        ids = {"team": TEAM, "plain": PLAIN}
        if who not in ids:
            raise HTTPException(status_code=401, detail="Sign in")
        if who != "team":
            raise HTTPException(status_code=403, detail="Only the team can do this.")
        async with sessions() as own:
            row = await own.get(UserAccount, ids[who])
            assert row is not None
            return row

    app.dependency_overrides[get_session] = get_db
    app.dependency_overrides[extras_common.get_team_member] = team
    app.dependency_overrides[get_settings] = lambda: Settings.model_validate(
        {"_env_file": None, "RATE_LIMIT_PEPPER": "p" * 20}
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as http:
        yield World(http, sessions, recording_id)
    await engine.dispose()


async def add_request(world: World, **over: Any) -> UUID:
    row = TakedownRequest(
        id=uuid4(),
        reference="TD-" + uuid4().hex[:6].upper(),
        kind="notice",
        status="new",
        recording_ref=f"https://app.example/recording/{world.recording_id}",
        recording_id=world.recording_id,
        recording_title="Baba Nam Kevalam",
        sender_name="Rita Rightsholder",
        sender_email="rita@example.org",
        work_description="Our album Example, track 3. We own the sound recording.",
        statement_good_faith=True,
        statement_accuracy=True,
        signature="Rita",
        created_at=now(),
        updated_at=now(),
    )
    for key, value in over.items():
        setattr(row, key, value)
    async with world.sessions() as session:
        session.add(row)
        await session.commit()
    return row.id


TD = "/api/v1/team/takedowns"
FLAGS = "/api/v1/team/play-flags"
WORDS = "/api/v1/recordings/value-suggestions"


# --------------------------------------------------------------------------- who may call


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", TD),
        ("POST", f"{TD}/{uuid4()}/take-down"),
        ("POST", f"{TD}/{uuid4()}/reject"),
        ("POST", f"{TD}/{uuid4()}/restore"),
        ("GET", FLAGS),
        ("POST", f"{FLAGS}/{uuid4()}/2026-11-01/confirm"),
        ("GET", WORDS),
    ],
)
async def test_only_a_signed_in_team_member_gets_in(world: World, method: str, path: str) -> None:
    body: dict[str, Any] = {"note": "x", "reason": "because", "claimant_withdrew": False}
    anonymous = await world.http.request(method, path, json=body if method == "POST" else None)
    assert anonymous.status_code == 401
    plain = await world.http.request(
        method, path, headers=AS_PLAIN, json=body if method == "POST" else None
    )
    assert plain.status_code == 403


# --------------------------------------------------------------------------- takedown requests


async def test_the_queue_lists_requests_with_the_claimant_and_filters_by_status(
    world: World,
) -> None:
    waiting = await add_request(world)
    await add_request(world, status="taken_down", reference="TD-DONE22")

    everything = (await world.http.get(TD, headers=AS_TEAM)).json()
    assert everything["total"] == 2
    only_new = (await world.http.get(TD, headers=AS_TEAM, params={"status": "new"})).json()
    assert [i["id"] for i in only_new["items"]] == [str(waiting)]
    item = only_new["items"][0]
    assert item["sender_name"] == "Rita Rightsholder" and item["sender_email"] == "rita@example.org"
    assert item["recording_id"] == str(world.recording_id)
    assert item["work_description"] and item["created_at"]

    several = (
        await world.http.get(TD, headers=AS_TEAM, params={"status": "new,taken_down"})
    ).json()
    assert several["total"] == 2
    bad = await world.http.get(TD, headers=AS_TEAM, params={"status": "nonsense"})
    assert bad.status_code == 422


async def test_take_down_hides_the_recording_keeps_the_record_and_names_the_team_member(
    world: World,
) -> None:
    request_id = await add_request(world)
    done = await world.http.post(
        f"{TD}/{request_id}/take-down", headers=AS_TEAM, json={"note": "Checked the album."}
    )
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "taken_down" and done.json()["decided_by"] == "Tara Team"
    async with world.sessions() as session:
        recording = await session.get(Recording, world.recording_id)
        assert recording is not None and recording.status == "removed"  # hidden, row kept
        assert await session.get(TakedownRequest, request_id) is not None
        blocked = (await session.scalars(select(BlockedAudioHash))).all()
        assert [b.sha256 for b in blocked] == [SHA]
    again = await world.http.post(f"{TD}/{request_id}/take-down", headers=AS_TEAM, json={})
    assert again.status_code == 409


async def test_take_down_needs_a_linked_recording_and_link_reads_the_id_from_a_pasted_address(
    world: World,
) -> None:
    request_id = await add_request(world, recording_id=None, recording_title=None)
    refused = await world.http.post(f"{TD}/{request_id}/take-down", headers=AS_TEAM, json={})
    assert refused.status_code == 422

    nothing = await world.http.post(
        f"{TD}/{request_id}/link", headers=AS_TEAM, json={"recording": "Baba Nam Kevalam"}
    )
    assert nothing.status_code == 422
    unknown = await world.http.post(
        f"{TD}/{request_id}/link",
        headers=AS_TEAM,
        json={"recording": f"https://app.example/recording/{uuid4()}"},
    )
    assert unknown.status_code == 404
    linked = await world.http.post(
        f"{TD}/{request_id}/link",
        headers=AS_TEAM,
        json={"recording": f"https://app.example/recording/{world.recording_id}"},
    )
    assert linked.status_code == 200
    assert linked.json()["recording_id"] == str(world.recording_id)
    assert linked.json()["recording_title"] == "Baba Nam Kevalam"


async def test_reject_needs_a_note_and_leaves_the_recording_up(world: World) -> None:
    request_id = await add_request(world)
    short = await world.http.post(
        f"{TD}/{request_id}/reject", headers=AS_TEAM, json={"reason": "x"}
    )
    assert short.status_code == 422
    done = await world.http.post(
        f"{TD}/{request_id}/reject",
        headers=AS_TEAM,
        json={"reason": "The claim does not name a work."},
    )
    assert done.status_code == 200
    body = done.json()
    assert (
        body["status"] == "rejected"
        and body["decision_reason"] == "The claim does not name a work."
    )
    async with world.sessions() as session:
        recording = await session.get(Recording, world.recording_id)
        assert recording is not None and recording.status == "published"


async def test_restore_puts_the_recording_back_after_a_forwarded_counter_notice(
    world: World,
) -> None:
    original = await add_request(world)
    await world.http.post(f"{TD}/{original}/take-down", headers=AS_TEAM, json={})
    async with world.sessions() as session:
        notice = await session.get(TakedownRequest, original)
        assert notice is not None
        notice.status = "counter_received"
        await session.commit()
    counter = await add_request(
        world,
        kind="counter_notice",
        status="new",
        related_id=original,
        reference="TD-COUNTR",
        audio_sha256=SHA,
    )

    too_early = await world.http.post(f"{TD}/{counter}/restore", headers=AS_TEAM, json={})
    assert too_early.status_code == 409  # not forwarded yet

    forwarded = await world.http.post(f"{TD}/{counter}/forward", headers=AS_TEAM)
    assert forwarded.status_code == 200 and forwarded.json()["status"] == "forwarded"
    waiting = await world.http.post(f"{TD}/{counter}/restore", headers=AS_TEAM, json={})
    assert waiting.status_code == 409 and "waiting time" in waiting.json()["detail"]

    restored = await world.http.post(
        f"{TD}/{counter}/restore", headers=AS_TEAM, json={"claimant_withdrew": True}
    )
    assert restored.status_code == 200 and restored.json()["status"] == "restored"
    async with world.sessions() as session:
        recording = await session.get(Recording, world.recording_id)
        assert recording is not None and recording.status == "published"
        assert (await session.scalars(select(BlockedAudioHash))).all() == []


async def test_close_keeps_the_recording_down(world: World) -> None:
    request_id = await add_request(world)
    await world.http.post(f"{TD}/{request_id}/take-down", headers=AS_TEAM, json={})
    closed = await world.http.post(
        f"{TD}/{request_id}/close", headers=AS_TEAM, json={"reason": "Legal process started."}
    )
    assert closed.status_code == 200 and closed.json()["status"] == "closed"
    async with world.sessions() as session:
        recording = await session.get(Recording, world.recording_id)
        assert recording is not None and recording.status == "removed"


# --------------------------------------------------------------------------- play flags


async def add_flag(world: World, day: date, **over: Any) -> None:
    values: dict[str, Any] = {
        "recording_id": world.recording_id,
        "day": day,
        "plays": 500,
        "held": 480,
        "baseline": 10.0,
        "reason": "far above the usual",
        "status": "open",
        "confirmed_held": 0,
    }
    values.update(over)
    async with world.sessions() as session:
        session.add(PlayDaily(recording_id=world.recording_id, day=day, plays=values["plays"]))
        session.add(PlayFlag(**values))
        await session.commit()


async def test_the_play_flag_desk_is_empty_when_nothing_is_flagged(world: World) -> None:
    assert (await world.http.get(FLAGS, headers=AS_TEAM)).json() == []


async def test_the_team_lists_clears_confirms_and_unconfirms_flags(world: World) -> None:
    day = datetime.now(UTC).date() - timedelta(days=1)
    await add_flag(world, day)
    listing = (await world.http.get(FLAGS, headers=AS_TEAM)).json()
    assert len(listing) == 1
    row = listing[0]
    assert row["recording_title"] == "Baba Nam Kevalam" and row["status"] == "open"
    assert row["held"] == 480 and row["plays"] == 500 and row["reason"]
    # counts and a reason only: nothing that says who played
    assert not {"listener", "listener_key", "ip", "address", "client_key"} & set(row)

    confirmed = await world.http.post(
        f"{FLAGS}/{world.recording_id}/{day}/confirm", headers=AS_TEAM
    )
    assert confirmed.status_code == 200 and confirmed.json()["status"] == "confirmed"
    assert confirmed.json()["reviewed_by"] == "Tara Team"
    assert (await world.http.get(FLAGS, headers=AS_TEAM)).json() == []
    assert (
        len((await world.http.get(FLAGS, headers=AS_TEAM, params={"status": "confirmed"})).json())
        == 1
    )

    back = await world.http.post(f"{FLAGS}/{world.recording_id}/{day}/unconfirm", headers=AS_TEAM)
    assert back.status_code == 200 and back.json()["confirmed_held"] == 0
    again = await world.http.post(f"{FLAGS}/{world.recording_id}/{day}/unconfirm", headers=AS_TEAM)
    assert again.status_code == 409

    cleared = await world.http.post(f"{FLAGS}/{world.recording_id}/{day}/clear", headers=AS_TEAM)
    assert cleared.status_code == 200 and cleared.json()["status"] == "cleared"
    missing = await world.http.post(
        f"{FLAGS}/{world.recording_id}/{day - timedelta(days=5)}/clear", headers=AS_TEAM
    )
    assert missing.status_code == 404
    bad = await world.http.get(FLAGS, headers=AS_TEAM, params={"status": "nonsense"})
    assert bad.status_code == 422


# --------------------------------------------------------------------------- the words queue


async def test_the_words_queue_names_who_wrote_the_word_and_offers_the_listed_values(
    world: World,
) -> None:
    async with world.sessions() as session:
        session.add(
            ValueSuggestion(
                field="instrument",
                key="theremin",
                label="Theremin",
                status="pending",
                first_user_id=AUTHOR,
                recordings_count=3,
                people_count=2,
                created_at=now(),
            )
        )
        session.add(
            ValueSuggestion(
                field="language",
                key="tamil",
                label="Tamil",
                status="pending",
                first_user_id=None,
                recordings_count=1,
                people_count=1,
                created_at=now(),
            )
        )
        await session.commit()

    listed = (await world.http.get(WORDS, headers=AS_TEAM)).json()
    assert listed["total"] == 2
    by_field = {i["field"]: i for i in listed["items"]}
    theremin = by_field["instrument"]
    assert theremin["label"] == "Theremin" and theremin["first_by"] == "Author"
    assert theremin["recordings_count"] == 3 and theremin["people_count"] == 2
    targets = {t["code"]: t["label"] for t in theremin["merge_targets"]}
    assert targets["harmonium"] == "Harmonium" and "bass_guitar" in targets
    assert by_field["language"]["first_by"] is None
    assert by_field["language"]["merge_targets"]  # the language list

    merged = await world.http.post(
        f"{WORDS}/{theremin['id']}/decision",
        headers=AS_TEAM,
        json={"action": "merge", "merge_into": "harmonium"},
    )
    assert merged.status_code == 200 and merged.json()["status"] == "merged"
    assert merged.json()["decided_by"] == "Tara Team"
    assert (await world.http.get(WORDS, headers=AS_TEAM)).json()["total"] == 1
