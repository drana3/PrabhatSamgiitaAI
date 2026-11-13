"""The three layers of the duplicate check (title, duration, sound) and what a person may be shown.
Pins docs/duplicate-check.md. Fixtures come from test_recordings.py; its fake `fpcalc` gives every
file the same length (123 s), which is what makes "same length" testable here.
"""

# ruff: noqa: F811
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from sqlalchemy import select, update
from test_recording_sets import AS_B
from test_recordings import MEMBER_A, World, mp3, world  # noqa: F401

from app.models.recordings import Recording
from app.services.recording_matches import (
    DURATION,
    SOUND,
    TITLE,
    duration_window,
    durations_close,
    is_offered,
    titles_close,
)
from app.services.recordings import title_key


def test_titles_close_ignores_case_accents_and_punctuation_but_not_numbers() -> None:
    assert titles_close(title_key("Bábá Nám Kevalam"), title_key("baba-nam kevalam!"))
    assert titles_close(title_key("Morning Kiirtan"), title_key("Mornin Kiirtan"))  # one letter
    assert not titles_close(title_key("Morning Kiirtan 1"), title_key("Morning Kiirtan 2"))
    assert not titles_close(title_key("Morning Kiirtan"), title_key("Evening Kiirtan"))
    assert not titles_close("", "") and not titles_close("abc", "")
    assert not titles_close(title_key("Om"), title_key("Omm"))  # too short to call near


def test_durations_close_within_two_seconds_or_one_percent() -> None:
    assert duration_window(100) == (98, 102)
    assert duration_window(1000) == (990, 1010)
    assert durations_close(300, 303) and not durations_close(300, 310)
    assert durations_close(3600, 3630) and not durations_close(3600, 3650)
    assert not durations_close(None, 5) and not durations_close(0, 0)


def test_one_layer_of_title_or_duration_offers_nothing_but_sound_alone_does() -> None:
    assert not is_offered({TITLE}) and not is_offered({DURATION})
    assert is_offered({TITLE, DURATION}) and is_offered({SOUND})


async def test_same_title_and_same_length_is_offered_with_its_reasons(world: World) -> None:
    first = (await world.publish("a", mp3(3000), title="Evening Chant")).json()
    key = await world.upload("b", mp3(3001))
    ask = await world.client.post(
        "/api/v1/recordings", headers=AS_B, json=world.body(key, title="evening chant!")
    )
    assert ask.status_code == 409
    detail = ask.json()["detail"]
    assert detail["code"] == "similar_recording"
    match = detail["similar"][0]
    assert match["id"] == first["id"]
    assert match["reasons"] == ["duration", "title"]
    assert match["duration_sec"] == 123 and match["audio_url"]
    # "No, mine is different": the same file goes on, and the pair is not asked again.
    again = await world.client.post(
        "/api/v1/recordings",
        headers=AS_B,
        json=world.body(key, title="evening chant!", confirm_different=True),
    )
    assert again.status_code == 201 and again.json()["duplicate_of"] == first["id"]


async def test_the_same_title_with_another_length_is_not_offered(world: World) -> None:
    await world.publish("a", mp3(3010), title="Evening Chant")
    other = await world.publish("b", mp3(3011), title="Evening Chant", duration_sec=400)
    assert other.status_code == 201, other.text


async def test_the_same_length_with_another_title_is_not_offered(world: World) -> None:
    await world.publish("a", mp3(3020), title="Evening Chant")
    other = await world.publish("b", mp3(3021), title="Dawn Chant")
    assert other.status_code == 201


async def test_a_sound_match_names_the_sound_as_its_reason(world: World) -> None:
    await world.publish("a", mp3(3030, b"NOISE=0;"), title="Original take")
    ask = await world.publish("b", mp3(3030, b"NOISE=4;"), title="Totally different name")
    assert ask.status_code == 409
    assert ask.json()["detail"]["similar"][0]["reasons"] == ["sound"]


async def test_a_removed_recording_is_never_offered(world: World) -> None:
    first = (await world.publish("a", mp3(3040), title="Evening Chant")).json()
    async with world.sessions() as session:
        await session.execute(
            update(Recording).where(Recording.title == first["title"]).values(status="removed")
        )
        await session.commit()
    again = await world.publish("b", mp3(3041), title="Evening Chant")
    assert again.status_code == 201


async def test_a_recording_of_a_blocked_author_is_not_offered(world: World) -> None:
    await world.publish("a", mp3(3050), title="Evening Chant")
    blocked = await world.client.post(
        "/api/v1/recordings/blocks", headers=AS_B, json={"author_id": str(MEMBER_A)}
    )
    assert blocked.status_code == 201
    again = await world.publish("b", mp3(3051), title="Evening Chant")
    assert again.status_code == 201


async def test_an_exact_copy_is_still_a_hard_stop_and_names_the_length(world: World) -> None:
    data = mp3(3060)
    first = (await world.publish("a", data, title="Evening Chant")).json()
    same = await world.publish("b", data, title="Anything")
    assert same.status_code == 409
    detail = same.json()["detail"]
    assert detail["code"] == "duplicate" and detail["duplicate_of"]["id"] == first["id"]
    assert detail["duplicate_of"]["duration_sec"] == 123


async def test_every_category_gets_the_check(world: World) -> None:
    await world.publish("a", mp3(3070), kind="bhajan", language="hi", style=None, title="Tumi Amar")
    ask = await world.publish(
        "b", mp3(3071), kind="bhajan", language="hi", style=None, title="Tumi Amar"
    )
    assert ask.status_code == 409 and ask.json()["detail"]["code"] == "similar_recording"
    dance = await world.publish(
        "a", mp3(3072), kind="dance_song", dance="tandava", style=None, title="Fire Dance"
    )
    assert dance.status_code == 201
    dance_again = await world.publish(
        "b", mp3(3073), kind="dance_song", dance="tandava", style=None, title="Fire Dance"
    )
    assert dance_again.status_code == 409


async def test_without_a_length_only_the_sound_layer_can_offer(world: World) -> None:
    world.settings.recording_fpcalc_path = "definitely-not-installed"
    await world.publish("a", mp3(3080), title="Evening Chant")
    again = await world.publish("b", mp3(3081), title="Evening Chant")
    # no fpcalc: no length, no sound, only a title: nothing is claimed
    assert again.status_code == 201
    rows = (await world.scalar(select(Recording.id).limit(1))) is not None
    assert rows
