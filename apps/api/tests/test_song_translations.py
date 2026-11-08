"""Song translations: reading, the team's work, the table's refusals, the import, migration 0052.

Runs against an in-memory SQLite database. What PostgreSQL does with the migration is NOT covered
here: try it on a copy of the real database before a deploy.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
import pytest
import pytest_asyncio
import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import Table, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from test_recording_duplicates_migration import VERSIONS, load, run

from app.api.v1 import song_translations as api
from app.config import Settings, get_settings
from app.core.db import get_session
from app.core.security import require_admin
from app.models import Base, UserAccount
from app.models.song_translations import SongTranslation
from app.schemas.song_translations import Segment, TranslationCreate
from app.services import song_translations as service

TEAM = UUID("00000000-0000-0000-0000-0000000000c3")
MEMBER = UUID("00000000-0000-0000-0000-0000000000a1")
URL = "/api/v1/song-translations"
ADMIN = "/api/v1/admin/song-translations"

TWO_VERSIONS = "First version line one.\nFirst version line two.\n-----\nSecond version."


def seg(from_: int, to: int | None, text_: str = "x") -> Segment:
    return Segment(**{"from": from_, "to": to, "text": text_})


# --------------------------------------------------------------------------- pure rules


@pytest.mark.parametrize(
    ("kind", "trust", "status", "visible"),
    [
        ("official", "official", "published", True),
        ("official", "verified", "published", True),
        ("poetic", "reviewed", "published", True),
        ("poetic", "unchecked", "published", False),
        ("poetic", "machine", "published", False),
        # a literal translation is shown only when it is checked
        ("literal", "verified", "published", True),
        ("literal", "reviewed", "published", False),
        ("literal", "unchecked", "published", False),
        ("literal", "official", "published", False),
        # nothing unpublished is shown
        ("official", "official", "draft", False),
        ("official", "official", "archived", False),
        ("poetic", "verified", "pending", False),
        ("literal", "verified", "rejected", False),
    ],
)
def test_what_the_public_may_see(kind: str, trust: str, status: str, visible: bool) -> None:
    assert service.publicly_visible(kind, trust, status) is visible


def test_the_labels_a_reader_sees() -> None:
    assert service.label_of("official") == "official"
    assert service.label_of("verified") == "checked"
    assert service.label_of("reviewed") == "reviewed"


def test_two_official_versions_are_split_at_the_line_of_dashes() -> None:
    assert service.split_versions(TWO_VERSIONS) == [
        "First version line one.\nFirst version line two.",
        "Second version.",
    ]
    assert service.split_versions("One text.") == ["One text."]
    assert service.split_versions("  \n ") == []
    assert service.split_versions(None) == []
    # Windows line ends and a dash line with spaces around it
    assert service.split_versions("A.\r\n  ---------  \r\nB.") == ["A.", "B."]
    # a dash inside a sentence is not a separator
    assert service.split_versions("A - B -- C.") == ["A - B -- C."]


def test_alignment_is_derived_from_the_segments_never_typed() -> None:
    assert service.alignment_of([seg(0, None)]) == "whole"
    assert service.alignment_of([seg(0, 0), seg(1, 1), seg(2, 2)]) == "line"
    assert service.alignment_of([seg(0, 3), seg(4, None)]) == "stanza"


def test_segments_go_in_order_and_never_overlap() -> None:
    service.check_segments([seg(0, 1), seg(2, 3), seg(4, None)])
    with pytest.raises(ValueError, match="inside"):
        service.check_segments([seg(0, 2), seg(2, 3)])
    with pytest.raises(ValueError, match="last"):
        service.check_segments([seg(0, None), seg(1, 2)])
    with pytest.raises(ValueError):
        Segment(**{"from": 3, "to": 1, "text": "x"})


def test_a_text_is_not_corrected_only_its_line_ends_are_tidied() -> None:
    assert (
        service.normalize_text("  A tipo, lik this.  \r\nSecond.\t \n")
        == "A tipo, lik this.\nSecond."
    )


def test_create_needs_text_or_segments_and_cannot_mark_a_non_official_text_official() -> None:
    with pytest.raises(ValueError):
        TranslationCreate.model_validate({"song_id": 1, "kind": "poetic"})
    with pytest.raises(ValueError):
        TranslationCreate.model_validate(
            {"song_id": 1, "kind": "poetic", "text": "a", "segments": [{"from": 0, "text": "a"}]}
        )
    with pytest.raises(ValueError):
        TranslationCreate.model_validate(
            {"song_id": 1, "kind": "literal", "text": "a", "trust": "official"}
        )
    with pytest.raises(ValueError):
        TranslationCreate.model_validate(
            {"song_id": 1, "kind": "poetic", "text": "a", "trust": "verified"}
        )
    with pytest.raises(ValueError):
        TranslationCreate.model_validate({"song_id": 5019, "kind": "poetic", "text": "a"})


# --------------------------------------------------------------------------- fixture


class World:
    def __init__(self, client: httpx.AsyncClient, sessions: async_sessionmaker[AsyncSession]):
        self.client = client
        self.sessions = sessions

    async def add(self, **fields: Any) -> UUID:
        body: dict[str, Any] = {
            "song_id": 19,
            "language": "en",
            "kind": "poetic",
            "position": 0,
            "segments": [{"from": 0, "to": None, "text": "A poetic text."}],
            "alignment": "whole",
            "plain_text": "A poetic text.",
            "text_hash": "h" + str(len(fields)) + str(datetime.now(UTC).timestamp()),
            "author_kind": "team",
            "source_key": "team",
            "source_ref": str(datetime.now(UTC).timestamp()),
            "trust": "reviewed",
            "status": "published",
        }
        body.update(fields)
        async with self.sessions() as session:
            row = SongTranslation(**body)
            session.add(row)
            await session.commit()
            return row.id

    async def songs(self, rows: list[tuple[int, str | None, str | None]]) -> None:
        async with self.sessions() as session:
            for number, meaning, url in rows:
                await session.execute(
                    text(
                        "INSERT INTO songs (number, english_meaning, canonical_source_url)"
                        " VALUES (:n, :m, :u)"
                    ),
                    {"n": number, "m": meaning, "u": url},
                )
            await session.commit()

    async def rows(self, **where: Any) -> list[SongTranslation]:
        async with self.sessions() as session:
            query = select(SongTranslation).order_by(
                SongTranslation.song_id, SongTranslation.kind, SongTranslation.position
            )
            for key, value in where.items():
                query = query.where(getattr(SongTranslation, key) == value)
            return list((await session.scalars(query)).all())

    async def listing(self, song: int = 19) -> dict[str, Any]:
        response = await self.client.get(f"{URL}/songs/{song}")
        assert response.status_code == 200, response.text
        return cast(dict[str, Any], response.json())


@pytest_asyncio.fixture
async def world() -> AsyncIterator[World]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [cast(Table, m.__table__) for m in (UserAccount, SongTranslation)]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
        # `songs` uses PostgreSQL-only types: the import reads three columns, so three are enough
        await conn.execute(
            text(
                "CREATE TABLE songs (id INTEGER PRIMARY KEY, number INTEGER UNIQUE,"
                " english_meaning TEXT, canonical_source_url TEXT)"
            )
        )
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sessions() as session:
        for member_id, name in ((MEMBER, "Ananda"), (TEAM, "Carya")):
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
    app.include_router(api.router, prefix="/api/v1")
    app.include_router(api.admin_router, prefix="/api/v1")
    members = {"a": MEMBER, "team": TEAM}

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    async def override_member(request: Request) -> UserAccount:
        who = request.headers.get("X-Test-Member")
        if who not in members:
            raise HTTPException(status_code=401, detail="Sign in is required")
        async with sessions() as session:
            member = await session.get(UserAccount, members[who])
            assert member is not None
            return member

    async def override_admin() -> str:
        return "api-key-admin"

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[api.get_member] = override_member
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[require_admin] = override_admin
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        yield World(client, sessions)
    await engine.dispose()


# --------------------------------------------------------------------------- the table refuses


@pytest.mark.parametrize(
    "fields",
    [
        # a machine literal translation cannot exist
        {"kind": "literal", "trust": "machine"},
        # machine text is poetic only: not the official one, not under any other trust
        {"kind": "official", "trust": "machine"},
        # a "checked" text needs a named checker and a time
        {"trust": "verified"},
        {"trust": "verified", "verified_by": "Dada"},
        # the official label is for the official import only
        {"kind": "official", "trust": "official", "author_kind": "team"},
        {"kind": "karaoke"},
        {"song_id": 0},
        {"song_id": 5019},
        {"alignment": "paragraph"},
        {"status": "live"},
    ],
)
async def test_the_table_refuses_what_must_never_exist(
    world: World, fields: dict[str, Any]
) -> None:
    with pytest.raises(IntegrityError):
        await world.add(**fields)


async def test_the_table_accepts_a_checked_text_with_a_checker_and_a_machine_poetic_text(
    world: World,
) -> None:
    await world.add(trust="verified", verified_by="Dada", verified_at=datetime.now(UTC))
    await world.add(kind="poetic", trust="machine", language="ru")
    assert len(await world.rows()) == 2


async def test_the_import_key_is_unique(world: World) -> None:
    fields = {"source_key": "official-lyrics-page", "source_ref": "u", "position": 0}
    await world.add(**fields)
    with pytest.raises(IntegrityError):
        await world.add(**fields)


# --------------------------------------------------------------------------- reading


async def test_a_reader_sees_only_what_may_be_shown_in_the_order_of_the_page(world: World) -> None:
    await world.add(kind="literal", trust="reviewed", plain_text="literal not checked")
    await world.add(kind="poetic", trust="unchecked", plain_text="poetic not looked at")
    await world.add(kind="draft-ignored", trust="reviewed") if False else None
    await world.add(kind="poetic", trust="reviewed", plain_text="poetic read", position=0)
    await world.add(
        kind="literal",
        trust="verified",
        verified_by="Dada",
        verified_at=datetime.now(UTC),
        plain_text="literal checked",
        credit_line="Checked by the team",
        commentary="  A note on the word Prema.  ",
    )
    await world.add(
        kind="official", trust="official", author_kind="official", plain_text="official"
    )
    await world.add(kind="poetic", trust="reviewed", status="archived", plain_text="old poetic")
    await world.add(
        kind="official", trust="official", author_kind="official", position=1, plain_text="other"
    )
    data = await world.listing()
    assert data["kinds"] == ["official", "poetic", "literal"]
    assert [(i["kind"], i["text"]) for i in data["items"]] == [
        ("official", "official"),
        ("official", "other"),
        ("poetic", "poetic read"),
        ("literal", "literal checked"),
    ]
    literal = data["items"][-1]
    assert literal["checked"] is True and literal["label"] == "checked"
    assert literal["commentary"] == "A note on the word Prema."
    assert literal["credit_line"] == "Checked by the team"
    assert data["items"][0]["checked"] is False and data["items"][0]["label"] == "official"
    # nothing internal leaks
    for item in data["items"]:
        for private in ("license_note", "doubts", "verified_by", "trust", "status", "source_ref"):
            assert private not in item


async def test_an_empty_commentary_is_null_so_the_block_is_not_shown(world: World) -> None:
    await world.add(kind="official", trust="official", author_kind="official", commentary="   ")
    assert (await world.listing())["items"][0]["commentary"] is None


async def test_a_song_with_nothing_has_an_empty_list(world: World) -> None:
    data = await world.listing(20)
    assert data == {"song_id": 20, "language": "en", "kinds": [], "items": []}


async def test_the_list_is_served_with_an_etag_and_answers_304(world: World) -> None:
    await world.add(kind="official", trust="official", author_kind="official")
    first = await world.client.get(f"{URL}/songs/19")
    etag = first.headers["etag"]
    assert etag
    again = await world.client.get(f"{URL}/songs/19", headers={"If-None-Match": etag})
    assert again.status_code == 304


async def test_another_language_is_its_own_list(world: World) -> None:
    await world.add(kind="official", trust="official", author_kind="official")
    response = await world.client.get(f"{URL}/songs/19", params={"language": "ru"})
    assert response.json()["items"] == []
    assert (await world.client.get(f"{URL}/songs/5019")).status_code == 422
    assert (await world.client.get(f"{URL}/songs/19", params={"language": "x"})).status_code == 422


async def test_availability_lists_only_visible_kinds(world: World) -> None:
    await world.add(song_id=1, kind="official", trust="official", author_kind="official")
    await world.add(song_id=2, kind="literal", trust="reviewed")
    await world.add(
        song_id=3, kind="literal", trust="verified", verified_by="D", verified_at=datetime.now(UTC)
    )
    response = await world.client.get(f"{URL}/availability")
    assert response.json() == {"language": "en", "official": [1], "poetic": [], "literal": [3]}


# --------------------------------------------------------------------------- members do not offer


async def test_a_member_cannot_offer_a_translation_and_only_the_team_checks(world: World) -> None:
    body = {"song_id": 19, "kind": "poetic", "text": "My own translation."}
    assert (
        await world.client.post(URL, json=body, headers={"X-Test-Member": "a"})
    ).status_code in (404, 405)
    row_id = await world.add(kind="literal", trust="reviewed")
    forbidden = await world.client.post(
        f"{URL}/review/{row_id}/verify", json={}, headers={"X-Test-Member": "a"}
    )
    assert forbidden.status_code == 403
    nobody = await world.client.post(f"{URL}/review/{row_id}/verify", json={})
    assert nobody.status_code == 401
    queue = await world.client.get(f"{URL}/review/queue", headers={"X-Test-Member": "a"})
    assert queue.status_code == 403
    ok = await world.client.post(
        f"{URL}/review/{row_id}/verify",
        json={"note": "Compared with the Bengali."},
        headers={"X-Test-Member": "team"},
    )
    assert ok.status_code == 200
    assert ok.json()["verified_by"] == "Carya" and ok.json()["checked"] is True


# --------------------------------------------------------------------------- the team


async def test_the_team_adds_a_literal_text_and_it_stays_hidden_until_it_is_checked(
    world: World,
) -> None:
    created = await world.client.post(
        ADMIN,
        json={
            "song_id": 19,
            "kind": "literal",
            "segments": [
                {"from": 0, "to": 0, "text": "Line one, word for word."},
                {"from": 1, "to": 1, "text": "Line two."},
            ],
            "credit_line": "Prepared by the team",
            "commentary": "The word Prema is not love in the usual sense.",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "published" and body["trust"] == "reviewed"
    assert body["alignment"] == "line" and body["checked"] is False
    assert body["text"] == "Line one, word for word.\nLine two."
    # a literal translation nobody checked is not shown to readers
    assert (await world.listing())["items"] == []
    verified = await world.client.post(
        f"{ADMIN}/{body['id']}/verify",
        json={"reviewer": "Dada Maetreya", "note": "Checked against Bengali."},
    )
    assert verified.status_code == 200
    assert verified.json()["checked"] is True and verified.json()["verified_by"] == "Dada Maetreya"
    shown = (await world.listing())["items"]
    assert [(i["kind"], i["checked"], i["label"]) for i in shown] == [("literal", True, "checked")]
    assert shown[0]["commentary"].startswith("The word Prema")
    # taking "Checked" off hides a literal text again
    back = await world.client.post(f"{ADMIN}/{body['id']}/unverify")
    assert back.json()["trust"] == "reviewed" and back.json()["verified_by"] is None
    assert (await world.listing())["items"] == []


async def test_the_team_cannot_type_in_checked_or_machine_and_a_text_is_not_added_twice(
    world: World,
) -> None:
    for trust in ("verified", "machine"):
        bad = await world.client.post(
            ADMIN, json={"song_id": 19, "kind": "poetic", "text": "x", "trust": trust}
        )
        assert bad.status_code == 422
    assert (
        await world.client.post(ADMIN, json={"song_id": 19, "kind": "poetic"})
    ).status_code == 422
    overlap = await world.client.post(
        ADMIN,
        json={
            "song_id": 19,
            "kind": "poetic",
            "segments": [{"from": 0, "to": 2, "text": "a"}, {"from": 2, "text": "b"}],
        },
    )
    assert overlap.status_code == 422
    once = await world.client.post(
        ADMIN, json={"song_id": 19, "kind": "poetic", "text": "The same text."}
    )
    assert once.status_code == 201
    twice = await world.client.post(
        ADMIN, json={"song_id": 19, "kind": "poetic", "text": "The same text."}
    )
    assert twice.status_code == 409
    # a second text of the kind is the next version
    other = await world.client.post(
        ADMIN, json={"song_id": 19, "kind": "poetic", "text": "Another poetic text."}
    )
    assert other.json()["position"] == 1


async def test_a_machine_text_cannot_be_checked_and_a_draft_cannot_either(world: World) -> None:
    machine = await world.add(kind="poetic", trust="machine", language="ru")
    assert (await world.client.post(f"{ADMIN}/{machine}/verify", json={})).status_code == 409
    draft = await world.add(kind="poetic", trust="reviewed", status="draft")
    assert (await world.client.post(f"{ADMIN}/{draft}/verify", json={})).status_code == 409
    never = await world.add(kind="poetic", trust="reviewed")
    assert (await world.client.post(f"{ADMIN}/{never}/unverify")).status_code == 409


async def test_a_new_version_replaces_the_old_one_which_is_kept_archived(world: World) -> None:
    first = await world.client.post(
        ADMIN, json={"song_id": 19, "kind": "poetic", "text": "Old words."}
    )
    first_id = first.json()["id"]
    new = await world.client.post(
        ADMIN, json={"song_id": 19, "kind": "poetic", "text": "New words.", "replaces_id": first_id}
    )
    assert new.status_code == 201 and new.json()["position"] == first.json()["position"]
    assert [i["text"] for i in (await world.listing())["items"]] == ["New words."]
    archived = await world.client.get(ADMIN, params={"filter": "archived"})
    assert [i["text"] for i in archived.json()["items"]] == ["Old words."]
    wrong = await world.client.post(
        ADMIN, json={"song_id": 20, "kind": "poetic", "text": "Elsewhere.", "replaces_id": first_id}
    )
    assert wrong.status_code == 422
    # archive and restore
    again = await world.client.post(f"{ADMIN}/{first_id}/restore")
    assert again.json()["status"] == "published"
    hidden = await world.client.post(f"{ADMIN}/{first_id}/archive")
    assert hidden.json()["status"] == "archived"


async def test_the_team_list_shows_what_readers_do_not_see(world: World) -> None:
    await world.add(kind="literal", trust="reviewed", plain_text="not checked yet")
    await world.add(
        kind="official", trust="official", author_kind="official", plain_text="official one"
    )
    everything = (await world.client.get(ADMIN)).json()
    assert everything["total"] == 2
    assert all("license_note" in item for item in everything["items"])
    unchecked = (await world.client.get(ADMIN, params={"filter": "unchecked"})).json()
    assert unchecked["total"] == 2
    literal_only = (await world.client.get(ADMIN, params={"kind": "literal"})).json()
    assert [i["text"] for i in literal_only["items"]] == ["not checked yet"]
    assert (await world.client.get(ADMIN, params={"filter": "checked"})).json()["total"] == 0


# --------------------------------------------------------------------------- the import


async def test_the_import_keeps_both_official_versions_and_marks_nothing_on_its_own(
    world: World,
) -> None:
    await world.songs(
        [
            (1, "Only one version.", "https://example.org/1"),
            (2, TWO_VERSIONS, "https://example.org/2"),
            (3, None, None),
            (4, "   ", None),
        ]
    )
    dry = (await world.client.post(f"{ADMIN}/import")).json()
    assert dry["dry_run"] is True
    assert (dry["songs_with_text"], dry["created"], dry["songs_with_two_versions"]) == (2, 3, 1)
    assert await world.rows() == []
    done = (await world.client.post(f"{ADMIN}/import", params={"dry_run": "false"})).json()
    assert done["dry_run"] is False and done["created"] == 3
    rows = await world.rows()
    assert [(r.song_id, r.position, r.kind, r.trust, r.alignment) for r in rows] == [
        (1, 0, "official", "official", "whole"),
        (2, 0, "official", "official", "whole"),
        (2, 1, "official", "official", "whole"),
    ]
    assert rows[1].plain_text == "First version line one.\nFirst version line two."
    assert rows[2].plain_text == "Second version."
    assert rows[0].source_ref == "https://example.org/1" and rows[0].credit_line
    assert rows[0].segments == [{"from": 0, "to": None, "text": "Only one version.", "doubt": None}]
    # the page: the second version is "Other version", position 1
    data = await world.listing(2)
    assert [(i["kind"], i["position"], i["label"]) for i in data["items"]] == [
        ("official", 0, "official"),
        ("official", 1, "official"),
    ]


async def test_the_import_is_safe_to_repeat_and_never_overwrites_the_teams_work(
    world: World,
) -> None:
    await world.songs([(1, "Original words.", "u"), (2, "Other words.", "u2")])
    first = (await world.client.post(f"{ADMIN}/import", params={"dry_run": "false"})).json()
    assert first["created"] == 2
    again = (await world.client.post(f"{ADMIN}/import", params={"dry_run": "false"})).json()
    assert (again["created"], again["updated"], again["unchanged"]) == (0, 0, 2)
    assert len(await world.rows()) == 2
    # upstream changes both texts; one row was checked by the team in the meantime
    async with world.sessions() as session:
        await session.execute(
            text("UPDATE songs SET english_meaning = 'Changed words.' WHERE number = 1")
        )
        await session.execute(
            text("UPDATE songs SET english_meaning = 'Changed again.' WHERE number = 2")
        )
        await session.commit()
    checked = (await world.rows(song_id=2))[0]
    assert (
        await world.client.post(f"{ADMIN}/{checked.id}/verify", json={"reviewer": "Dada"})
    ).status_code == 200
    changed = (await world.client.post(f"{ADMIN}/import", params={"dry_run": "false"})).json()
    assert (changed["updated"], changed["skipped_team_edited"], changed["unchanged"]) == (1, 1, 0)
    texts = {r.song_id: r.plain_text for r in await world.rows()}
    assert texts == {1: "Changed words.", 2: "Other words."}
    # the import only reads songs.english_meaning
    async with world.sessions() as session:
        meaning = await session.scalar(text("SELECT english_meaning FROM songs WHERE number = 2"))
    assert meaning == "Changed again."


# --------------------------------------------------------------------------- migration 0052


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    yield engine
    engine.dispose()


def test_0052_follows_0051_and_the_chain_has_one_head() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    revision = script.get_revision("0052_song_translations")
    assert revision is not None
    assert revision.down_revision == "0051_push_replies"
    assert len(script.get_heads()) == 1


def _insert(engine: sa.Engine, **fields: Any) -> None:
    values: dict[str, Any] = {
        "id": "a" * 32,
        "song_id": 1,
        "kind": "official",
        "segments": "[]",
        "plain_text": "t",
        "text_hash": "h",
        "author_kind": "official",
        "source_key": "k",
        "trust": "official",
        "status": "published",
    }
    values.update(fields)
    columns = ", ".join(values)
    marks = ", ".join(f":{name}" for name in values)
    with engine.begin() as connection:
        connection.execute(
            sa.text(f"INSERT INTO song_translations ({columns}) VALUES ({marks})"), values
        )


def test_upgrade_creates_the_table_twice_is_harmless_and_downgrade_drops_it(
    engine: sa.Engine,
) -> None:
    migration = load("0052_song_translations")
    run(engine, migration.upgrade)
    run(engine, migration.upgrade)
    inspector = sa.inspect(engine)
    assert inspector.has_table("song_translations")
    columns = {c["name"] for c in inspector.get_columns("song_translations")}
    assert {
        "song_id",
        "kind",
        "segments",
        "trust",
        "commentary",
        "verified_by",
        "text_hash",
    } <= columns
    run(engine, migration.downgrade)
    assert not sa.inspect(engine).has_table("song_translations")
    run(engine, migration.downgrade)


@pytest.mark.parametrize(
    "fields",
    [
        {"kind": "literal", "trust": "machine", "author_kind": "team"},
        {"kind": "official", "trust": "machine", "author_kind": "team"},
        {"kind": "poetic", "trust": "verified", "author_kind": "team"},
        {"kind": "official", "trust": "official", "author_kind": "team"},
        {"kind": "poetic", "trust": "reviewed", "author_kind": "team", "song_id": 5019},
    ],
)
def test_the_migrated_table_refuses_what_must_never_exist(
    engine: sa.Engine, fields: dict[str, Any]
) -> None:
    run(engine, load("0052_song_translations").upgrade)
    with pytest.raises(IntegrityError):
        _insert(engine, **fields)
    # the same row that is allowed goes in
    _insert(engine)
    _insert(
        engine,
        id="b" * 32,
        kind="poetic",
        trust="machine",
        author_kind="team",
        source_ref="x",
    )
