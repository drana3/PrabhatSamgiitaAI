"""Things that pass on SQLite and break on PostgreSQL (found in the PostgreSQL rehearsal,
docs/launch-readiness.md). The real check is `tests/pg_rehearsal.py`; these keep the two
mistakes found there from coming back without anyone running it."""

from __future__ import annotations

import importlib.util
import re
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "app"


def test_a_conflicting_insert_is_judged_by_returning_not_by_rowcount() -> None:
    """With psycopg, an ORM `insert(...).on_conflict_do_nothing()` reports rowcount -1 whether
    or not the row went in, so `rowcount == 0` never fires and every repeat is counted again."""
    offenders = []
    for path in APP.rglob("*.py"):
        text = path.read_text()
        if "on_conflict_do_nothing" not in text:
            continue
        for match in re.finditer(r"on_conflict_do_nothing\(", text):
            statement = text[match.start() : match.start() + 400]
            if ".returning(" not in statement:
                offenders.append(
                    f"{path.relative_to(APP)}: on_conflict_do_nothing without returning"
                )
    assert not offenders, offenders


def test_migration_0027_can_start_from_an_empty_database() -> None:
    """0027 builds `recordings` from the model; the model points at `recording_collections`, a table
    only 0032 used to add. On an empty PostgreSQL that failed. The parent must come first."""
    path = APP.parent / "alembic/versions/0027_recordings.py"
    spec = importlib.util.spec_from_file_location("migration_0027", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    names = [model.__tablename__ for model in module.TABLES]
    assert names.index("recording_collections") < names.index("recordings")
