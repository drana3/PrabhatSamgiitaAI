"""Dance music and Baba's Audio Discourses take no piano notes either (same rule as chords)."""

from __future__ import annotations

from uuid import UUID

import pytest

from app.models.recordings import Recording
from tests.extras_support import World, recording
from tests.piano_support import world_fixture as world_fixture  # noqa: F401
from tests.test_piano_sheets import URL, sheet

DANCE = UUID("5555555a-5555-5555-5555-55555555555b")
TALK = UUID("6666666a-6666-6666-6666-66666666666b")


@pytest.mark.parametrize(("rec", "kind"), [(DANCE, "dance_song"), (TALK, "baba_audio")])
async def test_no_notes_for_dance_music_or_a_discourse(world: World, rec: UUID, kind: str) -> None:
    async with world.sessions() as session:
        row: Recording = recording(rec, f"A {kind}")
        row.kind, row.type = kind, "other"
        row.language = "en" if kind == "baba_audio" else None
        row.dance = "tandava" if kind == "dance_song" else None
        row.audio_sha256 = rec.hex * 2
        session.add(row)
        await session.commit()
    response = await world.call("POST", f"{URL}/recordings/{rec}", "a", json=sheet())
    assert response.status_code == 422
    assert "no notes" in response.json()["detail"]
