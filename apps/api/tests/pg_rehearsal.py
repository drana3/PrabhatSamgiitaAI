"""Run the existing test suite on a real PostgreSQL instead of SQLite (docs/launch-readiness.md).

Not part of the normal run. Every test builds its own throw-away SQLite database
(`create_async_engine("sqlite+aiosqlite://")`, `sa.create_engine("sqlite://")`). This plugin
swaps those calls: the test gets a fresh, empty PostgreSQL **schema** instead, so tests stay
isolated and none of the test files has to change. The session time zone is UTC, like Neon's.

    PG_REHEARSAL_URL=postgresql+psycopg://user:pw@host/db \
    PYTHONPATH=tests .venv/bin/python -m pytest -p pg_rehearsal -q

The database named by `PG_REHEARSAL_URL` must be a scratch one: the plugin creates `rehearsal_*`
schemas and drops them again when the session ends. It refuses to start unless the database name
contains "rehearsal" or "scratch", so it cannot be pointed at a real server by accident.

Failures that appear only here are the interesting ones: types, JSON, booleans, LIKE case,
ordering, default values. Tests that deliberately check SQLite behaviour (the migration tests that
use Alembic's batch mode, raw SQLite DDL, `PRAGMA`) are expected to fail too;
docs/launch-readiness.md lists them.
"""

from __future__ import annotations

import os
import uuid
from typing import Any

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import make_url
from sqlalchemy.ext import asyncio as sa_asyncio

_URL = os.environ.get("PG_REHEARSAL_URL", "")
_SCHEMAS: list[str] = []
_ORIGINAL_SYNC = sa.create_engine
_ORIGINAL_ASYNC = sa_asyncio.create_async_engine
_ORIGINAL_CREATE_ALL = sa.MetaData.create_all


def _create_all_with_parents(self: sa.MetaData, bind: Any, tables: Any = None, **kw: Any) -> None:
    """SQLite lets a test create `recordings` without the table its foreign key points at;
    PostgreSQL does not. Add the parent tables so that is not reported as a failure."""
    if tables is not None:
        wanted: dict[str, sa.Table] = {}
        stack = list(tables)
        while stack:
            table = stack.pop()
            if table.key in wanted:
                continue
            wanted[table.key] = table
            stack.extend(fk.column.table for fk in table.foreign_keys)
        tables = list(wanted.values())
    _ORIGINAL_CREATE_ALL(self, bind, tables=tables, **kw)


def _new_schema() -> str:
    name = f"rehearsal_{uuid.uuid4().hex[:12]}"
    admin = _ORIGINAL_SYNC(_URL, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(sa.text(f'CREATE SCHEMA "{name}"'))
    admin.dispose()
    _SCHEMAS.append(name)
    return name


def _is_sqlite(url: Any) -> bool:
    return str(url).startswith("sqlite")


def _patched_sync(url: Any, *args: Any, **kwargs: Any) -> Any:
    if not _is_sqlite(url):
        return _ORIGINAL_SYNC(url, *args, **kwargs)
    schema = _new_schema()
    kwargs.pop("poolclass", None)
    kwargs.pop("connect_args", None)
    return _ORIGINAL_SYNC(
        _URL,
        poolclass=sa.pool.NullPool,
        connect_args={"options": f"-c search_path={schema} -c timezone=UTC"},
    )


def _patched_async(url: Any, *args: Any, **kwargs: Any) -> Any:
    if not _is_sqlite(url):
        return _ORIGINAL_ASYNC(url, *args, **kwargs)
    schema = _new_schema()
    kwargs.pop("poolclass", None)
    kwargs.pop("connect_args", None)
    return _ORIGINAL_ASYNC(
        _URL,
        poolclass=sa.pool.NullPool,
        connect_args={"options": f"-c search_path={schema} -c timezone=UTC"},
    )


def _assert_scratch_database() -> None:
    name = (make_url(_URL).database or "").lower()
    if "rehearsal" not in name and "scratch" not in name:
        raise pytest.UsageError(
            "PG_REHEARSAL_URL must name a scratch database (its name has to contain "
            '"rehearsal" or "scratch"): this plugin creates and drops schemas.'
        )


def pytest_configure(config: pytest.Config) -> None:
    if not _URL:
        raise pytest.UsageError("Set PG_REHEARSAL_URL to a scratch PostgreSQL database.")
    _assert_scratch_database()
    sa.create_engine = _patched_sync  # type: ignore[assignment]
    sa.MetaData.create_all = _create_all_with_parents  # type: ignore[method-assign,assignment]
    sa_asyncio.create_async_engine = _patched_async  # type: ignore[assignment]


def pytest_unconfigure(config: pytest.Config) -> None:
    sa.create_engine = _ORIGINAL_SYNC  # type: ignore[assignment]
    sa.MetaData.create_all = _ORIGINAL_CREATE_ALL  # type: ignore[method-assign]
    sa_asyncio.create_async_engine = _ORIGINAL_ASYNC  # type: ignore[assignment]
    if not _URL or not _SCHEMAS:
        return
    admin = _ORIGINAL_SYNC(_URL, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        for name in _SCHEMAS:
            connection.execute(sa.text(f'DROP SCHEMA IF EXISTS "{name}" CASCADE'))
    admin.dispose()
