"""Migration 0034 (comments, chord sheets and video links around recordings).

Run on SQLite with Alembic's own operations, on top of the parent tables made from the current
models. What a real PostgreSQL does is NOT covered here: check it on a copy of the database before
the deploy (docs/recording-extras.md).
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from types import ModuleType
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory
from test_recording_duplicates_migration import VERSIONS, load, run

from app.models import Base, UserAccount
from app.models.recording_collections import RecordingCollection
from app.models.recording_extras import (
    RecordingChordReport,
    RecordingChordSheet,
    RecordingComment,
    RecordingCommentReport,
    VideoLink,
    VideoLinkReport,
)
from app.models.recordings import Recording

NEW_TABLES = (
    "recording_comments",
    "recording_comment_reports",
    "recording_chord_sheets",
    "recording_chord_reports",
    "video_links",
    "video_link_reports",
)
MODELS = (
    RecordingComment,
    RecordingCommentReport,
    RecordingChordSheet,
    RecordingChordReport,
    VideoLink,
    VideoLinkReport,
)


@pytest.fixture
def m34() -> ModuleType:
    return load("0034_recording_extras")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    parents = [m.__table__ for m in (UserAccount, RecordingCollection, Recording)]
    Base.metadata.create_all(engine, tables=parents)  # type: ignore[arg-type]
    yield engine
    engine.dispose()


def ids(engine: sa.Engine) -> tuple[str, str]:
    """A member and a recording to hang rows on (hex ids with a letter: SQLite reads all-digit
    ones back as numbers)."""
    member, recording = "a" + uuid4().hex[1:], "b" + uuid4().hex[1:]
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "INSERT INTO user_accounts (id, external_subject, identity_provider, "
                "display_name, is_admin, last_seen_at, created_at, updated_at) VALUES "
                "(:i, 'x', 'test', 'X', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, "
                "CURRENT_TIMESTAMP)"
            ),
            {"i": member},
        )
        connection.execute(
            sa.text(
                "INSERT INTO recordings (id, kind, type, title, author, added_by, status, "
                "audio_key, audio_url, audio_sha256, created_at, updated_at, plays, reports_count,"
                " by_author) VALUES (:i, 'kiirtan', 'bnk', 'T', 'A', 'A', 'published', 'k', 'u', "
                "'s', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, 0)"
            ),
            {"i": recording},
        )
    return member, recording


def test_0034_follows_the_real_head_of_the_chain(m34: ModuleType) -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0034_recording_extras")
    assert revision is not None and revision.down_revision == "0033_author_profiles"
    assert m34.revision == "0034_recording_extras"


def test_upgrade_adds_the_six_tables_and_nothing_else(engine: sa.Engine, m34: ModuleType) -> None:
    before = {
        name: [c["name"] for c in sa.inspect(engine).get_columns(name)]
        for name in ("recordings", "user_accounts")
    }
    run(engine, m34.upgrade)
    inspector = sa.inspect(engine)
    for name in NEW_TABLES:
        assert inspector.has_table(name), name
    for name, columns in before.items():
        assert [c["name"] for c in inspector.get_columns(name)] == columns
    indexes = {i["name"] for i in inspector.get_indexes("video_links")}
    assert "uq_video_links_live" in indexes


def test_the_tables_match_the_models(engine: sa.Engine, m34: ModuleType) -> None:
    run(engine, m34.upgrade)
    run(engine, load("0037_comment_replies").upgrade)  # the reply columns of the comment model
    run(engine, load("0047_recording_chord_charts").upgrade)  # the chart columns of the sheet model
    inspector = sa.inspect(engine)
    for model in MODELS:
        table = model.__table__
        columns = {c["name"] for c in inspector.get_columns(table.name)}
        assert columns == {c.name for c in table.columns}, table.name
        made = {i["name"] for i in inspector.get_indexes(table.name)}
        wanted = {i.name for i in table.indexes}
        assert wanted <= made, (table.name, wanted - made)


def test_running_it_twice_changes_nothing(engine: sa.Engine, m34: ModuleType) -> None:
    run(engine, m34.upgrade)
    member, recording = ids(engine)
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "INSERT INTO recording_comments (id, recording_id, member_id, body, status, "
                "is_anonymous, reports_count, created_at, updated_at) VALUES "
                "('c" + "0" * 31 + "', :r, :m, 'hello', 'published', 0, 0, CURRENT_TIMESTAMP, "
                "CURRENT_TIMESTAMP)"
            ),
            {"r": recording, "m": member},
        )
    run(engine, m34.upgrade)
    inspector = sa.inspect(engine)
    for name in NEW_TABLES:
        names = [i["name"] for i in inspector.get_indexes(name)]
        assert len(names) == len(set(names)), name
    with engine.connect() as connection:
        assert connection.execute(sa.text("SELECT COUNT(*) FROM recording_comments")).scalar() == 1


def test_it_is_a_no_op_on_a_database_made_from_the_current_models(
    engine: sa.Engine, m34: ModuleType
) -> None:
    """The app runs create_all at start: a fresh database already has everything."""
    Base.metadata.create_all(engine, tables=[m.__table__ for m in MODELS])  # type: ignore[arg-type]
    run(engine, m34.upgrade)
    run(engine, m34.upgrade)
    inspector = sa.inspect(engine)
    for name in NEW_TABLES:
        assert inspector.has_table(name)


def test_one_live_video_per_target_in_the_database(engine: sa.Engine, m34: ModuleType) -> None:
    run(engine, m34.upgrade)
    member, recording = ids(engine)

    def video(status: str, external: str = "dQw4w9WgXcQ") -> None:
        with engine.begin() as connection:
            connection.execute(
                sa.text(
                    "INSERT INTO video_links (id, recording_id, target_key, member_id, provider, "
                    "external_id, url, is_anonymous, status, reports_count, created_at, updated_at)"
                    " VALUES (:id, :r, :t, :m, 'youtube', :e, 'u', 0, :s, 0, CURRENT_TIMESTAMP, "
                    "CURRENT_TIMESTAMP)"
                ),
                {
                    "id": "d" + uuid4().hex[1:],
                    "r": recording,
                    "t": f"recording:{recording}",
                    "m": member,
                    "e": external,
                    "s": status,
                },
            )

    video("published")
    video("removed")  # a removed one does not block
    video("removed")
    video("published", "other-video")
    with pytest.raises(sa.exc.IntegrityError):
        video("published")


def test_a_video_has_exactly_one_target(engine: sa.Engine, m34: ModuleType) -> None:
    run(engine, m34.upgrade)
    member, recording = ids(engine)

    def video(recording_id: str | None, song_id: int | None) -> None:
        with engine.begin() as connection:
            connection.execute(
                sa.text(
                    "INSERT INTO video_links (id, recording_id, song_id, target_key, member_id, "
                    "provider, external_id, url, is_anonymous, status, reports_count, created_at, "
                    "updated_at) VALUES (:id, :r, :s, :t, :m, 'youtube', :e, 'u', 0, 'published', "
                    "0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                ),
                {
                    "id": "d" + uuid4().hex[1:],
                    "r": recording_id,
                    "s": song_id,
                    "t": f"x:{uuid4().hex}",
                    "m": member,
                    "e": uuid4().hex[:11],
                },
            )

    video(recording, None)
    video(None, 19)
    with pytest.raises(sa.exc.IntegrityError):
        video(None, None)
    with pytest.raises(sa.exc.IntegrityError):
        video(recording, 19)


def test_downgrade_drops_only_the_new_tables_and_upgrade_comes_back(
    engine: sa.Engine, m34: ModuleType
) -> None:
    run(engine, m34.upgrade)
    run(engine, m34.downgrade)
    inspector = sa.inspect(engine)
    for name in NEW_TABLES:
        assert not inspector.has_table(name), name
    assert inspector.has_table("recordings") and inspector.has_table("user_accounts")
    run(engine, m34.downgrade)  # twice is fine
    run(engine, m34.upgrade)
    assert sa.inspect(engine).has_table("video_links")
