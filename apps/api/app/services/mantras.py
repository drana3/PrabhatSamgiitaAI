"""Mantra groups: many performances of one chant are versions, not duplicates.

A recording has a mantra title, free text typed by the uploader (the app suggests titles that are
already in the library, nothing is hard-coded here). The server turns it into a normalised KEY and
keeps one `MantraGroup` per key and kind. "Baba Nam Kevalam", "Bábá Nám Kevalam" and
"baba-nam-kevalam" all give the key `babanamkevalam`, so they fall into one group.

Design: docs/kiirtan-publishing.md, section "Duplicates".
"""

from __future__ import annotations

import unicodedata
from collections.abc import Sequence
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import and_, case, func, or_, select, update
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recordings import MantraGroup, Recording

VISIBLE = ("published", "flagged")
KEY_LIMIT = 200
TITLE_LIMIT = 200


def mantra_key(text: str | None) -> str:
    """Lower case, Latin diacritics removed, everything but letters and digits dropped.

    Other scripts (Devanagari, Cyrillic, ...) keep their letters and combining marks, only the
    case and the punctuation go. The bulk import script and the migration use this same rule.
    """
    if not text:
        return ""
    kept: list[str] = []
    for char in unicodedata.normalize("NFKD", text).casefold():
        category = unicodedata.category(char)
        if category == "Mn" and kept and ord(kept[-1]) < 0x250 and kept[-1].isalpha():
            continue  # an accent on a Latin letter
        if category[0] in ("L", "N", "M"):
            kept.append(char)
    return unicodedata.normalize("NFC", "".join(kept))[:KEY_LIMIT]


def clean_mantra(text: str | None) -> str:
    """The title as shown: whitespace collapsed, cut to the column size."""
    return " ".join((text or "").split())[:TITLE_LIMIT]


def _insert_ignoring_conflict(session: AsyncSession, values: dict[str, Any]) -> Any:
    """`INSERT ... ON CONFLICT DO NOTHING` on (kind, key); Postgres and SQLite."""
    dialect = session.get_bind().dialect.name
    if dialect == "postgresql":
        return (
            postgresql.insert(MantraGroup)
            .values(**values)
            .on_conflict_do_nothing(index_elements=["kind", "key"])
        )
    return (
        sqlite.insert(MantraGroup)
        .values(**values)
        .on_conflict_do_nothing(index_elements=["kind", "key"])
    )


async def resolve_group(session: AsyncSession, group: MantraGroup) -> MantraGroup:
    """Follow `merged_into_id` to the group that is alive (a merge leaves an alias behind)."""
    seen = {group.id}
    current = group
    while current.merged_into_id is not None and current.merged_into_id not in seen:
        nxt = await session.get(MantraGroup, current.merged_into_id)
        if nxt is None:
            break
        seen.add(nxt.id)
        current = nxt
    return current


async def find_group(session: AsyncSession, kind: str, title: str | None) -> MantraGroup | None:
    key = mantra_key(title)
    if not key:
        return None
    found = await session.scalar(
        select(MantraGroup).where(MantraGroup.kind == kind, MantraGroup.key == key)
    )
    return await resolve_group(session, found) if found else None


async def get_or_create_group(
    session: AsyncSession, kind: str, title: str | None
) -> MantraGroup | None:
    """The group of this mantra title, created when it is new. None when the title has no letters.

    Two uploads of a new mantra at the same moment both end up in one group: the insert ignores a
    conflict on (kind, key) and the row is read back.
    """
    shown = clean_mantra(title)
    key = mantra_key(shown)
    if not key:
        return None
    group = await find_group(session, kind, shown)
    if group is not None:
        return group
    await session.execute(
        _insert_ignoring_conflict(
            session, {"id": uuid4(), "kind": kind, "key": key, "title": shown}
        )
    )
    group = await find_group(session, kind, shown)
    if group is None:  # cannot happen unless the row was deleted in between
        raise HTTPException(status_code=503, detail="Could not store the mantra. Try again.")
    return group


# --------------------------------------------------------------------------- reading


async def count_versions(session: AsyncSession, group_id: UUID) -> int:
    total = await session.scalar(
        select(func.count())
        .select_from(Recording)
        .where(Recording.mantra_group_id == group_id, Recording.status.in_(VISIBLE))
    )
    return int(total or 0)


def _visible_join() -> Any:
    return and_(Recording.mantra_group_id == MantraGroup.id, Recording.status.in_(VISIBLE))


async def list_groups(
    session: AsyncSession,
    *,
    kind: str | None,
    query: str | None,
    limit: int,
    offset: int,
) -> tuple[list[tuple[MantraGroup, int, int]], int]:
    """Live groups with a visible version: (group, versions, plays), most versions first."""
    conditions: list[Any] = [MantraGroup.merged_into_id.is_(None)]
    if kind:
        conditions.append(MantraGroup.kind == kind)
    needle = mantra_key(query)
    if needle:
        conditions.append(MantraGroup.key.like(f"%{needle}%"))
    versions = func.count(Recording.id)
    plays = func.coalesce(func.sum(Recording.plays), 0)
    base = (
        select(MantraGroup, versions, plays)
        .join(Recording, _visible_join())
        .where(*conditions)
        .group_by(MantraGroup.id)
    )
    total = await session.scalar(select(func.count()).select_from(base.subquery()))
    rows = (
        await session.execute(
            base.order_by(versions.desc(), MantraGroup.title.asc()).limit(limit).offset(offset)
        )
    ).all()
    return [(row[0], int(row[1]), int(row[2] or 0)) for row in rows], int(total or 0)


async def suggest(
    session: AsyncSession, *, kind: str | None, query: str | None, limit: int
) -> list[tuple[MantraGroup, int]]:
    """Autocomplete: groups already in the library whose key contains the typed text.

    Groups that START with the text come first, then the ones with more versions.
    """
    needle = mantra_key(query)
    conditions: list[Any] = [MantraGroup.merged_into_id.is_(None)]
    if kind:
        conditions.append(MantraGroup.kind == kind)
    versions = func.count(Recording.id)
    order: list[Any] = []
    if needle:
        conditions.append(MantraGroup.key.like(f"%{needle}%"))
        order.append(case((MantraGroup.key.like(f"{needle}%"), 0), else_=1))
    rows = (
        await session.execute(
            select(MantraGroup, versions)
            .join(Recording, _visible_join())
            .where(*conditions)
            .group_by(MantraGroup.id)
            .order_by(*order, versions.desc(), MantraGroup.title.asc())
            .limit(limit)
        )
    ).all()
    return [(row[0], int(row[1])) for row in rows]


async def list_versions(
    session: AsyncSession,
    group: MantraGroup,
    *,
    blocked: Sequence[UUID],
    sort: str,
    limit: int,
    offset: int,
) -> tuple[list[Recording], int]:
    conditions: list[Any] = [Recording.mantra_group_id == group.id, Recording.status.in_(VISIBLE)]
    if blocked:
        conditions.append(or_(Recording.author_id.is_(None), Recording.author_id.not_in(blocked)))
    total = await session.scalar(select(func.count()).select_from(Recording).where(*conditions))
    newest = (Recording.published_at.desc().nulls_last(), Recording.created_at.desc())
    order = (Recording.plays.desc(), *newest) if sort == "plays" else newest
    rows = (
        await session.scalars(
            select(Recording).where(*conditions).order_by(*order).limit(limit).offset(offset)
        )
    ).all()
    return list(rows), int(total or 0)


# --------------------------------------------------------------------------- admin


async def merge_groups(
    session: AsyncSession, *, source_id: UUID, target_id: UUID, title: str | None = None
) -> MantraGroup:
    """Move every recording of `source` to `target`; `source` stays as an alias of `target`.

    Two spellings that the key rule cannot join ("Kiirtan" and "Kirtan") are joined by hand here.
    """
    if source_id == target_id:
        raise HTTPException(status_code=422, detail="Choose two different mantras.")
    source = await session.get(MantraGroup, source_id)
    target = await session.get(MantraGroup, target_id)
    if source is None or target is None:
        raise HTTPException(status_code=404, detail="Mantra not found")
    source = await resolve_group(session, source)
    target = await resolve_group(session, target)
    if source.id == target.id:
        raise HTTPException(status_code=409, detail="These mantras are already one.")
    if source.kind != target.kind:
        raise HTTPException(status_code=422, detail="A Kiirtan and a Bhajan cannot be merged.")
    await session.execute(
        update(Recording)
        .where(Recording.mantra_group_id == source.id)
        .values(mantra_group_id=target.id)
    )
    # Groups that were merged into the source earlier now point at the target too.
    await session.execute(
        update(MantraGroup)
        .where(MantraGroup.merged_into_id == source.id)
        .values(merged_into_id=target.id)
    )
    source.merged_into_id = target.id
    cleaned = clean_mantra(title)
    if cleaned:
        target.title = cleaned
    await session.commit()
    await session.refresh(target)
    return target
