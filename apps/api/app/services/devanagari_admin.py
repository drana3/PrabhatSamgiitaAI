"""Shared helpers so admin Devanagari review always shows current text.

Production DB may lag behind packaged ``songs.json`` after catalogue import.
Admin load (web + mobile) and optional lazy hydrate fill missing Devanagari
from the catalogue so editors see Roman + editable Devanagari together.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Song
from app.schemas.admin import AdminDevanagariSong
from app.services.catalog import songs_by_number


def catalog_devanagari(number: int) -> tuple[str | None, str]:
    seeded = songs_by_number().get(number)
    if seeded is None:
        return None, "none"
    text = (getattr(seeded, "lyrics_devanagari", None) or "").strip() or None
    status = (getattr(seeded, "devanagari_status", None) or "none").strip() or "none"
    return text, status


def catalog_roman(number: int) -> str:
    seeded = songs_by_number().get(number)
    if seeded is None:
        return ""
    return (
        (seeded.lyrics_original or seeded.transliteration or "").strip()
    )


async def ensure_song_devanagari_loaded(
    session: AsyncSession, song: Song, *, persist: bool = True
) -> Song:
    """If DB Devanagari is empty, fill from packaged catalogue (optionally persist)."""
    if (song.lyrics_devanagari or "").strip():
        return song
    text, status = catalog_devanagari(song.number)
    if not text:
        return song
    song.lyrics_devanagari = text
    if (song.devanagari_status or "none") == "none":
        song.devanagari_status = status if status != "none" else "provisional"
    if persist:
        await session.commit()
        await session.refresh(song)
    return song


def admin_devanagari_payload(song: Song) -> AdminDevanagariSong:
    roman = (song.lyrics_original or song.transliteration or "").strip()
    if not roman:
        roman = catalog_roman(song.number)
    dev = (song.lyrics_devanagari or "").strip()
    status = (song.devanagari_status or "none").strip() or "none"
    if not dev:
        cat_dev, cat_status = catalog_devanagari(song.number)
        if cat_dev:
            dev = cat_dev
            if status == "none":
                status = cat_status if cat_status != "none" else "provisional"
    return AdminDevanagariSong(
        song_number=song.number,
        title=song.title,
        lyrics_original=roman or None,
        lyrics_devanagari=dev or None,
        devanagari_status=status,
        line_count_roman=len(roman.split("\n")) if roman else 0,
        line_count_devanagari=len(dev.split("\n")) if dev else 0,
    )
