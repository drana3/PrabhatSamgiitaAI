"""Takedown requests, counter-notices and the blocked file list (docs/takedown-process.md)."""

import os
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
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

from app.api.v1 import extras_common
from app.api.v1 import takedown as api
from app.config import Settings, get_settings
from app.core.db import get_session
from app.core.security import require_admin
from app.models import Base, UserAccount
from app.models.recordings import MemberNotice, Recording
from app.models.takedown import BlockedAudioHash, TakedownRequest
from app.services import blocked_hashes
from app.services import recordings as recordings_service
from app.services import takedowns as service

AUTHOR = UUID("00000000-0000-0000-0000-00000000a001")
STRANGER = UUID("00000000-0000-0000-0000-00000000a002")
SHA = "a" * 64


@dataclass
class World:
    http: httpx.AsyncClient
    sessions: async_sessionmaker[AsyncSession]
    recording_id: UUID


def notice_body(recording: str, **over: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": "Rita Rightsholder",
        "organization": "Example Music Ltd",
        "email": "rita@example.org",
        "recording": recording,
        "work": "Our album Example, track 3, recorded 2019. We own the sound recording.",
        "good_faith": True,
        "accuracy": True,
        "signature": "Rita Rightsholder",
    }
    body.update(over)
    return body


@pytest_asyncio.fixture(name="world")
async def world_fixture() -> AsyncIterator[World]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [
        cast(Table, m.__table__)
        for m in (UserAccount, Recording, MemberNotice, TakedownRequest, BlockedAudioHash)
    ]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    recording_id = uuid4()
    async with sessions() as session:
        for member_id, name in ((AUTHOR, "Author"), (STRANGER, "Stranger")):
            session.add(
                UserAccount(
                    id=member_id,
                    external_subject=f"test:{name}",
                    identity_provider="test",
                    display_name=name,
                    email=f"{name.lower()}@example.net",
                    last_seen_at=datetime.now(UTC),
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
    app.include_router(api.router, prefix="/api/v1")
    app.include_router(api.admin_router, prefix="/api/v1")

    async def get_db() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    state = {"admin": True}

    def admin() -> str:
        if not state["admin"]:
            raise HTTPException(status_code=401, detail="Invalid admin credentials")
        return "api-key-admin"

    async def member(request: Request) -> UserAccount:
        who = request.headers.get("X-Test-Member")
        ids = {"author": AUTHOR, "stranger": STRANGER}
        if who not in ids:
            raise HTTPException(status_code=401, detail="Sign in")
        async with sessions() as own:
            row = await own.get(UserAccount, ids[who])
            assert row is not None
            return row

    app.dependency_overrides[get_session] = get_db
    app.dependency_overrides[require_admin] = admin
    app.dependency_overrides[extras_common.get_member] = member
    app.dependency_overrides[get_settings] = lambda: Settings.model_validate(
        {"_env_file": None, "RATE_LIMIT_PEPPER": "p" * 20}
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as http:
        world = World(http, sessions, recording_id)
        world.state = state  # type: ignore[attr-defined]
        yield world
    await engine.dispose()


async def file(world: World, **over: Any) -> httpx.Response:
    return await world.http.post(
        "/api/v1/takedown",
        json=notice_body(f"https://app.example/recording/{world.recording_id}", **over),
    )


async def one(world: World, model: Any, **where: Any) -> Any:
    async with world.sessions() as session:
        return await session.scalar(select(model).filter_by(**where))


async def recording(world: World) -> Recording:
    row = await one(world, Recording, id=world.recording_id)
    assert row is not None
    return cast(Recording, row)


async def request_id(world: World) -> str:
    reference = (await file(world)).json()["reference"]
    row = await one(world, TakedownRequest, reference=reference)
    return str(row.id)


async def take_down(world: World, rid: str) -> httpx.Response:
    return await world.http.post(f"/api/v1/admin/takedowns/{rid}/take-down", json={})


# --------------------------------------------------------------------------- the public form


async def test_a_notice_is_stored_and_hides_nothing(world: World) -> None:
    response = await file(world)
    assert response.status_code == 201
    reference = response.json()["reference"]
    assert reference.startswith("TD-")
    row = await one(world, TakedownRequest, reference=reference)
    assert row.status == "new"
    assert row.recording_id == world.recording_id  # found from the address
    assert row.audio_sha256 == SHA
    assert (await recording(world)).status == "published"
    assert await one(world, BlockedAudioHash, sha256=SHA) is None


async def test_the_answer_is_the_same_whether_or_not_the_recording_exists(world: World) -> None:
    known = (await file(world)).json()
    unknown = (
        await world.http.post(
            "/api/v1/takedown",
            json=notice_body(f"https://app.example/recording/{uuid4()}", email="other@example.org"),
        )
    ).json()
    assert known["message"] == unknown["message"]
    assert set(known) == set(unknown) == {"reference", "message"}


async def test_the_statements_are_required(world: World) -> None:
    assert (await file(world, good_faith=False)).status_code == 422
    assert (await file(world, accuracy=False)).status_code == 422
    assert (await file(world, signature="")).status_code == 422
    assert (await file(world, email="not-an-address")).status_code == 422
    assert (await file(world, work="short")).status_code == 422
    assert (await file(world, name="x" * 300)).status_code == 422
    async with world.sessions() as session:
        assert (await session.scalars(select(TakedownRequest))).all() == []


async def test_a_bot_that_fills_the_hidden_field_stores_nothing(world: World) -> None:
    response = await file(world, website="http://spam.example")
    assert response.status_code == 201
    async with world.sessions() as session:
        assert (await session.scalars(select(TakedownRequest))).all() == []


async def test_pressing_twice_makes_one_request(world: World) -> None:
    first = (await file(world)).json()["reference"]
    second = (await file(world)).json()["reference"]
    assert first == second


async def test_one_sender_cannot_flood_the_queue(world: World) -> None:
    for index in range(service.MAX_PER_SENDER_PER_DAY):
        response = await world.http.post(
            "/api/v1/takedown", json=notice_body(f"Track number {index}")
        )
        assert response.status_code == 201
    over = await world.http.post("/api/v1/takedown", json=notice_body("One more track"))
    assert over.status_code == 429
    # another sender is not affected
    other = await world.http.post(
        "/api/v1/takedown", json=notice_body("One more track", email="else@example.org")
    )
    assert other.status_code == 201


async def test_a_flood_of_senders_cannot_shut_real_rights_holders_out(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    """There is no shared cap that one stranger could use up: past the warning level every notice
    is still accepted (as "new", nothing is acted on before the team reads it)."""
    monkeypatch.setattr(service, "FLOOD_WARN_PER_DAY", 2)
    for index in range(5):
        r = await world.http.post(
            "/api/v1/takedown",
            json=notice_body(f"Track {index}", email=f"s{index}@example.org"),
        )
        assert r.status_code == 201
    async with world.sessions() as session:
        rows = (await session.scalars(select(TakedownRequest))).all()
    assert len(rows) == 5 and {row.status for row in rows} == {"new"}


async def test_the_sender_address_is_not_kept_in_the_abuse_key(world: World) -> None:
    await file(world)
    row = await one(world, TakedownRequest, kind="notice")
    assert row.sender_key and "rita" not in row.sender_key and "@" not in row.sender_key


# --------------------------------------------------------------------------- the team's actions


async def test_taking_down_hides_blocks_and_tells_the_author(world: World) -> None:
    rid = await request_id(world)
    response = await take_down(world, rid)
    assert response.status_code == 200
    assert response.json()["status"] == "taken_down"
    row = await recording(world)
    assert row.status == "removed"
    assert "rights holder" in (row.removed_reason or "")
    assert await one(world, BlockedAudioHash, sha256=SHA) is not None
    notice = await one(world, MemberNotice, user_id=AUTHOR)
    assert notice is not None
    assert notice.kind == "recording_removed"
    assert "counter-notice" in notice.body
    assert "not legal advice" in notice.body
    assert notice.payload["actions"] == ["counter_notice", "contact"]
    assert notice.payload["takedown_reference"].startswith("TD-")
    assert "rita@example.org" not in notice.body  # the claimant's address is not passed on


async def test_a_blocked_file_cannot_be_uploaded_again(world: World) -> None:
    async with world.sessions() as session:
        await blocked_hashes.block(session, "B" * 64, reason="test", by="team")
        await session.commit()
        with pytest.raises(HTTPException) as caught:
            await recordings_service.exact_duplicate(session, "b" * 64)
        assert caught.value.status_code == 409
        assert "rights holder" in cast(dict[str, str], caught.value.detail)["message"]
        # an ordinary new file is not touched
        assert await recordings_service.exact_duplicate(session, "c" * 64) is None


async def test_taking_down_needs_a_linked_recording(world: World) -> None:
    created = await world.http.post(
        "/api/v1/takedown", json=notice_body("the third track of our album")
    )
    row = await one(world, TakedownRequest, reference=created.json()["reference"])
    assert (await take_down(world, str(row.id))).status_code == 422
    linked = await world.http.post(
        f"/api/v1/admin/takedowns/{row.id}/link", json={"recording_id": str(world.recording_id)}
    )
    assert linked.status_code == 200
    assert (await take_down(world, str(row.id))).status_code == 200


async def test_it_cannot_be_decided_twice(world: World) -> None:
    rid = await request_id(world)
    assert (await take_down(world, rid)).status_code == 200
    assert (await take_down(world, rid)).status_code == 409
    rejected = await world.http.post(
        f"/api/v1/admin/takedowns/{rid}/reject", json={"reason": "not enough proof"}
    )
    assert rejected.status_code == 409


async def test_rejecting_changes_nothing_else(world: World) -> None:
    rid = await request_id(world)
    response = await world.http.post(
        f"/api/v1/admin/takedowns/{rid}/reject", json={"reason": "no proof of the right"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert (await recording(world)).status == "published"
    assert await one(world, BlockedAudioHash, sha256=SHA) is None
    assert await one(world, MemberNotice, user_id=AUTHOR) is None


async def test_the_queue_is_for_the_team_only(world: World) -> None:
    await file(world)
    world.state["admin"] = False  # type: ignore[attr-defined]
    assert (await world.http.get("/api/v1/admin/takedowns")).status_code == 401
    rid = str((await one(world, TakedownRequest, kind="notice")).id)
    assert (await take_down(world, rid)).status_code == 401
    world.state["admin"] = True  # type: ignore[attr-defined]
    listing = (await world.http.get("/api/v1/admin/takedowns", params={"status": "new"})).json()
    assert listing["total"] == 1
    assert (await world.http.get("/api/v1/admin/takedowns", params={"status": "rejected"})).json()[
        "total"
    ] == 0


# --------------------------------------------------------------------------- counter-notice


def counter_body(**over: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "explanation": "I recorded this myself at the festival; the singer gave permission.",
        "good_faith": True,
        "accuracy": True,
        "signature": "Author",
    }
    body.update(over)
    return body


async def counter(world: World, reference: str, who: str = "author", **over: Any) -> httpx.Response:
    return await world.http.post(
        f"/api/v1/takedown/{reference}/counter-notice",
        json=counter_body(**over),
        headers={"X-Test-Member": who},
    )


async def taken_down(world: World) -> TakedownRequest:
    rid = await request_id(world)
    assert (await take_down(world, rid)).status_code == 200
    return cast(TakedownRequest, await one(world, TakedownRequest, id=UUID(rid)))


async def test_only_the_uploader_can_answer_and_only_once(world: World) -> None:
    original = await taken_down(world)
    assert (await counter(world, original.reference, who="stranger")).status_code == 404
    assert (await counter(world, original.reference, good_faith=False)).status_code == 422
    assert (await counter(world, original.reference, explanation="short")).status_code == 422
    ok = await counter(world, original.reference)
    assert ok.status_code == 201
    assert (await counter(world, original.reference)).status_code == 409
    row = await one(world, TakedownRequest, id=original.id)
    assert row.status == "counter_received"


async def test_nothing_to_answer_before_a_takedown(world: World) -> None:
    rid = await request_id(world)
    row = await one(world, TakedownRequest, id=UUID(rid))
    assert (await counter(world, row.reference)).status_code == 409


async def test_a_counter_notice_needs_someone_to_reach(world: World) -> None:
    original = await taken_down(world)
    async with world.sessions() as session:
        member = await session.get(UserAccount, AUTHOR)
        assert member is not None
        member.email = None
        await session.commit()
    assert (await counter(world, original.reference)).status_code == 422
    assert (await counter(world, original.reference, contact="me@example.org")).status_code == 201


async def counter_row(world: World) -> TakedownRequest:
    return cast(TakedownRequest, await one(world, TakedownRequest, kind="counter_notice"))


async def test_restore_waits_for_the_claimant(world: World) -> None:
    original = await taken_down(world)
    await counter(world, original.reference)
    row = await counter_row(world)
    base = f"/api/v1/admin/takedowns/{row.id}"
    # not forwarded yet
    assert (await world.http.post(f"{base}/restore", json={})).status_code == 409
    forwarded = await world.http.post(f"{base}/forward")
    assert forwarded.status_code == 200
    assert forwarded.json()["waiting_until"] is not None
    # waiting time still running
    assert (await world.http.post(f"{base}/restore", json={})).status_code == 409
    assert (await recording(world)).status == "removed"
    # the claimant withdrew: back at once
    done = await world.http.post(f"{base}/restore", json={"claimant_withdrew": True})
    assert done.status_code == 200
    assert (await recording(world)).status == "published"
    assert await one(world, BlockedAudioHash, sha256=SHA) is None
    assert (await one(world, TakedownRequest, id=original.id)).status == "restored"
    notices = [n.kind for n in (await _all(world, MemberNotice)) if n.user_id == AUTHOR]
    assert "recording_restored" in notices


async def _all(world: World, model: Any) -> list[Any]:
    async with world.sessions() as session:
        return list((await session.scalars(select(model))).all())


async def test_restore_after_the_waiting_time(world: World) -> None:
    original = await taken_down(world)
    await counter(world, original.reference)
    row = await counter_row(world)
    base = f"/api/v1/admin/takedowns/{row.id}"
    await world.http.post(f"{base}/forward")
    async with world.sessions() as session:
        stored = await session.get(TakedownRequest, row.id)
        assert stored is not None
        stored.forwarded_at = datetime.now(UTC) - timedelta(days=service.COUNTER_WAIT_DAYS + 1)
        await session.commit()
    assert (await world.http.post(f"{base}/restore", json={})).status_code == 200
    assert (await recording(world)).status == "published"


async def test_a_legal_process_keeps_it_down(world: World) -> None:
    original = await taken_down(world)
    await counter(world, original.reference)
    row = await counter_row(world)
    base = f"/api/v1/admin/takedowns/{row.id}"
    await world.http.post(f"{base}/forward")
    closed = await world.http.post(f"{base}/close", json={"reason": "claimant filed a suit"})
    assert closed.status_code == 200
    assert (await recording(world)).status == "removed"
    assert await one(world, BlockedAudioHash, sha256=SHA) is not None
    assert (await one(world, TakedownRequest, id=original.id)).status == "closed"
    assert (
        await world.http.post(f"{base}/restore", json={"claimant_withdrew": True})
    ).status_code == 409


async def test_a_notice_cannot_be_forwarded_or_restored(world: World) -> None:
    original = await taken_down(world)
    assert (
        await world.http.post(f"/api/v1/admin/takedowns/{original.id}/forward")
    ).status_code == 409
    restore = await world.http.post(f"/api/v1/admin/takedowns/{original.id}/restore", json={})
    assert restore.status_code == 409


# --------------------------------------------------------------------------- the letters


async def test_the_two_letters_are_filled_in(world: World) -> None:
    original = await taken_down(world)
    letters = (await world.http.get(f"/api/v1/admin/takedowns/{original.id}/letters")).json()
    assert original.reference in letters["to_claimant"]["subject"]
    assert "Rita Rightsholder" in letters["to_claimant"]["body"]
    assert "Baba Nam Kevalam" in letters["to_author"]["subject"]
    assert "counter-notice" in letters["to_author"]["body"]
    assert "not legal advice" in letters["to_author"]["body"].lower()
    assert "not legal advice" in letters["to_claimant"]["body"].lower()
    assert letters["disclaimer"] == "Templates, not legal advice."
    # both letters name the one address rights holders write to
    assert "info@anandamarga.org" in letters["to_author"]["body"]
    assert "info@anandamarga.org" in letters["to_claimant"]["body"]
    assert "anandamarga01" not in letters["to_claimant"]["body"]


async def test_the_claimant_letter_follows_the_status(world: World) -> None:
    rid = await request_id(world)
    row = await one(world, TakedownRequest, id=UUID(rid))
    new = service.letter_to_claimant(row).body
    assert "will read it" in new
    row.status = "rejected"
    row.decision_reason = "we could not find the recording"
    assert "we could not find the recording" in service.letter_to_claimant(row).body
    row.status = "forwarded"
    assert "counter-notice" in service.letter_to_claimant(row).body


# --------------------------------------------------------------------------- two requests, one file


async def second_notice_taken_down(world: World) -> TakedownRequest:
    """A different rights holder also asks for the same recording, and the team agrees."""
    reference = (await file(world, email="other.holder@example.org")).json()["reference"]
    row = await one(world, TakedownRequest, reference=reference)
    assert (await take_down(world, str(row.id))).status_code == 200
    return cast(TakedownRequest, await one(world, TakedownRequest, id=row.id))


async def forwarded_counter(world: World, original: TakedownRequest) -> str:
    await counter(world, original.reference)
    row = await counter_row(world)
    base = f"/api/v1/admin/takedowns/{row.id}"
    assert (await world.http.post(f"{base}/forward")).status_code == 200
    return base


async def test_the_block_is_one_row_per_request_and_lifting_one_keeps_the_other(
    world: World,
) -> None:
    first, second = uuid4(), uuid4()
    async with world.sessions() as session:
        await blocked_hashes.block(session, "C" * 64, reason="one", by="team", takedown_id=first)
        await blocked_hashes.block(session, "C" * 64, reason="two", by="team", takedown_id=second)
        await blocked_hashes.block(session, "C" * 64, reason="again", by="team", takedown_id=first)
        await session.commit()
        assert len((await session.scalars(select(BlockedAudioHash))).all()) == 2
        await blocked_hashes.unblock(session, "C" * 64, takedown_id=first)
        await session.commit()
        assert await blocked_hashes.is_blocked(session, "C" * 64) is True
        await blocked_hashes.unblock(session, "C" * 64, takedown_id=second)
        await session.commit()
        assert await blocked_hashes.is_blocked(session, "C" * 64) is False


async def test_restoring_for_one_request_does_not_undo_another_that_still_holds_the_file(
    world: World,
) -> None:
    original = await taken_down(world)
    other = await second_notice_taken_down(world)
    base = await forwarded_counter(world, original)

    refused = await world.http.post(f"{base}/restore", json={"claimant_withdrew": True})

    assert refused.status_code == 409
    assert other.reference in refused.json()["detail"]
    assert (await recording(world)).status == "removed"
    async with world.sessions() as session:
        rows = (await session.scalars(select(BlockedAudioHash))).all()
    assert len(rows) == 2  # one per request, nothing lifted
    assert (await one(world, TakedownRequest, id=original.id)).status == "counter_received"


async def test_a_closed_request_on_the_same_file_also_holds_it(world: World) -> None:
    original = await taken_down(world)
    other = await second_notice_taken_down(world)
    closed = await world.http.post(
        f"/api/v1/admin/takedowns/{other.id}/close", json={"reason": "claimant filed a suit"}
    )
    assert closed.status_code == 200
    base = await forwarded_counter(world, original)

    refused = await world.http.post(f"{base}/restore", json={"claimant_withdrew": True})

    assert refused.status_code == 409
    assert (await recording(world)).status == "removed"


async def test_a_request_that_was_not_acted_on_does_not_hold_anything(world: World) -> None:
    original = await taken_down(world)
    # a second notice that is only waiting (new) or was rejected does not hold the file
    await file(world, email="waiting@example.org")
    rejected_ref = (await file(world, email="no.proof@example.org")).json()["reference"]
    rejected = await one(world, TakedownRequest, reference=rejected_ref)
    assert (
        await world.http.post(
            f"/api/v1/admin/takedowns/{rejected.id}/reject",
            json={"reason": "no proof of the right"},
        )
    ).status_code == 200
    base = await forwarded_counter(world, original)

    done = await world.http.post(f"{base}/restore", json={"claimant_withdrew": True})

    assert done.status_code == 200
    assert (await recording(world)).status == "published"
    assert await one(world, BlockedAudioHash, sha256=SHA) is None


async def test_restore_needs_the_original_to_still_be_waiting(world: World) -> None:
    original = await taken_down(world)
    base = await forwarded_counter(world, original)
    async with world.sessions() as session:
        stored = await session.get(TakedownRequest, original.id)
        assert stored is not None
        stored.status = "closed"  # decided in the meantime
        await session.commit()

    refused = await world.http.post(f"{base}/restore", json={"claimant_withdrew": True})

    assert refused.status_code == 409
    assert (await recording(world)).status == "removed"
    assert await one(world, BlockedAudioHash, sha256=SHA) is not None
