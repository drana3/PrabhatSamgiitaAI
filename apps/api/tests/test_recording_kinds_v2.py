"""Spiritual songs, dance songs and the language rules of the five categories.

Dada's rules: Kiirtan has no language; Bhajan and Prabhat Samgiita may have one; a Spiritual song
MUST have a language; a Dance song MUST name its dance (Tandava or Kaoshiki) and may have a
language. The API answers 422 with a plain sentence when a required field is missing. The fixtures
come from test_recordings.py.
"""

# ruff: noqa: F811
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from test_recordings import (  # noqa: F401  (fixtures are used by name)
    World,
    file_world,
    mp3,
    world,
)

from app.models.recordings import (
    DANCES,
    KIND_LANGUAGE_RULE,
    KINDS_WITH_LANGUAGE,
    RECORDING_KINDS,
    Recording,
    public_kind,
)
from app.services.recording_languages import (
    LANGUAGE_CODES,
    LANGUAGES,
    clean_language_other,
    normalize_language,
)


def test_the_language_rule_of_every_category_is_in_one_table() -> None:
    assert KIND_LANGUAGE_RULE == {
        "kiirtan": "none",
        "bhajan": "optional",
        "prabhat_samgiita": "optional",
        "spiritual_song": "required",
        "dance_song": "optional",
    }
    assert set(KIND_LANGUAGE_RULE) == set(RECORDING_KINDS)
    assert KINDS_WITH_LANGUAGE == ("bhajan", "prabhat_samgiita", "spiritual_song", "dance_song")
    assert DANCES == ("tandava", "kaoshiki")
    # the old id is still only an alias of Bhajan
    assert public_kind("devotional_song") == "bhajan"
    assert "devotional_song" not in RECORDING_KINDS


def test_the_catalog_has_the_languages_dada_listed() -> None:
    wanted = {
        "bn", "sa", "hi", "en", "ru", "es", "pt", "de", "fr", "it", "pl", "uk", "ta", "te",
        "ne", "zh", "ja", "id", "vi", "sw", "eo",
    }  # fmt: skip
    assert wanted <= set(LANGUAGE_CODES)
    assert len(set(LANGUAGE_CODES)) == len(LANGUAGE_CODES) == len(LANGUAGES)
    assert all(2 <= len(code) <= 3 and code.islower() for code in LANGUAGE_CODES)


def test_language_words_codes_and_nonsense() -> None:
    assert normalize_language(" Bengali ") == "bn"
    assert normalize_language("PT") == "pt"
    assert normalize_language("other") == "other"
    assert normalize_language("") is None and normalize_language(None) is None
    for bad in ("klingon", "xx", "bengalii", "e"):
        with pytest.raises(ValueError):
            normalize_language(bad)


def test_a_free_text_language_is_cleaned_before_it_is_stored() -> None:
    assert clean_language_other("  Old\u0000  Church\n Slavonic  ") == "Old Church Slavonic"
    assert clean_language_other("x" * 200) == "x" * 80
    assert clean_language_other("   ") is None and clean_language_other(None) is None


async def test_a_spiritual_song_needs_a_language(world: World) -> None:
    refused = await world.publish("a", mp3(600), kind="spiritual_song", title="Prayer")
    assert refused.status_code == 422, refused.text
    assert "language" in refused.text.lower()
    for n, bad in enumerate(("", "   ", "klingon", "xx")):
        r = await world.publish("a", mp3(601 + n), kind="spiritual_song", language=bad)
        assert r.status_code == 422, (bad, r.text)
    ok = await world.publish("a", mp3(610), kind="spiritual_song", language="ru", title="Молитва")
    assert ok.status_code == 201, ok.text
    item = ok.json()
    assert item["kind"] == "spiritual_song" and item["language"] == "ru"
    assert item["type"] == "other" and item["dance"] is None
    # a song number belongs to Prabhat Samgiita only
    bad = await world.publish("a", mp3(611), kind="spiritual_song", language="en", ps_song_number=3)
    assert bad.status_code == 422


async def test_other_needs_its_name_and_the_name_is_stored_safely(world: World) -> None:
    missing = await world.publish("a", mp3(620), kind="spiritual_song", language="other")
    assert missing.status_code == 422
    blank = await world.publish(
        "a", mp3(621), kind="spiritual_song", language="other", language_other="   "
    )
    assert blank.status_code == 422
    ok = await world.publish(
        "a",
        mp3(622),
        kind="spiritual_song",
        language="other",
        language_other="  Old\u0000 Church   Slavonic ",
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["language"] == "other"
    assert ok.json()["language_other"] == "Old Church Slavonic"
    # the name is dropped when a real language is chosen
    plain = await world.publish(
        "a", mp3(623), kind="spiritual_song", language="fr", language_other="ignored"
    )
    assert plain.json()["language_other"] is None


async def test_a_dance_song_needs_its_dance(world: World) -> None:
    missing = await world.publish("a", mp3(630), kind="dance_song", title="Dance")
    assert missing.status_code == 422, missing.text
    assert "dance" in missing.text.lower()
    for n, bad in enumerate(("", "waltz", "TANDAVAS")):
        r = await world.publish("a", mp3(631 + n), kind="dance_song", dance=bad)
        assert r.status_code == 422, (bad, r.text)
    for n, dance in enumerate(DANCES):
        ok = await world.publish("a", mp3(640 + n), kind="dance_song", dance=dance, title=dance)
        assert ok.status_code == 201, (dance, ok.text)
        assert ok.json()["dance"] == dance and ok.json()["kind"] == "dance_song"
        assert ok.json()["language"] is None  # optional for a dance song
    # the dance is case-insensitive on the way in
    upper = await world.publish("a", mp3(645), kind="dance_song", dance="Tandava", title="Up")
    assert upper.status_code == 201 and upper.json()["dance"] == "tandava"
    # a language is welcome for a dance song
    sung = await world.publish("a", mp3(646), kind="dance_song", dance="kaoshiki", language="bn")
    assert sung.status_code == 201 and sung.json()["language"] == "bn"


async def test_a_dance_belongs_to_the_dance_song_category_only(world: World) -> None:
    for n, kind in enumerate(("kiirtan", "bhajan", "spiritual_song")):
        extra = {"language": "en"} if kind == "spiritual_song" else {}
        r = await world.publish("a", mp3(650 + n), kind=kind, dance="tandava", **extra)
        assert r.status_code == 422, (kind, r.text)


async def test_kiirtan_drops_a_language_bhajan_and_ps_keep_it_optional(world: World) -> None:
    kiirtan = await world.publish("a", mp3(660), kind="kiirtan", language="sa", title="K")
    assert kiirtan.status_code == 201 and kiirtan.json()["language"] is None
    bhajan = await world.publish("a", mp3(661), kind="bhajan", title="B")
    assert bhajan.status_code == 201 and bhajan.json()["language"] is None
    ps = await world.publish(
        "a", mp3(662), kind="prabhat_samgiita", ps_song_number=9, language="bn"
    )
    assert ps.status_code == 201 and ps.json()["language"] == "bn"


async def test_the_old_language_words_still_work_and_are_stored_as_codes(world: World) -> None:
    for n, (word, code) in enumerate(
        (("bengali", "bn"), ("sanskrit", "sa"), ("hindi", "hi"), ("english", "en"))
    ):
        r = await world.publish("a", mp3(670 + n), kind="bhajan", language=word, title=word)
        assert r.status_code == 201 and r.json()["language"] == code


async def test_the_list_filters_by_the_new_categories(world: World) -> None:
    await world.publish("a", mp3(680), kind="spiritual_song", language="de", title="Lied")
    await world.publish("a", mp3(681), kind="dance_song", dance="tandava", title="Tanz")
    await world.publish("a", mp3(682), kind="kiirtan", title="K")
    only_spiritual = (
        await world.client.get("/api/v1/recordings", params={"kind": "spiritual_song"})
    ).json()
    assert [i["title"] for i in only_spiritual["items"]] == ["Lied"]
    only_dance = (
        await world.client.get("/api/v1/recordings", params={"kind": "dance_song"})
    ).json()
    assert [i["title"] for i in only_dance["items"]] == ["Tanz"]
    assert (
        await world.client.get("/api/v1/recordings", params={"kind": "devotional_song"})
    ).status_code == 422


async def test_the_database_enforces_the_same_rules(world: World) -> None:
    """Even a writer that skips the API (a script) cannot store a dance song without a dance."""
    await world.publish("a", mp3(690), kind="kiirtan", title="seed")
    row = await world.scalar(select(Recording))
    assert row is not None
    for kind, fields in (
        ("dance_song", {}),  # no dance
        ("kiirtan", {"dance": "tandava"}),  # a dance on another category
        ("spiritual_song", {}),  # no language
    ):
        async with world.sessions() as session:
            session.add(
                Recording(
                    kind=kind,
                    type="other",
                    title="x",
                    author="y",
                    added_by="z",
                    status="published",
                    audio_key=f"recordings/k/{kind}.mp3",
                    audio_url="u",
                    audio_sha256=(
                        "a" if kind == "dance_song" else "b" if kind == "kiirtan" else "c"
                    )
                    * 64,
                    **fields,
                )
            )
            with pytest.raises(IntegrityError):
                await session.commit()
