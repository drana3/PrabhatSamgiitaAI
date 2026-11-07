"""Author profiles end to end: create, publish, review, public page, recordings, directory, reports,
team tools, delete. The rules these pin are in docs/author-profiles.md."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any, cast
from uuid import UUID, uuid4

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import Table, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.api.v1.author_profiles as api
from app.config import Settings, get_settings
from app.core.db import get_session
from app.models import UserAccount
from app.models.author_profiles import (
    AuthorProfile,
    AuthorProfilePhoto,
    AuthorRecordingLink,
    AuthorReport,
    AuthorSlugHistory,
    AuthorStatsSnapshot,
    AuthorSuspension,
    PlayDaily,
    PlayEvent,
)
from app.models.base import Base
from app.models.recording_collections import RecordingCollection
from app.models.recordings import AuthorBlock, Recording
from app.services import author_profiles as service
from app.services import author_stats as stats
from app.services.recordings import limiter

URL = "/api/v1/authors"
MEMBER_A, MEMBER_B, MEMBER_C, TEAM = (uuid4() for _ in range(4))
NAMES = {MEMBER_A: "Ananda", MEMBER_B: "Bhakti", MEMBER_C: "Chitra", TEAM: "Team"}
AS = {"a": {"X-Test-Member": "a"}, "b": {"X-Test-Member": "b"}, "c": {"X-Test-Member": "c"}}
AS_TEAM = {"X-Test-Member": "team"}
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 200


def body(**overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {"slug": "madhu-vrata", "display_name": "Madhu Vrata", "publish": True}
    data.update(overrides)
    return data


@dataclass
class World:
    client: httpx.AsyncClient
    sessions: async_sessionmaker[AsyncSession]

    async def create(self, who: str = "a", **overrides: Any) -> httpx.Response:
        return await self.client.post(f"{URL}/me", headers=AS[who], json=body(**overrides))

    async def get(self, slug: str, path: str = "", who: str | None = None, **params: Any) -> Any:
        headers = AS[who] if who else {}
        return await self.client.get(f"{URL}/{slug}{path}", headers=headers, params=params)

    async def recording(
        self,
        owner: UUID | None,
        title: str = "Baba Nam Kevalam",
        kind: str = "kiirtan",
        author: str = "",
        status: str = "published",
        duration: int | None = 300,
        **extra: Any,
    ) -> UUID:
        rid = uuid4()
        async with self.sessions() as session:
            session.add(
                Recording(
                    id=rid,
                    kind=kind,
                    type="other",
                    title=title,
                    author=author,
                    added_by="x",
                    author_id=owner,
                    status=status,
                    duration_sec=duration,
                    audio_key=f"k/{rid}",
                    audio_url=f"https://audio.example/{rid}.mp3",
                    audio_sha256=uuid4().hex + uuid4().hex,
                    published_at=datetime.now(UTC),
                    **extra,
                )
            )
            await session.commit()
        return rid

    async def profile(self, slug: str) -> AuthorProfile:
        async with self.sessions() as session:
            found = await session.scalar(select(AuthorProfile).where(AuthorProfile.slug == slug))
            assert found is not None
            return found

    async def rows(self, model: Any) -> list[Any]:
        async with self.sessions() as session:
            return list((await session.scalars(select(model))).all())

    async def listen(
        self, rid: UUID, count: int, *, country: str | None = "PL", day: date | None = None
    ) -> None:
        """`count` different listeners heard `rid` (written straight to the tables)."""
        day = day or datetime.now(UTC).date()
        async with self.sessions() as session:
            for _ in range(count):
                session.add(
                    PlayEvent(
                        recording_id=rid,
                        day=day,
                        listener_key=uuid4().hex[:6],
                        country=country,
                        listened_sec=60,
                        created_at=datetime.now(UTC),
                    )
                )
            existing = await session.get(PlayDaily, (rid, day))
            if existing:
                existing.plays += count
            else:
                session.add(PlayDaily(recording_id=rid, day=day, plays=count))
            await session.commit()


@pytest_asyncio.fixture
async def world() -> AsyncIterator[World]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [
        cast(Table, m.__table__)
        for m in (
            UserAccount,
            RecordingCollection,
            Recording,
            AuthorBlock,
            AuthorProfile,
            AuthorProfilePhoto,
            AuthorSlugHistory,
            AuthorRecordingLink,
            AuthorReport,
            PlayEvent,
            PlayDaily,
            AuthorStatsSnapshot,
            AuthorSuspension,
        )
    ]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sessions() as session:
        for member_id, name in NAMES.items():
            session.add(
                UserAccount(
                    id=member_id,
                    external_subject=f"test:{name}",
                    identity_provider="test",
                    display_name=name,
                    email=f"{name.lower()}@example.org",
                    is_admin=member_id == TEAM,
                    last_seen_at=datetime.now(UTC),
                )
            )
        await session.commit()

    settings = Settings.model_validate({"_env_file": None, "NEXT_PUBLIC_API_BASE_URL": "http://t"})
    app = FastAPI()
    from app.api.v1.router import router as v1

    app.include_router(v1)
    members = {"a": MEMBER_A, "b": MEMBER_B, "c": MEMBER_C, "team": TEAM}

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    async def lookup(request: Request) -> UserAccount | None:
        who = request.headers.get("X-Test-Member")
        if who not in members:
            return None
        async with sessions() as session:
            return await session.get(UserAccount, members[who])

    async def override_member(request: Request) -> UserAccount:
        member = await lookup(request)
        if member is None:
            raise HTTPException(status_code=401, detail="Sign in is required")
        return member

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[api.get_member] = override_member
    app.dependency_overrides[api.get_optional_member] = lookup
    app.dependency_overrides[get_settings] = lambda: settings
    limiter.reset()
    service.reset_refresh_clock()
    stats.reset_prune_clock()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        yield World(client, sessions)
    await engine.dispose()


def code(response: httpx.Response) -> str:
    detail = response.json()["detail"]
    return detail["code"] if isinstance(detail, dict) else detail


# --------------------------------------------------------------------------- addresses


async def test_address_check_explains_every_refusal(world: World) -> None:
    async def check(slug: str, who: str = "a") -> dict[str, Any]:
        r = await world.client.get(f"{URL}/slug-check", params={"slug": slug}, headers=AS[who])
        assert r.status_code == 200, r.text
        return r.json()

    assert (await check("Madhu Vrata"))["slug"] == "madhu-vrata"
    assert (await check("Madhu Vrata"))["available"] is True
    assert (await check("ab"))["problem"] == "too_short"
    assert (await check("admin"))["problem"] == "reserved"
    assert (await check("add-kirtan"))["problem"] == "reserved"
    held = await check("ananda-murti-songs")
    assert held["available"] is True and held["held_for_review"] is True
    assert (await world.create(slug="taken-name")).status_code == 201
    taken = await check("taken-name", "b")
    assert taken["problem"] == "taken" and taken["suggestions"]
    assert all(s != "taken-name" for s in taken["suggestions"])


async def test_my_own_address_is_available_to_me(world: World) -> None:
    await world.create(slug="mine-here")
    r = await world.client.get(f"{URL}/slug-check", params={"slug": "mine-here"}, headers=AS["a"])
    assert r.json()["available"] is True
    r = await world.client.get(f"{URL}/slug-check", params={"slug": "mine-here"}, headers=AS["b"])
    assert r.json()["problem"] == "taken"


# --------------------------------------------------------------------------- create and publish


async def test_a_page_starts_as_a_draft_and_is_private(world: World) -> None:
    made = await world.create(publish=False)
    assert made.status_code == 201, made.text
    mine = made.json()
    assert mine["status"] == "draft" and mine["indexable"] is False
    assert mine["share_path"] == "/author/madhu-vrata" and mine["include_uploads"] == "all"
    assert (await world.get("madhu-vrata")).status_code == 404  # nobody sees a draft
    me = await world.client.get(f"{URL}/me", headers=AS["a"])
    assert me.json()["profile"]["slug"] == "madhu-vrata" and me.json()["can_create"] is False


async def test_no_page_yet_is_not_an_error(world: World) -> None:
    me = await world.client.get(f"{URL}/me", headers=AS["b"])
    assert me.status_code == 200 and me.json() == {
        "profile": None,
        "can_create": True,
        "suspended_reason": None,
    }
    assert (await world.client.get(f"{URL}/me")).status_code == 401


async def test_one_page_per_member(world: World) -> None:
    assert (await world.create()).status_code == 201
    again = await world.create(slug="another-one")
    assert again.status_code == 409 and code(again) == "already_exists"


async def test_publishing_puts_the_page_on_the_public_address(world: World) -> None:
    await world.create(bio="Kiirtan from Warsaw", about="Line one.\n\nLine two.", country="Poland")
    page = await world.get("madhu-vrata")
    assert page.status_code == 200
    data = page.json()
    assert data["display_name"] == "Madhu Vrata" and data["bio"] == "Kiirtan from Warsaw"
    assert data["about"] == "Line one.\n\nLine two." and data["country"] == "Poland"
    assert data["recordings_count"] == 0 and data["indexable"] is False  # no recording yet
    assert "public" in page.headers["cache-control"]


async def test_the_public_page_has_no_private_data(world: World) -> None:
    await world.create(bio="hello")
    await world.recording(MEMBER_A)
    text = json.dumps((await world.get("madhu-vrata")).json()).lower()
    for word in ("member_id", "email", "review", "report", "suspend", "ananda", "example.org"):
        assert word not in text, word


async def test_names_and_text_are_cleaned_and_limited(world: World) -> None:
    r = await world.create(display_name="  Madhu ‮ Vrata  ")
    assert r.json()["display_name"] == "Madhu Vrata"
    short = await world.create(who="b", slug="bhakti-music", display_name="B")
    assert short.status_code == 422 and code(short) == "name_too_short"
    linky = await world.create(who="b", slug="bhakti-music", bio="visit https://x.example")
    assert linky.status_code == 422 and code(linky) == "text_has_link"
    linky_name = await world.create(who="b", slug="bhakti-music", display_name="my-site.com music")
    assert code(linky_name) == "text_has_link"
    bad_lang = await world.create(who="b", slug="bhakti-music", languages=["klingon"])
    assert code(bad_lang) == "language_unknown"


async def test_links_are_checked_and_shown_with_nofollow_ugc(world: World) -> None:
    for kind, url, why in (
        ("website", "javascript:alert(1)", "link_scheme"),
        ("website", "http://example.com", "link_scheme"),
        ("youtube", "https://evil.example/x", "link_host"),
        ("website", "https://localhost/x", "link_host"),
    ):
        r = await world.create(who="b", slug="bhakti-music", links=[{"kind": kind, "url": url}])
        assert r.status_code == 422 and code(r) == why, (url, r.text)
    ok = await world.create(
        links=[
            {"kind": "youtube", "url": "youtube.com/@madhu"},
            {"kind": "website", "url": "https://madhu.example.org/music"},
        ]
    )
    assert ok.status_code == 201
    links = (await world.get("madhu-vrata")).json()["links"]
    assert [link["url"] for link in links] == [
        "https://youtube.com/@madhu",
        "https://madhu.example.org/music",
    ]
    assert all("nofollow" in link["rel"] and "ugc" in link["rel"] for link in links)


# --------------------------------------------------------------------------- team review


async def test_a_protected_name_waits_for_the_team(world: World) -> None:
    made = await world.create(slug="ananda-murti-music", display_name="Ananda Murti Music")
    mine = made.json()
    assert mine["status"] == "draft" and mine["review_needed"] is True
    assert mine["review_reason"] == "protected_name"
    assert (await world.get("ananda-murti-music")).status_code == 404

    queue = await world.client.get(
        f"{URL.replace('authors', 'admin/authors')}?needs_review=true", headers=AS_TEAM
    )
    assert queue.status_code == 200 and queue.json()["total"] == 1
    pid = queue.json()["items"][0]["id"]
    approved = await world.client.post(f"/api/v1/admin/authors/{pid}/approve", headers=AS_TEAM)
    assert approved.status_code == 200 and approved.json()["status"] == "published"
    assert (await world.get("ananda-murti-music")).status_code == 200


async def test_a_name_like_a_library_artist_waits_for_the_team(world: World) -> None:
    await world.recording(None, author="Madhuvrata Das", title="Library kiirtan")
    r = await world.create(display_name="Madhuvr4ta Dās", slug="madhu-das")
    assert r.json()["review_needed"] is True and r.json()["review_reason"] == "look_alike_artist"
    # the same name on MY OWN uploads is fine
    await world.recording(MEMBER_B, author="Bhakti Devi", title="Mine")
    ok = await world.create(who="b", display_name="Bhakti Devi", slug="bhakti-devi")
    assert ok.json()["status"] == "published" and ok.json()["review_needed"] is False


async def test_a_name_like_another_page_waits_for_the_team(world: World) -> None:
    await world.create(display_name="Kalyani Sound", slug="kalyani-sound")
    r = await world.create(who="b", display_name="Kalyani  Sound.", slug="kalyani-2")
    assert r.json()["review_reason"] == "look_alike_page" and r.json()["status"] == "draft"


async def test_an_artist_claim_goes_to_the_team_and_verifying_adds_library_recordings(
    world: World,
) -> None:
    mine = await world.recording(MEMBER_A, title="My own")
    library = await world.recording(None, title="Old recording", author="Dada Maetreya")
    await world.recording(None, title="Someone else", author="Another Singer")
    r = await world.create(
        claimed_name="Dada Maetreya", slug="dada-music", display_name="Dada Music"
    )
    assert r.json()["review_reason"] == "artist_claim" and r.json()["status"] == "draft"
    pid = r.json()["id"]
    await world.client.post(f"/api/v1/admin/authors/{pid}/approve", headers=AS_TEAM)

    listed = await world.get("dada-music", "/recordings")
    assert [i["id"] for i in listed.json()["items"]] == [str(mine)]  # not verified: only my own

    verified = await world.client.post(f"/api/v1/admin/authors/{pid}/verify", headers=AS_TEAM)
    assert verified.json()["verified"] is True
    listed = await world.get("dada-music", "/recordings")
    assert {i["id"] for i in listed.json()["items"]} == {str(mine), str(library)}
    assert (await world.get("dada-music")).json()["verified"] is True

    # a changed claim is a new question: the badge and the library recordings go
    patched = await world.client.patch(
        f"{URL}/me", headers=AS["a"], json={"claimed_name": "Another Singer"}
    )
    assert patched.json()["verified"] is False and patched.json()["status"] == "draft"
    assert (await world.get("dada-music", "/recordings")).status_code == 404  # back to the team
    await world.client.post(f"/api/v1/admin/authors/{pid}/approve", headers=AS_TEAM)
    listed = await world.get("dada-music", "/recordings")
    assert [i["id"] for i in listed.json()["items"]] == [str(mine)]


async def test_renaming_a_published_page_into_a_protected_name_pulls_it_back(world: World) -> None:
    await world.create()
    r = await world.client.patch(
        f"{URL}/me", headers=AS["a"], json={"display_name": "Prabhat Samgiita Team"}
    )
    assert r.json()["status"] == "draft" and r.json()["review_needed"] is True
    assert (await world.get("madhu-vrata")).status_code == 404


async def test_team_tools_are_for_the_team(world: World) -> None:
    made = await world.create()
    pid = made.json()["id"]
    for action in ("approve", "verify", "unverify", "unsuspend"):
        r = await world.client.post(f"/api/v1/admin/authors/{pid}/{action}", headers=AS["b"])
        assert r.status_code == 403, action
    r = await world.client.post(
        f"/api/v1/admin/authors/{pid}/suspend", headers=AS["b"], json={"reason": "because"}
    )
    assert r.status_code == 403
    assert (await world.client.get("/api/v1/admin/authors", headers=AS["b"])).status_code == 403
    assert (await world.client.get("/api/v1/admin/authors")).status_code == 401


async def test_suspending_takes_the_page_down_and_tells_only_the_owner(world: World) -> None:
    pid = (await world.create()).json()["id"]
    await world.recording(MEMBER_A)
    r = await world.client.post(
        f"/api/v1/admin/authors/{pid}/suspend", headers=AS_TEAM, json={"reason": "Impersonation"}
    )
    assert r.json()["status"] == "suspended"
    assert (await world.get("madhu-vrata")).status_code == 404
    listing = await world.client.get(URL)
    assert listing.json()["total"] == 0
    mine = (await world.client.get(f"{URL}/me", headers=AS["a"])).json()["profile"]
    assert mine["status"] == "suspended" and mine["suspended_reason"] == "Impersonation"
    publish = await world.client.post(f"{URL}/me/publish", headers=AS["a"])
    assert publish.status_code == 403 and code(publish) == "suspended"
    again = await world.client.post(f"{URL}/me/unpublish", headers=AS["a"])
    assert again.status_code == 403

    back = await world.client.post(f"/api/v1/admin/authors/{pid}/unsuspend", headers=AS_TEAM)
    assert back.json()["status"] == "published"
    assert (await world.get("madhu-vrata")).status_code == 200


# --------------------------------------------------------------------------- recordings on the page


async def test_the_page_lists_the_owners_recordings_by_kind(world: World) -> None:
    await world.create()
    k1 = await world.recording(MEMBER_A, title="K1", kind="kiirtan")
    await world.recording(MEMBER_A, title="K2", kind="kiirtan")
    b1 = await world.recording(MEMBER_A, title="B1", kind="bhajan")
    legacy = await world.recording(MEMBER_A, title="Legacy", kind="devotional_song")
    await world.recording(MEMBER_A, title="PS", kind="prabhat_samgiita", ps_song_number=19)
    await world.recording(MEMBER_A, title="Gone", status="removed")
    await world.recording(MEMBER_B, title="Not mine")

    page = (await world.get("madhu-vrata")).json()
    assert page["recordings_count"] == 5 and page["indexable"] is True
    assert {k["kind"]: k["count"] for k in page["kinds"]} == {
        "kiirtan": 2,
        "bhajan": 2,  # the legacy "devotional song" counts as a Bhajan
        "prabhat_samgiita": 1,
    }
    everything = (await world.get("madhu-vrata", "/recordings")).json()
    assert everything["total"] == 5
    bhajans = (await world.get("madhu-vrata", "/recordings", kind="bhajan")).json()
    assert {i["id"] for i in bhajans["items"]} == {str(b1), str(legacy)}
    paged = (await world.get("madhu-vrata", "/recordings", limit=2, offset=4)).json()
    assert len(paged["items"]) == 1 and paged["has_more"] is False
    first = (await world.get("madhu-vrata", "/recordings", limit=2)).json()
    assert first["has_more"] is True and len(first["items"]) == 2
    others = (await world.get("madhu-vrata", "/recordings", kind="kiirtan", exclude=str(k1))).json()
    assert others["total"] == 1  # "more from this author" leaves the current one out
    assert (await world.get("madhu-vrata", "/recordings", kind="nonsense")).status_code == 422


async def test_a_removed_recording_leaves_the_page(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    assert (await world.get("madhu-vrata", "/recordings")).json()["total"] == 1
    async with world.sessions() as session:
        rec = await session.get(Recording, rid)
        assert rec is not None
        rec.status = "removed"
        await session.commit()
    assert (await world.get("madhu-vrata", "/recordings")).json()["total"] == 0


async def test_the_owner_switches_single_uploads_off_and_on(world: World) -> None:
    await world.create()
    one = await world.recording(MEMBER_A, title="One")
    two = await world.recording(MEMBER_A, title="Two")
    mine = (await world.client.get(f"{URL}/me/recordings", headers=AS["a"])).json()
    assert mine["total"] == 2 and all(item["shown"] for item in mine["items"])

    off = await world.client.put(
        f"{URL}/me/recordings/{one}", headers=AS["a"], json={"shown": False}
    )
    assert off.status_code == 204
    page = (await world.get("madhu-vrata", "/recordings")).json()
    assert [i["id"] for i in page["items"]] == [str(two)]
    mine = (await world.client.get(f"{URL}/me/recordings", headers=AS["a"])).json()
    by_id = {i["recording"]["id"]: i for i in mine["items"]}
    assert by_id[str(one)]["shown"] is False and by_id[str(one)]["exception"] is True

    await world.client.put(f"{URL}/me/recordings/{one}", headers=AS["a"], json={"shown": True})
    assert (await world.get("madhu-vrata", "/recordings")).json()["total"] == 2
    assert await world.rows(AuthorRecordingLink) == []  # back to the plain rule: no leftover row

    stranger = await world.client.put(
        f"{URL}/me/recordings/{one}", headers=AS["b"], json={"shown": False}
    )
    assert stranger.status_code in (404,)  # b has no page
    await world.create(who="b", slug="bhakti-music", display_name="Bhakti Music")
    not_mine = await world.client.put(
        f"{URL}/me/recordings/{one}", headers=AS["b"], json={"shown": False}
    )
    assert not_mine.status_code == 404


async def test_choosing_which_uploads_to_show_keeps_the_page_as_it_is_then_follows_the_choice(
    world: World,
) -> None:
    await world.create()
    one = await world.recording(MEMBER_A, title="One")
    two = await world.recording(MEMBER_A, title="Two")
    await world.client.put(f"{URL}/me/recordings/{one}", headers=AS["a"], json={"shown": False})

    switched = await world.client.patch(
        f"{URL}/me", headers=AS["a"], json={"include_uploads": "chosen"}
    )
    assert switched.json()["include_uploads"] == "chosen"
    assert [i["id"] for i in (await world.get("madhu-vrata", "/recordings")).json()["items"]] == [
        str(two)
    ]

    newer = await world.recording(MEMBER_A, title="New upload")
    assert (await world.get("madhu-vrata", "/recordings")).json()[
        "total"
    ] == 1  # new ones are NOT added
    await world.client.put(f"{URL}/me/recordings/{newer}", headers=AS["a"], json={"shown": True})
    assert (await world.get("madhu-vrata", "/recordings")).json()["total"] == 2

    back = await world.client.patch(f"{URL}/me", headers=AS["a"], json={"include_uploads": "all"})
    assert back.json()["include_uploads"] == "all"
    assert (await world.get("madhu-vrata", "/recordings")).json()["total"] == 3  # all means all


async def test_playlists_from_events_are_listed_when_they_have_tracks(world: World) -> None:
    await world.create()
    set_id = uuid4()
    async with world.sessions() as session:
        session.add(
            RecordingCollection(
                id=set_id,
                owner_id=MEMBER_A,
                owner_name="Ananda",
                title="Retreat in Kraków",
                starts_on=date(2026, 5, 1),
                ends_on=date(2026, 5, 3),
                place="Kraków",
                status="active",
            )
        )
        session.add(
            RecordingCollection(
                id=uuid4(),
                owner_id=MEMBER_A,
                owner_name="x",
                title="Empty",
                starts_on=date(2026, 6, 1),
                status="active",
            )
        )
        await session.commit()
    await world.recording(MEMBER_A, title="Track 1", collection_id=set_id, position=1)
    await world.recording(MEMBER_A, title="Track 2", collection_id=set_id, position=2)
    await world.recording(MEMBER_A, title="Outside")
    listed = (await world.get("madhu-vrata", "/collections")).json()["items"]
    assert [(c["title"], c["tracks_count"]) for c in listed] == [("Retreat in Kraków", 2)]
    assert (await world.get("madhu-vrata")).json()["collections_count"] == 1
    inside = (await world.get("madhu-vrata", "/recordings", collection_id=str(set_id))).json()
    assert inside["total"] == 2


# --------------------------------------------------------------------------- address changes


async def test_changing_the_address_of_a_public_page_keeps_the_old_one_working(
    world: World,
) -> None:
    await world.create()
    r = await world.client.patch(f"{URL}/me", headers=AS["a"], json={"slug": "madhu-vrata-music"})
    assert r.status_code == 200 and r.json()["slug"] == "madhu-vrata-music"
    old = await world.get("madhu-vrata")
    assert old.status_code == 301
    assert old.headers["location"].endswith("/authors/madhu-vrata-music")
    assert old.json()["slug"] == "madhu-vrata-music"
    assert (await world.get("madhu-vrata-music")).status_code == 200
    # nobody else can take the old address while it redirects
    taken = await world.client.get(
        f"{URL}/slug-check", params={"slug": "madhu-vrata"}, headers=AS["b"]
    )
    assert taken.json()["problem"] == "taken"


async def test_the_address_can_not_change_again_at_once(world: World) -> None:
    await world.create()
    await world.client.patch(f"{URL}/me", headers=AS["a"], json={"slug": "madhu-two"})
    again = await world.client.patch(f"{URL}/me", headers=AS["a"], json={"slug": "madhu-three"})
    assert again.status_code == 429 and code(again) == "slug_cooldown"
    me = (await world.client.get(f"{URL}/me", headers=AS["a"])).json()["profile"]
    assert me["slug_change_wait_days"] > 0 and me["slug"] == "madhu-two"
    # after the wait it works, and going back to a very old address of mine is fine
    async with world.sessions() as session:
        profile = await session.scalar(select(AuthorProfile))
        assert profile is not None
        profile.slug_changed_at = datetime.now(UTC) - timedelta(days=31)
        await session.commit()
    back = await world.client.patch(f"{URL}/me", headers=AS["a"], json={"slug": "madhu-vrata"})
    assert back.status_code == 200 and back.json()["slug"] == "madhu-vrata"
    assert (await world.get("madhu-two")).status_code == 301


async def test_a_draft_can_change_its_address_freely(world: World) -> None:
    await world.create(publish=False)
    for slug in ("one-name", "two-name", "three-name"):
        r = await world.client.patch(f"{URL}/me", headers=AS["a"], json={"slug": slug})
        assert r.status_code == 200, r.text
    assert await world.rows(AuthorSlugHistory) == []  # never public: nothing to redirect


async def test_an_address_taken_or_reserved_is_refused(world: World) -> None:
    await world.create()
    await world.create(who="b", slug="bhakti-music", display_name="Bhakti Music")
    taken = await world.client.patch(f"{URL}/me", headers=AS["b"], json={"slug": "madhu-vrata"})
    assert taken.status_code == 409 and code(taken) == "slug_taken"
    reserved = await world.client.patch(f"{URL}/me", headers=AS["b"], json={"slug": "admin"})
    assert reserved.status_code == 422 and code(reserved) == "slug_reserved"


# --------------------------------------------------------------------------- unpublish and delete


async def test_unpublishing_hides_the_page_and_publishing_brings_it_back(world: World) -> None:
    await world.create()
    off = await world.client.post(f"{URL}/me/unpublish", headers=AS["a"])
    assert off.json()["status"] == "draft"
    assert (await world.get("madhu-vrata")).status_code == 404
    on = await world.client.post(f"{URL}/me/publish", headers=AS["a"])
    assert on.json()["status"] == "published"
    assert (await world.get("madhu-vrata")).status_code == 200


async def test_deleting_the_page_answers_410_and_holds_the_address_back(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    await world.client.patch(f"{URL}/me", headers=AS["a"], json={"slug": "madhu-new"})
    assert (await world.client.delete(f"{URL}/me", headers=AS["a"])).status_code == 204
    assert (await world.get("madhu-new")).status_code == 410
    assert (await world.get("madhu-vrata")).status_code == 410  # the old redirecting one too
    assert (await world.client.get(f"{URL}/me", headers=AS["a"])).json()["profile"] is None
    # the recording stays in the library
    async with world.sessions() as session:
        assert await session.get(Recording, rid) is not None
    # nobody can take the address for 90 days, not even the same person
    check = await world.client.get(
        f"{URL}/slug-check", params={"slug": "madhu-new"}, headers=AS["b"]
    )
    assert check.json()["problem"] == "quarantined"
    r = await world.create(who="b", slug="madhu-new", display_name="Someone Else")
    assert r.status_code == 409 and code(r) == "slug_quarantined"
    # after the quarantine it is free again
    async with world.sessions() as session:
        row = await session.scalar(
            select(AuthorSlugHistory).where(AuthorSlugHistory.slug == "madhu-new")
        )
        assert row is not None
        row.quarantine_until = datetime.now(UTC) - timedelta(days=1)
        await session.commit()
    again = await world.create(who="b", slug="madhu-new", display_name="Someone Else")
    assert again.status_code == 201


async def test_deleting_a_page_removes_everything_that_hangs_on_it(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    await world.client.put(
        f"{URL}/me/photo", headers={**AS["a"], "content-type": "image/jpeg"}, content=JPEG
    )
    await world.client.put(f"{URL}/me/recordings/{rid}", headers=AS["a"], json={"shown": False})
    await world.client.post(f"{URL}/madhu-vrata/report", headers=AS["b"], json={"reason": "spam"})
    await world.client.delete(f"{URL}/me", headers=AS["a"])
    for model in (
        AuthorProfile,
        AuthorProfilePhoto,
        AuthorRecordingLink,
        AuthorReport,
        AuthorStatsSnapshot,
    ):
        assert await world.rows(model) == [], model.__name__


async def test_deleting_the_account_deletes_the_page_and_the_raw_listening_rows(
    world: World,
) -> None:
    await world.create()
    async with world.sessions() as session:
        member = await session.get(UserAccount, MEMBER_A)
        assert member is not None
        key = stats.listener_key(
            service.pepper(
                Settings.model_validate({"_env_file": None, "NEXT_PUBLIC_API_BASE_URL": "http://t"})
            ),
            f"m:{MEMBER_A}",
        )
        rid = await world.recording(MEMBER_B)
        session.add(
            PlayEvent(
                recording_id=rid,
                day=date.today(),
                listener_key=key,
                listened_sec=60,
                created_at=datetime.now(UTC),
            )
        )
        session.add(
            PlayEvent(
                recording_id=rid,
                day=date.today(),
                listener_key="ffffff",
                listened_sec=60,
                created_at=datetime.now(UTC),
            )
        )
        await session.commit()
        await service.erase_member(
            session,
            member,
            Settings.model_validate({"_env_file": None, "NEXT_PUBLIC_API_BASE_URL": "http://t"}),
        )
    assert await world.rows(AuthorProfile) == []
    left = await world.rows(PlayEvent)
    assert [e.listener_key for e in left] == ["ffffff"]


async def test_export_lists_what_the_feature_holds_about_me(world: World) -> None:
    await world.create(bio="hi")
    rid = await world.recording(MEMBER_A)
    await world.client.put(f"{URL}/me/recordings/{rid}", headers=AS["a"], json={"shown": False})
    await world.client.post(
        f"{URL}/madhu-vrata/report", headers=AS["b"], json={"reason": "spam", "comment": "x"}
    )
    mine = (await world.client.get(f"{URL}/me/export", headers=AS["a"])).json()
    assert mine["profile"]["slug"] == "madhu-vrata" and mine["profile"]["bio"] == "hi"
    assert mine["recording_choices"] == [{"recording_id": str(rid), "mode": "exclude"}]
    theirs = (await world.client.get(f"{URL}/me/export", headers=AS["b"])).json()
    assert theirs["profile"] is None and theirs["reports_i_made"][0]["reason"] == "spam"
    assert "anonymous" in theirs["listening"]


# --------------------------------------------------------------------------- photo


async def test_the_photo_is_checked_stored_and_served(world: World) -> None:
    await world.create()
    headers = {**AS["a"], "content-type": "image/jpeg"}
    assert (
        await world.client.put(f"{URL}/me/photo", headers=headers, content=b"")
    ).status_code == 422
    html = await world.client.put(
        f"{URL}/me/photo", headers=headers, content=b"<html><script>alert(1)"
    )
    assert html.status_code == 415 and code(html) == "photo_type"
    big = await world.client.put(f"{URL}/me/photo", headers=headers, content=JPEG + b"0" * 400_000)
    assert big.status_code == 413
    ok = await world.client.put(f"{URL}/me/photo", headers=headers, content=JPEG)
    assert ok.status_code == 200 and ok.json()["photo_url"].startswith(
        "/api/v1/authors/madhu-vrata/photo?v="
    )
    shown = await world.client.get(ok.json()["photo_url"])
    assert shown.status_code == 200 and shown.content == JPEG
    assert (
        shown.headers["content-type"] == "image/jpeg"
        and shown.headers["x-content-type-options"] == "nosniff"
    )
    assert "public" in shown.headers["cache-control"]
    assert (await world.get("madhu-vrata")).json()["photo_url"] == ok.json()["photo_url"]
    gone = await world.client.delete(f"{URL}/me/photo", headers=AS["a"])
    assert gone.json()["photo_url"] is None
    assert (await world.get("madhu-vrata", "/photo")).status_code == 404


async def test_a_draft_photo_is_only_for_its_owner(world: World) -> None:
    await world.create(publish=False)
    await world.client.put(
        f"{URL}/me/photo", headers={**AS["a"], "content-type": "image/jpeg"}, content=JPEG
    )
    assert (await world.get("madhu-vrata", "/photo")).status_code == 404
    assert (await world.get("madhu-vrata", "/photo", who="a")).status_code == 200
    assert (await world.get("madhu-vrata", "/photo", who="b")).status_code == 404


# --------------------------------------------------------------------------- directory, search


async def test_the_directory_lists_published_pages_with_a_recording(world: World) -> None:
    await world.create(display_name="Madhu Vrata")
    await world.recording(MEMBER_A)
    await world.create(who="b", slug="bhakti-music", display_name="Bhakti Music")  # no recording
    await world.create(who="c", slug="chitra-sound", display_name="Chitra Sound", publish=False)
    await world.recording(MEMBER_C)
    listed = (await world.client.get(URL)).json()
    assert [i["slug"] for i in listed["items"]] == ["madhu-vrata"]
    assert listed["total"] == 1 and listed["has_more"] is False
    assert set(listed["items"][0]) >= {
        "slug",
        "display_name",
        "bio",
        "verified",
        "photo_url",
        "recordings_count",
    }
    assert "email" not in json.dumps(listed)


async def test_directory_search_and_sort(world: World) -> None:
    await world.create(display_name="Madhu Vrata", bio="Kiirtan from Warsaw")
    ra = await world.recording(MEMBER_A)
    await world.create(who="b", slug="bhakti-music", display_name="Bhakti Music", bio="Bhajans")
    rb = await world.recording(MEMBER_B)
    await world.listen(rb, 12)
    await world.listen(ra, 6)
    by_listeners = (await world.client.get(URL, params={"sort": "listeners"})).json()["items"]
    assert [i["slug"] for i in by_listeners] == ["bhakti-music", "madhu-vrata"]
    assert by_listeners[0]["monthly_listeners"] == 12
    assert [
        i["slug"] for i in (await world.client.get(URL, params={"sort": "name"})).json()["items"]
    ] == [
        "bhakti-music",
        "madhu-vrata",
    ]
    assert [
        i["slug"] for i in (await world.client.get(URL, params={"q": "warsaw"})).json()["items"]
    ] == ["madhu-vrata"]
    assert [
        i["slug"] for i in (await world.client.get(URL, params={"q": "BHAK"})).json()["items"]
    ] == ["bhakti-music"]
    assert (await world.client.get(URL, params={"q": "100%"})).json()[
        "total"
    ] == 0  # % is not a wildcard
    page = (await world.client.get(URL, params={"limit": 1, "offset": 1})).json()
    assert len(page["items"]) == 1 and page["has_more"] is False and page["total"] == 2


async def test_a_page_that_hides_its_numbers_does_not_rank_by_them(world: World) -> None:
    await world.create(display_name="Madhu Vrata")
    ra = await world.recording(MEMBER_A)
    await world.create(who="b", slug="bhakti-music", display_name="Bhakti Music")
    rb = await world.recording(MEMBER_B)
    await world.listen(ra, 30)
    await world.listen(rb, 8)
    await world.client.patch(f"{URL}/me", headers=AS["a"], json={"show_stats": False})
    items = (await world.client.get(URL)).json()["items"]
    assert [i["slug"] for i in items] == ["bhakti-music", "madhu-vrata"]
    assert all(i["monthly_listeners"] != 30 for i in items)
    assert next(i for i in items if i["slug"] == "madhu-vrata")["monthly_listeners"] is None


async def test_a_blocked_author_is_left_out_of_my_directory(world: World) -> None:
    await world.create()
    await world.recording(MEMBER_A)
    async with world.sessions() as session:
        session.add(AuthorBlock(blocker_id=MEMBER_B, blocked_id=MEMBER_A))
        await session.commit()
    assert (await world.client.get(URL, headers=AS["b"])).json()["total"] == 0
    assert (await world.client.get(URL, headers=AS["c"])).json()["total"] == 1


async def test_the_line_under_a_recording_points_at_the_page(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    other = await world.recording(MEMBER_B)
    line = (await world.client.get(f"{URL}/by-recording/{rid}")).json()
    assert line["profile"]["slug"] == "madhu-vrata"
    assert (await world.client.get(f"{URL}/by-recording/{other}")).json() == {"profile": None}
    await world.client.put(f"{URL}/me/recordings/{rid}", headers=AS["a"], json={"shown": False})
    assert (await world.client.get(f"{URL}/by-recording/{rid}")).json() == {"profile": None}
    assert (await world.client.get(f"{URL}/by-recording/{uuid4()}")).status_code == 404


async def test_the_sitemap_lists_only_pages_a_search_engine_may_index(world: World) -> None:
    await world.create()
    await world.recording(MEMBER_A)
    await world.create(who="b", slug="bhakti-music", display_name="Bhakti Music")  # no recording
    await world.create(
        who="c", slug="ananda-murti-x", display_name="Ananda Murti X"
    )  # under review
    await world.recording(MEMBER_C)
    sitemap = (await world.client.get(f"{URL}/sitemap")).json()
    assert [item["slug"] for item in sitemap["items"]] == ["madhu-vrata"]
    page = (await world.get("bhakti-music")).json()
    assert page["indexable"] is False


# --------------------------------------------------------------------------- reports


async def test_reporting_a_page(world: World) -> None:
    await world.create()
    first = await world.client.post(
        f"{URL}/madhu-vrata/report", headers=AS["b"], json={"reason": "spam"}
    )
    assert first.json()["status"] == "received"
    again = await world.client.post(
        f"{URL}/madhu-vrata/report", headers=AS["b"], json={"reason": "spam"}
    )
    assert again.json()["status"] == "already_reported"
    own = await world.client.post(
        f"{URL}/madhu-vrata/report", headers=AS["a"], json={"reason": "spam"}
    )
    assert own.status_code == 400
    bad = await world.client.post(
        f"{URL}/madhu-vrata/report", headers=AS["b"], json={"reason": "meh"}
    )
    assert bad.status_code == 422
    assert (
        await world.client.post(f"{URL}/nobody-here/report", json={"reason": "spam"})
    ).status_code == 404
    # a signed-out reader can report too, once
    anon = await world.client.post(f"{URL}/madhu-vrata/report", json={"reason": "offensive"})
    assert anon.json()["status"] == "received"
    assert (await world.profile("madhu-vrata")).reports_count == 2


async def test_an_impersonation_report_goes_to_the_team_at_once_and_the_page_stays_up(
    world: World,
) -> None:
    await world.create()
    await world.client.post(
        f"{URL}/madhu-vrata/report", headers=AS["b"], json={"reason": "impersonation"}
    )
    profile = await world.profile("madhu-vrata")
    assert profile.report_reason == "impersonation" and profile.review_needed is False
    assert profile.status == "published"
    queue = (await world.client.get("/api/v1/admin/authors?reported=true", headers=AS_TEAM)).json()
    assert queue["total"] == 1
    reports = await world.client.get(f"/api/v1/admin/authors/{profile.id}/reports", headers=AS_TEAM)
    assert reports.json()[0]["reason"] == "impersonation"


async def test_three_different_reporters_put_a_page_in_front_of_the_team(world: World) -> None:
    await world.create()
    for who in ("b", "c"):
        await world.client.post(
            f"{URL}/madhu-vrata/report", headers=AS[who], json={"reason": "spam"}
        )
    assert (await world.profile("madhu-vrata")).report_reason is None
    await world.client.post(f"{URL}/madhu-vrata/report", headers=AS_TEAM, json={"reason": "spam"})
    profile = await world.profile("madhu-vrata")
    assert profile.report_reason == "spam"


async def test_unpublishing_and_publishing_keep_a_flag_raised_by_reports(world: World) -> None:
    made = await world.create()
    pid = made.json()["id"]
    await world.client.post(
        f"{URL}/madhu-vrata/report", headers=AS["b"], json={"reason": "impersonation"}
    )
    off = await world.client.post(f"{URL}/me/unpublish", headers=AS["a"])
    assert off.json()["review_needed"] is True
    assert off.json()["review_reason"] == "reported:impersonation"
    on = await world.client.post(f"{URL}/me/publish", headers=AS["a"])
    assert on.json()["status"] == "published"
    assert on.json()["review_needed"] is True
    assert on.json()["review_reason"] == "reported:impersonation"
    # verifying does not clear a report either; only approving does
    await world.client.post(f"/api/v1/admin/authors/{pid}/verify", headers=AS_TEAM)
    profile = await world.profile("madhu-vrata")
    assert profile.report_reason == "impersonation"
    await world.client.post(f"/api/v1/admin/authors/{pid}/approve", headers=AS_TEAM)
    profile = await world.profile("madhu-vrata")
    assert profile.report_reason is None
    assert profile.review_needed is False and profile.review_reason is None


async def test_a_name_check_never_overwrites_a_report_hold(world: World) -> None:
    made = await world.create()
    pid = made.json()["id"]
    await world.client.post(
        f"{URL}/madhu-vrata/report", headers=AS["b"], json={"reason": "impersonation"}
    )
    # the owner renames the live page into a protected name: the page goes back to the team
    renamed = await world.client.patch(
        f"{URL}/me", headers=AS["a"], json={"display_name": "Prabhat Samgiita Team"}
    )
    assert renamed.json()["status"] == "draft"
    assert renamed.json()["review_reason"] == "protected_name"
    profile = await world.profile("madhu-vrata")
    assert profile.review_reason == "protected_name"
    assert profile.report_reason == "impersonation"
    # a clean name later: the name-check flag goes, the report hold stays
    fixed = await world.client.patch(
        f"{URL}/me", headers=AS["a"], json={"display_name": "Madhu Vrata"}
    )
    assert fixed.status_code == 200
    on = await world.client.post(f"{URL}/me/publish", headers=AS["a"])
    assert on.json()["status"] == "published"
    assert on.json()["review_reason"] == "reported:impersonation"
    profile = await world.profile("madhu-vrata")
    assert profile.review_needed is False and profile.report_reason == "impersonation"
    # the team sees it in both lists and only approve clears it
    queue = (
        await world.client.get("/api/v1/admin/authors?needs_review=true", headers=AS_TEAM)
    ).json()
    assert queue["total"] == 1
    await world.client.post(f"/api/v1/admin/authors/{pid}/approve", headers=AS_TEAM)
    assert (await world.profile("madhu-vrata")).report_reason is None


async def test_unpublishing_still_clears_a_name_check_flag(world: World) -> None:
    held = await world.create(display_name="Prabhat Samgiita Team", slug="madhu-team")
    assert held.status_code == 201, held.text
    assert held.json()["review_reason"] == "protected_name"
    off = await world.client.post(f"{URL}/me/unpublish", headers=AS["a"])
    assert off.json()["review_needed"] is False and off.json()["review_reason"] is None


async def test_a_verified_claim_does_not_skip_the_other_name_checks(world: World) -> None:
    r = await world.create(
        claimed_name="Dada Maetreya", slug="dada-music", display_name="Dada Maetreya"
    )
    pid = r.json()["id"]
    await world.client.post(f"/api/v1/admin/authors/{pid}/approve", headers=AS_TEAM)
    await world.client.post(f"/api/v1/admin/authors/{pid}/verify", headers=AS_TEAM)
    assert (await world.get("dada-music")).json()["verified"] is True
    # a look-alike name appears in the library afterwards
    await world.recording(None, title="Old", author="Dada Maetreya Music")
    await world.client.post(f"{URL}/me/unpublish", headers=AS["a"])
    again = await world.client.post(f"{URL}/me/publish", headers=AS["a"])
    assert again.json()["status"] == "draft"
    assert again.json()["review_reason"] == "look_alike_artist"


async def test_renaming_or_moving_a_verified_page_removes_the_verification(world: World) -> None:
    r = await world.create(
        claimed_name="Dada Maetreya", slug="dada-music", display_name="Dada Music"
    )
    pid = r.json()["id"]
    await world.client.post(f"/api/v1/admin/authors/{pid}/approve", headers=AS_TEAM)
    await world.client.post(f"/api/v1/admin/authors/{pid}/verify", headers=AS_TEAM)
    renamed = await world.client.patch(
        f"{URL}/me", headers=AS["a"], json={"display_name": "Prabhat Samgiita Team"}
    )
    assert renamed.json()["verified"] is False and renamed.json()["status"] == "draft"
    assert renamed.json()["review_reason"] == "protected_name"


async def test_every_literal_route_under_authors_is_a_reserved_address(world: World) -> None:
    from app.api.v1.author_profiles import router
    from app.services import author_rules as rules

    # derived from the router: what the router has literally under /authors can never be a slug
    literal = {
        r.path[len(router.prefix) + 1 :].split("/", 1)[0]
        for r in router.routes
        if r.path.startswith(router.prefix + "/")
    }
    literal = {w for w in literal if w and not w.startswith("{")}
    assert {"sitemap", "slug-check", "me", "by-recording"} <= literal
    assert literal <= rules.route_words()
    for word in literal:
        assert rules.slug_problem(word) in ("reserved", "too_short"), word
    for word in ("sitemap", "slug-check", "by-recording"):
        check = await world.client.get(f"{URL}/slug-check", headers=AS["a"], params={"slug": word})
        assert check.json()["problem"] == "reserved", word
        made = await world.create(slug=word)
        assert made.status_code == 422, word


STAFF_CASES = [
    ("Admin Team", "madhu-vrata"),
    ("PS Team", "madhu-vrata"),
    ("Official PS", "madhu-vrata"),
    ("Support", "madhu-vrata"),
    ("Moderator", "madhu-vrata"),
    ("Dada Maetreya", "madhu-vrata"),
    ("Madhu Vrata", "support-team"),
    ("Madhu Vrata", "official-ps"),
    ("Madhu Vrata", "verified-artist"),
    ("Madhu Vrata", "admin1"),
]


@pytest.mark.parametrize(("name", "slug"), STAFF_CASES)
async def test_staff_sounding_names_wait_for_the_team(world: World, name: str, slug: str) -> None:
    made = await world.create(display_name=name, slug=slug)
    assert made.status_code == 201, made.text
    assert made.json()["status"] == "draft"
    assert made.json()["review_needed"] is True
    assert made.json()["review_reason"] in ("staff_name", "protected_name")
    assert (await world.get(slug)).status_code == 404


async def test_the_slug_check_warns_about_a_staff_sounding_address(world: World) -> None:
    check = await world.client.get(
        f"{URL}/slug-check", headers=AS["a"], params={"slug": "support-team"}
    )
    assert check.json()["available"] is True and check.json()["held_for_review"] is True


async def test_a_verified_page_may_keep_a_staff_sounding_name(world: World) -> None:
    made = await world.create(display_name="Official PS", slug="official-ps")
    pid = made.json()["id"]
    assert made.json()["review_reason"] == "staff_name"
    await world.client.post(f"/api/v1/admin/authors/{pid}/approve", headers=AS_TEAM)
    await world.client.post(f"/api/v1/admin/authors/{pid}/verify", headers=AS_TEAM)
    await world.client.post(f"{URL}/me/unpublish", headers=AS["a"])
    again = await world.client.post(f"{URL}/me/publish", headers=AS["a"])
    assert again.json()["status"] == "published" and again.json()["review_needed"] is False


async def test_approve_does_not_publish_a_draft_the_owner_made(world: World) -> None:
    saved = await world.create(publish=False)
    pid = saved.json()["id"]
    assert saved.json()["status"] == "draft"
    approved = await world.client.post(f"/api/v1/admin/authors/{pid}/approve", headers=AS_TEAM)
    assert approved.json()["status"] == "draft"
    assert (await world.get("madhu-vrata")).status_code == 404


async def test_approve_does_not_publish_a_page_the_owner_unpublished(world: World) -> None:
    held = await world.create(display_name="Prabhat Samgiita Team", slug="madhu-team")
    pid = held.json()["id"]
    assert held.json()["status"] == "draft" and held.json()["review_needed"] is True
    await world.client.post(f"{URL}/me/unpublish", headers=AS["a"])
    approved = await world.client.post(f"/api/v1/admin/authors/{pid}/approve", headers=AS_TEAM)
    assert approved.json()["status"] == "draft"
    # a live page with a report hold that the owner then unpublishes stays unpublished too
    live = await world.create("b", slug="bhakti-songs", display_name="Bhakti Songs")
    bid = live.json()["id"]
    await world.client.post(
        f"{URL}/bhakti-songs/report", headers=AS["c"], json={"reason": "impersonation"}
    )
    await world.client.post(f"{URL}/me/unpublish", headers=AS["b"])
    approved = await world.client.post(f"/api/v1/admin/authors/{bid}/approve", headers=AS_TEAM)
    assert approved.json()["status"] == "draft" and approved.json()["review_needed"] is False


async def test_approve_publishes_a_page_that_was_held_for_its_name(world: World) -> None:
    held = await world.create(display_name="Prabhat Samgiita Team", slug="madhu-team")
    pid = held.json()["id"]
    approved = await world.client.post(f"/api/v1/admin/authors/{pid}/approve", headers=AS_TEAM)
    assert approved.json()["status"] == "published" and approved.json()["review_needed"] is False
    assert (await world.get("madhu-team")).status_code == 200


async def test_reports_count_from_the_last_approve(world: World) -> None:
    made = await world.create()
    pid = made.json()["id"]
    for who in (AS["b"], AS["c"], AS_TEAM):
        await world.client.post(f"{URL}/madhu-vrata/report", headers=who, json={"reason": "spam"})
    assert (await world.profile("madhu-vrata")).report_reason == "spam"
    await world.client.post(f"/api/v1/admin/authors/{pid}/approve", headers=AS_TEAM)
    profile = await world.profile("madhu-vrata")
    assert profile.report_reason is None and profile.reports_count == 0
    # one new report is one report, not the fourth: the page is not held again
    await world.client.post(f"{URL}/madhu-vrata/report", json={"reason": "spam"})
    profile = await world.profile("madhu-vrata")
    assert profile.reports_count == 1 and profile.report_reason is None
    # the reports themselves are kept
    history = await world.client.get(f"/api/v1/admin/authors/{pid}/reports", headers=AS_TEAM)
    assert len(history.json()) == 4


# --------------------------------------------------------------------------- limits


async def test_edits_are_rate_limited(world: World) -> None:
    await world.create()
    last = None
    for i in range(service_edit_limit() + 2):
        last = await world.client.patch(f"{URL}/me", headers=AS["a"], json={"bio": f"bio {i}"})
        if last.status_code == 429:
            break
    assert last is not None and last.status_code == 429


def service_edit_limit() -> int:
    return api.EDITS_PER_HOUR


async def test_trying_names_is_limited_but_a_person_has_room_to_look_for_a_free_one(
    world: World,
) -> None:
    for _ in range(api.CREATE_TRIES_PER_HOUR):
        r = await world.create(slug="ab", display_name="Try", publish=False)
        assert r.status_code == 422  # too short: refused, and still has room
    over = await world.create(slug="try-name-9", display_name="Try 9", publish=False)
    assert over.status_code == 429


async def test_making_and_deleting_pages_over_and_over_is_limited(world: World) -> None:
    for i in range(api.DELETES_PER_DAY):
        made = await world.create(slug=f"churn-{i}", display_name=f"Churn {i}", publish=False)
        assert made.status_code == 201, made.text
        assert (await world.client.delete(f"{URL}/me", headers=AS["a"])).status_code == 204
    made = await world.create(slug="churn-last", display_name="Churn last", publish=False)
    assert made.status_code == 201
    assert (await world.client.delete(f"{URL}/me", headers=AS["a"])).status_code == 429


async def test_unknown_and_odd_addresses_are_plain_404s(world: World) -> None:
    for slug in ("nobody", "ADMIN", "x"):
        assert (await world.get(slug)).status_code == 404
    assert (await world.get("nobody", "/recordings")).status_code == 404
    assert (await world.get("nobody", "/collections")).status_code == 404


@pytest.mark.parametrize("slug", ["me-too", "madhu"])
async def test_a_page_in_the_directory_url_space_does_not_shadow_the_fixed_routes(
    world: World, slug: str
) -> None:
    await world.create(slug=slug)
    assert (await world.client.get(f"{URL}/me", headers=AS["a"])).json()["profile"]["slug"] == slug
    assert (await world.client.get(f"{URL}/sitemap")).status_code == 200


async def test_deleting_a_suspended_page_does_not_give_a_clean_start(world: World) -> None:
    pid = (await world.create()).json()["id"]
    await world.client.post(
        f"/api/v1/admin/authors/{pid}/suspend", headers=AS_TEAM, json={"reason": "Impersonation"}
    )
    assert (await world.client.delete(f"{URL}/me", headers=AS["a"])).status_code == 204  # may erase
    assert await world.rows(AuthorProfile) == []
    me = (await world.client.get(f"{URL}/me", headers=AS["a"])).json()
    assert me["profile"] is None and me["can_create"] is False
    assert me["suspended_reason"] == "Impersonation"
    again = await world.create(slug="fresh-start", display_name="Fresh Start")
    assert again.status_code == 403 and code(again) == "suspended"
    assert await world.rows(AuthorProfile) == []
    # other members are not touched
    assert (
        await world.create(who="b", slug="bhakti-music", display_name="Bhakti Music")
    ).status_code == 201

    listed = await world.client.get("/api/v1/admin/authors/suspensions", headers=AS_TEAM)
    assert [r["reason"] for r in listed.json()] == ["Impersonation"]
    assert (
        await world.client.get("/api/v1/admin/authors/suspensions", headers=AS["b"])
    ).status_code == 403
    lift = await world.client.post(
        f"/api/v1/admin/authors/members/{MEMBER_A}/lift-suspension", headers=AS_TEAM
    )
    assert lift.status_code == 204
    assert (await world.rows(AuthorSuspension)) == []
    ok = await world.create(slug="fresh-start", display_name="Fresh Start")
    assert ok.status_code == 201
    none_left = await world.client.post(
        f"/api/v1/admin/authors/members/{MEMBER_A}/lift-suspension", headers=AS_TEAM
    )
    assert none_left.status_code == 404


async def test_lifting_the_suspension_of_a_page_lifts_the_member_record(world: World) -> None:
    pid = (await world.create()).json()["id"]
    await world.client.post(
        f"/api/v1/admin/authors/{pid}/suspend", headers=AS_TEAM, json={"reason": "Spam"}
    )
    assert len(await world.rows(AuthorSuspension)) == 1
    await world.client.post(f"/api/v1/admin/authors/{pid}/unsuspend", headers=AS_TEAM)
    assert await world.rows(AuthorSuspension) == []


async def test_the_suspension_evasion_sequence_is_closed(world: World) -> None:
    """Create, publish, get reported, get suspended, delete the page, make a new one with the same
    name and another address: refused, and the evidence is still there for the team."""
    created = await world.create(display_name="Madhu Vrata")
    assert created.json()["status"] == "published"
    pid = created.json()["id"]
    await world.client.post(
        f"{URL}/madhu-vrata/report",
        headers=AS["b"],
        json={"reason": "impersonation", "comment": "Not the real Madhu"},
    )
    await world.client.post(f"{URL}/madhu-vrata/report", headers=AS["c"], json={"reason": "spam"})
    await world.client.post(
        f"/api/v1/admin/authors/{pid}/suspend", headers=AS_TEAM, json={"reason": "Impersonation"}
    )

    assert (await world.client.delete(f"{URL}/me", headers=AS["a"])).status_code == 204
    retry = await world.create(slug="madhu-vrata-2", display_name="Madhu Vrata", publish=True)
    assert retry.status_code == 403 and code(retry) == "suspended"
    assert await world.rows(AuthorProfile) == []  # no page of any kind was made

    [record] = await world.rows(AuthorSuspension)
    assert record.member_id == MEMBER_A and record.reason == "Impersonation"
    assert (
        record.evidence["slug"] == "madhu-vrata"
        and record.evidence["display_name"] == "Madhu Vrata"
    )
    assert [r["reason"] for r in record.evidence["reports"]] == ["impersonation", "spam"]
    assert record.evidence["reports"][0]["comment"] == "Not the real Madhu"
    text = json.dumps(record.evidence)
    assert str(MEMBER_B) not in text and str(MEMBER_C) not in text  # reporters are not named
    listed = (await world.client.get("/api/v1/admin/authors/suspensions", headers=AS_TEAM)).json()
    assert listed[0]["evidence"]["reports"][1]["reason"] == "spam"
