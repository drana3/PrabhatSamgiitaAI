"""Piano as the third instrument of a chord chart, and the kinds that take no chords at all
(Dance music, Baba's Audio Discourses). docs/chord-instruments.md.

In-memory SQLite. What PostgreSQL does with the CHECK change of migration 0063 is NOT covered here
(try it on a copy of the real database before the deploy)."""

from __future__ import annotations

from uuid import UUID

import pytest
from pydantic import ValidationError

from app.models.recordings import Recording
from app.models.song_chords import SongChordProposal
from app.schemas.song_chords import ChordProposalCreate
from tests.extras_support import MEMBER_A, REC, World, recording
from tests.extras_support import world_fixture as world_fixture  # noqa: F401
from tests.test_kiirtan_cycle import payload as cycle_payload
from tests.test_recording_chord_charts import BHAJAN, SPIRITUAL, chart_payload, make_recordings
from tests.test_song_chords import chart_body

URL = "/api/v1/recording-chords"
DANCE = UUID("5555555a-5555-5555-5555-55555555555b")
TALK = UUID("6666666a-6666-6666-6666-66666666666b")


async def make_no_chord_recordings(world: World) -> None:
    async with world.sessions() as session:
        for rec_id, kind, language, dance in (
            (DANCE, "dance_song", None, "tandava"),
            (TALK, "baba_audio", "en", None),
        ):
            row: Recording = recording(rec_id, f"A {kind}")
            row.kind, row.type, row.language, row.dance = kind, "other", language, dance
            row.audio_sha256 = rec_id.hex * 2
            session.add(row)
            await session.commit()


# --------------------------------------------------------------------------- piano


async def test_a_piano_chart_over_the_words_is_kept_with_its_instrument(world: World) -> None:
    await make_recordings(world)
    for rec in (BHAJAN, SPIRITUAL):
        sent = await world.call(
            "POST", f"{URL}/recordings/{rec}", "a", json=chart_payload(instrument="piano")
        )
        assert sent.status_code == 201, sent.text
        assert sent.json()["instrument"] == "piano"
    listed = await world.call("GET", f"{URL}/recordings/{BHAJAN}", "a")
    assert [i["instrument"] for i in listed.json()["items"]] == ["piano"]


async def test_piano_has_no_capo_and_no_strum_pattern(world: World) -> None:
    await make_recordings(world)
    for extra in ({"capo": 2}, {"strum": "D U D U"}):
        response = await world.call(
            "POST",
            f"{URL}/recordings/{BHAJAN}",
            "a",
            json=chart_payload(instrument="piano", **extra),
        )
        assert response.status_code == 422, extra


async def test_a_piano_sheet_and_a_piano_cycle_of_a_kiirtan(world: World) -> None:
    plain = await world.call(
        "POST",
        f"{URL}/recordings/{REC}",
        "a",
        json={"instrument": "piano", "body": "Am  G\nBaba Nam", "played_it": True},
    )
    assert plain.status_code == 201, plain.text
    cycle = await world.call(
        "POST",
        f"{URL}/recordings/{REC}",
        "a",
        json=cycle_payload(instrument="piano"),
    )
    assert cycle.status_code == 201, cycle.text
    capo = await world.call(
        "POST",
        f"{URL}/recordings/{REC}",
        "a",
        json=cycle_payload(instrument="piano", capo=2),
    )
    assert capo.status_code == 422


async def test_an_unknown_instrument_is_still_refused(world: World) -> None:
    await make_recordings(world)
    response = await world.call(
        "POST",
        f"{URL}/recordings/{BHAJAN}",
        "a",
        json=chart_payload(instrument="sitar"),
    )
    assert response.status_code == 422


def test_a_prabhat_samgiita_chart_takes_a_piano_too() -> None:
    parsed = ChordProposalCreate.model_validate(chart_body(instrument="piano", capo=0, strum=None))
    assert parsed.instrument == "piano"
    for extra in ({"capo": 2, "strum": None}, {"capo": 0, "strum": "D U"}):
        with pytest.raises(ValidationError):
            ChordProposalCreate.model_validate(chart_body(instrument="piano", **extra))


async def test_the_song_chord_table_keeps_a_piano_row(world: World) -> None:
    async with world.sessions() as session:
        session.add(
            SongChordProposal(
                song_id=19,
                member_id=MEMBER_A,
                instrument="piano",
                base_key="D",
                capo=0,
                chart={"lines": [{"placements": [{"word": 0, "chord": "D"}]}]},
                placements_count=1,
                played_it=True,
                status="published",
            )
        )
        await session.commit()
    rows = await world.rows(SongChordProposal)
    assert [r.instrument for r in rows] == ["piano"]


# --------------------------------------------------------------------------- no chords at all


@pytest.mark.parametrize("rec", [DANCE, TALK])
async def test_dance_music_and_discourses_take_no_chords_of_any_shape(
    world: World, rec: UUID
) -> None:
    await make_no_chord_recordings(world)
    plain = {"instrument": "guitar", "body": "Am  G\nBaba Nam", "played_it": True}
    for body in (plain, chart_payload(), cycle_payload()):
        response = await world.call("POST", f"{URL}/recordings/{rec}", "a", json=body)
        assert response.status_code == 422, body
        assert "no chords" in response.json()["detail"]
