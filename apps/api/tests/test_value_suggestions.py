"""The main (lead) instrument and the team's queue of words under "Add your own".

Pins docs/kiirtan-recording-info.md: the list, the normalization, the three new words a week, what
the author and everyone else see, and what accepting, merging and rejecting do.
"""

# ruff: noqa: F811
from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
from fastapi import HTTPException, Request
from sqlalchemy import select, update
from test_recordings import MEMBER_A, World, mp3, world  # noqa: F401

from app.api.v1.extras_common import get_team_member
from app.models import UserAccount
from app.models.recordings import MemberNotice, Recording, ValueSuggestion, ValueSuggestionUse
from app.services.recording_instruments import (
    ELECTRONIC,
    INSTRUMENTS,
    KINDS_WITH_INSTRUMENT,
    normalize_instrument,
)
from app.services.value_suggestions import (
    NEW_WORDS_PER_WEEK,
    clean_word,
    listed_code,
    normalized_key,
    similar_code,
)

AS_A = {"X-Test-Member": "a"}
AS_B = {"X-Test-Member": "b"}
OPTIONS = "/api/v1/recordings/value-options"
QUEUE = "/api/v1/recordings/value-suggestions"


# --------------------------------------------------------------------------- the list


def test_the_list_is_dadas_starting_list_plus_the_usual_instruments() -> None:
    assert INSTRUMENTS[:3] == ("guitar", "harmonium", "piano")  # the three that were there
    assert set(INSTRUMENTS) == {
        "guitar",
        "harmonium",
        "piano",
        "synthesizer",
        "keyboard",
        "tabla",
        "dholak",
        "khol",
        "kartal",
        "flute",
        "violin",
        "sitar",
        "esraj",
        "bass_guitar",
        "ukulele",
        "voice_only",
    }
    assert set(ELECTRONIC) == {"synthesizer", "keyboard"}
    assert "baba_audio" not in KINDS_WITH_INSTRUMENT  # speech has no instrument
    assert normalize_instrument(" Piano ") == "piano"
    assert normalize_instrument("other") == "other" and normalize_instrument("") is None
    with pytest.raises(ValueError, match="main instrument"):
        normalize_instrument("theremin")


# --------------------------------------------------------------------------- normalization


def test_a_word_is_normalized_without_case_spaces_marks_or_punctuation() -> None:
    assert normalized_key("  Hármonium. ") == "harmonium"
    assert normalized_key("HARMONIUM") == normalized_key("harmonium")
    assert normalized_key("Bass   guitar!") == "bass guitar"
    assert normalized_key("") == "" and normalized_key(None) == ""


def test_a_listed_instrument_typed_as_text_is_the_code() -> None:
    assert listed_code("instrument", "Piano") == "piano"
    assert listed_code("instrument", " bass  guitar") == "bass_guitar"
    assert listed_code("instrument", "Mridangam") == "khol"
    assert listed_code("instrument", "A cappella") == "voice_only"
    assert listed_code("instrument", "theremin") is None
    assert listed_code("style", "Bengali") == "bengali"


def test_a_word_85_percent_like_a_listed_one_is_hinted() -> None:
    assert similar_code("instrument", "harmonyum") == "harmonium"
    assert similar_code("instrument", "Theremin") is None
    assert similar_code("style", "dhrupat") == "dhrupad"


def test_a_written_word_is_2_to_40_characters() -> None:
    assert clean_word("  Dilruba ") == "Dilruba"
    for bad in ("", "x", "y" * 41):
        with pytest.raises(ValueError):
            clean_word(bad)


# --------------------------------------------------------------------------- the field


async def test_a_listed_instrument_is_stored_and_sent_with_the_recording(world: World) -> None:
    made = await world.publish("a", mp3(3000), lead_instrument="piano")
    assert made.status_code == 201, made.text
    assert made.json()["lead_instrument"] == "piano"
    assert made.json()["lead_instrument_other"] is None
    listed = (await world.client.get("/api/v1/recordings")).json()["items"]
    assert [i["lead_instrument"] for i in listed] == ["piano"]
    # it is optional, and only a code of the list is accepted
    none = await world.publish("a", mp3(3001))
    assert none.status_code == 201 and none.json()["lead_instrument"] is None
    wrong = await world.publish("a", mp3(3002), lead_instrument="theremin")
    assert wrong.status_code == 422


async def test_the_instrument_goes_with_every_music_kind_but_not_with_discourses(
    world: World,
) -> None:
    bhajan = await world.publish(
        "a", mp3(3010), kind="bhajan", language="hi", style=None, lead_instrument="harmonium"
    )
    ps = await world.publish(
        "a",
        mp3(3011),
        kind="prabhat_samgiita",
        ps_song_number=3,
        style=None,
        lead_instrument="piano",
    )
    talk = await world.publish(
        "a",
        mp3(3012),
        kind="baba_audio",
        language="en",
        style=None,
        lead_instrument="piano",
    )
    assert bhajan.json()["lead_instrument"] == "harmonium"
    assert ps.json()["lead_instrument"] == "piano"
    assert talk.status_code == 201 and talk.json()["lead_instrument"] is None


async def test_a_listed_word_typed_under_other_becomes_its_code_and_never_queues(
    world: World,
) -> None:
    made = await world.publish(
        "a", mp3(3020), lead_instrument="other", lead_instrument_other="  Piano "
    )
    assert made.status_code == 201, made.text
    assert made.json()["lead_instrument"] == "piano"
    assert made.json()["lead_instrument_other"] is None
    assert await world.scalar(select(ValueSuggestion.id)) is None


async def test_other_needs_a_name_of_2_to_40_characters(world: World) -> None:
    for seed, word in ((3030, None), (3031, "x"), (3032, "y" * 41)):
        refused = await world.publish(
            "a", mp3(seed), lead_instrument="other", lead_instrument_other=word
        )
        assert refused.status_code == 422, (word, refused.text)


# --------------------------------------------------------------------------- the queue


async def test_a_new_word_is_seen_by_its_author_at_once_and_waits_in_the_queue(
    world: World,
) -> None:
    made = await world.publish(
        "a", mp3(3100), lead_instrument="other", lead_instrument_other="Dilruba"
    )
    assert made.status_code == 201, made.text
    rid = made.json()["id"]
    assert made.json()["lead_instrument"] == "other"
    assert made.json()["lead_instrument_other"] == "Dilruba"  # the author sees it at once
    own = (await world.client.get(f"/api/v1/recordings/{rid}", headers=AS_A)).json()
    assert own["lead_instrument_other"] == "Dilruba"
    # everyone else sees "other", not the word, until the team accepts it
    other_viewer = (await world.client.get(f"/api/v1/recordings/{rid}", headers=AS_B)).json()
    assert other_viewer["lead_instrument"] == "other"
    assert other_viewer["lead_instrument_other"] is None
    listed = (await world.client.get("/api/v1/recordings")).json()["items"]
    assert listed[0]["lead_instrument_other"] is None
    row = await world.scalar(select(ValueSuggestion))
    assert (row.field, row.label, row.key, row.status) == (
        "instrument",
        "Dilruba",
        "dilruba",
        "pending",
    )
    assert (row.recordings_count, row.people_count) == (1, 1)


async def test_the_same_word_from_two_people_is_one_row_with_counters(world: World) -> None:
    await world.publish("a", mp3(3110), lead_instrument="other", lead_instrument_other="Dilruba")
    await world.publish("a", mp3(3111), lead_instrument="other", lead_instrument_other="dilruba ")
    await world.publish("b", mp3(3112), lead_instrument="other", lead_instrument_other="DILRUBA")
    rows = await world.sessions_scalars(select(ValueSuggestion))
    assert len(rows) == 1
    assert (rows[0].recordings_count, rows[0].people_count) == (3, 2)
    assert rows[0].label == "Dilruba"  # as first written


async def test_a_word_like_a_listed_one_carries_the_hint_for_the_team(world: World) -> None:
    await world.publish("a", mp3(3120), lead_instrument="other", lead_instrument_other="harmonyum")
    row = await world.scalar(select(ValueSuggestion))
    assert row.similar_to == "harmonium"


async def test_three_new_words_a_week_per_person_and_a_known_word_is_free(world: World) -> None:
    assert NEW_WORDS_PER_WEEK == 3
    for seed, word in ((3200, "Dilruba"), (3201, "Santoor"), (3202, "Rabab")):
        ok = await world.publish(
            "a", mp3(seed), lead_instrument="other", lead_instrument_other=word
        )
        assert ok.status_code == 201, ok.text
    fourth = await world.publish(
        "a", mp3(3203), lead_instrument="other", lead_instrument_other="Sarod"
    )
    assert fourth.status_code == 429, fourth.text
    assert "3 new words a week" in fourth.text
    # a word already in the queue is not new, and the list is always free
    again = await world.publish(
        "a", mp3(3204), lead_instrument="other", lead_instrument_other="santoor"
    )
    assert again.status_code == 201, again.text
    listed = await world.publish("a", mp3(3205), lead_instrument="piano")
    assert listed.status_code == 201
    # the limit is per person
    someone_else = await world.publish(
        "b", mp3(3206), lead_instrument="other", lead_instrument_other="Sarod"
    )
    assert someone_else.status_code == 201
    # and a refused upload left nothing in the queue
    assert (
        await world.scalar(
            select(ValueSuggestion)
            .where(ValueSuggestion.key == "sarod")
            .where(ValueSuggestion.first_user_id == MEMBER_A)
        )
        is None
    )


async def test_the_week_runs_out_and_the_person_may_bring_new_words_again(world: World) -> None:
    for seed, word in ((3210, "Dilruba"), (3211, "Santoor"), (3212, "Rabab")):
        await world.publish("a", mp3(seed), lead_instrument="other", lead_instrument_other=word)
    old = datetime.now(UTC) - timedelta(days=8)
    async with world.sessions() as session:
        await session.execute(
            update(ValueSuggestion).where(ValueSuggestion.key == "dilruba").values(created_at=old)
        )
        await session.commit()
    ok = await world.publish("a", mp3(3213), lead_instrument="other", lead_instrument_other="Sarod")
    assert ok.status_code == 201, ok.text


async def test_a_style_written_under_other_goes_to_the_same_queue(world: World) -> None:
    made = await world.publish("a", mp3(3300), style="other", style_other="Baul")
    assert made.status_code == 201, made.text
    assert (made.json()["style"], made.json()["style_other"]) == ("other", "Baul")
    row = await world.scalar(select(ValueSuggestion))
    assert (row.field, row.key, row.status) == ("style", "baul", "pending")
    # a listed style typed as text is the id
    listed = await world.publish("a", mp3(3301), style="other", style_other="Bengali")
    assert (listed.json()["style"], listed.json()["style_other"]) == ("bengali", None)


async def test_both_words_of_one_recording_count_against_the_same_limit(world: World) -> None:
    ok = await world.publish(
        "a",
        mp3(3310),
        style="other",
        style_other="Baul",
        lead_instrument="other",
        lead_instrument_other="Dilruba",
    )
    assert ok.status_code == 201, ok.text
    two_more = await world.publish(
        "a",
        mp3(3311),
        style="other",
        style_other="Kirtania",
        lead_instrument="other",
        lead_instrument_other="Santoor",
    )
    assert two_more.status_code == 429  # 2 + 2 would be four new words in the week


# --------------------------------------------------------------------------- the team's answer


@pytest.fixture
def as_team(world: World):  # type: ignore[no-untyped-def]
    """Requests with the header `X-Test-Team` come from the team; the others get a 403."""
    app = world.client._transport.app  # type: ignore[attr-defined]

    async def team(request: Request) -> UserAccount:
        if request.headers.get("X-Test-Team") != "1":
            raise HTTPException(status_code=403, detail="Only the team can do this.")
        async with world.sessions() as session:
            return await session.get(UserAccount, MEMBER_A)  # type: ignore[return-value]

    app.dependency_overrides[get_team_member] = team
    return {"X-Test-Team": "1"}


async def _queue_one(world: World, seed: int, word: str, who: str = "a") -> tuple[str, str]:
    made = await world.publish(who, mp3(seed), lead_instrument="other", lead_instrument_other=word)
    assert made.status_code == 201, made.text
    row = await world.scalar(
        select(ValueSuggestion).where(ValueSuggestion.key == word.lower().strip())
    )
    return made.json()["id"], str(row.id)


async def test_only_the_team_reads_and_answers_the_queue(world: World, as_team) -> None:  # type: ignore[no-untyped-def]
    _, sid = await _queue_one(world, 3400, "Dilruba")
    assert (await world.client.get(QUEUE, headers=AS_B)).status_code == 403
    decision = {"action": "reject"}
    assert (
        await world.client.post(f"{QUEUE}/{sid}/decision", headers=AS_B, json=decision)
    ).status_code == 403
    listed = (await world.client.get(QUEUE, headers=as_team)).json()
    assert listed["total"] == 1 and listed["items"][0]["label"] == "Dilruba"
    assert listed["items"][0]["people_count"] == 1


async def test_accepting_makes_the_word_public_and_offers_it_in_the_form(
    world: World,
    as_team,  # type: ignore[no-untyped-def]
) -> None:
    rid, sid = await _queue_one(world, 3410, "Dilruba")
    assert (await world.client.get(OPTIONS, params={"field": "instrument"})).json()[
        "accepted"
    ] == []
    done = await world.client.post(
        f"{QUEUE}/{sid}/decision", headers=as_team, json={"action": "accept"}
    )
    assert done.status_code == 200 and done.json()["status"] == "accepted"
    seen = (await world.client.get(f"/api/v1/recordings/{rid}", headers=AS_B)).json()
    assert (seen["lead_instrument"], seen["lead_instrument_other"]) == ("other", "Dilruba")
    assert seen["lead_instrument_checked"] is True
    options = (await world.client.get(OPTIONS, params={"field": "instrument"})).json()
    assert options["accepted"] == [{"key": "dilruba", "label": "Dilruba"}]
    assert options["new_words_per_week"] == 3
    # a later recording with the accepted word is public at once and is not a new word
    again = await world.publish(
        "b", mp3(3411), lead_instrument="other", lead_instrument_other="dilruba"
    )
    assert again.status_code == 201
    listed = (await world.client.get("/api/v1/recordings")).json()["items"]
    assert {i["lead_instrument_other"] for i in listed} == {"Dilruba"}
    # a decided word cannot be decided again
    twice = await world.client.post(
        f"{QUEUE}/{sid}/decision", headers=as_team, json={"action": "reject"}
    )
    assert twice.status_code == 409


async def test_merging_puts_the_listed_value_on_the_recordings(world: World, as_team) -> None:  # type: ignore[no-untyped-def]
    rid, sid = await _queue_one(world, 3420, "Harmoniyam")
    bad = await world.client.post(
        f"{QUEUE}/{sid}/decision",
        headers=as_team,
        json={"action": "merge", "merge_into": "theremin"},
    )
    assert bad.status_code == 422
    done = await world.client.post(
        f"{QUEUE}/{sid}/decision",
        headers=as_team,
        json={"action": "merge", "merge_into": "harmonium"},
    )
    assert done.status_code == 200 and done.json()["merged_into"] == "harmonium"
    got = (await world.client.get(f"/api/v1/recordings/{rid}", headers=AS_A)).json()
    assert (got["lead_instrument"], got["lead_instrument_other"]) == ("harmonium", None)
    # the same word written again is swapped for the value, and does not count as new
    again = await world.publish(
        "b", mp3(3421), lead_instrument="other", lead_instrument_other="harmoniyam"
    )
    assert again.json()["lead_instrument"] == "harmonium"


async def test_rejecting_removes_the_word_tells_the_author_and_refuses_it_next_time(
    world: World,
    as_team,  # type: ignore[no-untyped-def]
) -> None:
    rid, sid = await _queue_one(world, 3430, "Nonsense")
    done = await world.client.post(
        f"{QUEUE}/{sid}/decision", headers=as_team, json={"action": "reject"}
    )
    assert done.status_code == 200 and done.json()["status"] == "rejected"
    got = (await world.client.get(f"/api/v1/recordings/{rid}", headers=AS_A)).json()
    assert (got["lead_instrument"], got["lead_instrument_other"]) == (None, None)
    async with world.sessions() as session:
        notice = (await session.scalars(select(MemberNotice))).one()
    assert notice.kind == "value_rejected" and "Nonsense" in notice.body
    again = await world.publish(
        "b", mp3(3431), lead_instrument="other", lead_instrument_other="nonsense"
    )
    assert again.status_code == 422 and "did not accept" in again.text


async def test_rejecting_a_style_keeps_the_kiirtan_with_style_other_and_no_word(
    world: World,
    as_team,  # type: ignore[no-untyped-def]
) -> None:
    made = await world.publish("a", mp3(3440), style="other", style_other="Nonsense")
    assert made.status_code == 201, made.text
    row = await world.scalar(select(ValueSuggestion))
    done = await world.client.post(
        f"{QUEUE}/{row.id}/decision", headers=as_team, json={"action": "reject"}
    )
    assert done.status_code == 200
    got = (await world.client.get(f"/api/v1/recordings/{made.json()['id']}", headers=AS_A)).json()
    assert (got["style"], got["style_other"]) == ("other", None)


async def test_uses_are_counted_per_recording(world: World) -> None:
    await world.publish("a", mp3(3450), lead_instrument="other", lead_instrument_other="Dilruba")
    await world.publish("a", mp3(3451), lead_instrument="other", lead_instrument_other="Dilruba")
    async with world.sessions() as session:
        uses = (await session.scalars(select(ValueSuggestionUse))).all()
        recs = (await session.scalars(select(Recording))).all()
    assert len(uses) == 2 and {u.recording_id for u in uses} == {r.id for r in recs}
