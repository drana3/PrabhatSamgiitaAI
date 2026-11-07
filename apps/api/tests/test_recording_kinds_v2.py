"""Spiritual songs, dance music and the language rules of the five categories.

Dada's rules: Kiirtan has no language; Bhajan and Prabhat Samgiita may have one; a Spiritual song
MUST have a language; a Dance music MUST name its dance (Tandava or Kaoshiki) and may have a
language. The API answers 422 with a plain sentence when a required field is missing. The fixtures
come from test_recordings.py.
"""

# ruff: noqa: F811
from __future__ import annotations

import hashlib
import os
from uuid import UUID

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

from app.models.member import UserAccount
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
        "bhajan": "required",
        "prabhat_samgiita": "optional",
        "spiritual_song": "required",
        "dance_song": "optional",
        "baba_audio": "required",
    }
    assert set(KIND_LANGUAGE_RULE) == set(RECORDING_KINDS)
    assert KINDS_WITH_LANGUAGE == (
        "bhajan",
        "prabhat_samgiita",
        "spiritual_song",
        "dance_song",
        "baba_audio",
    )
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
        assert ok.json()["language"] is None  # optional for a dance music
    # the dance is case-insensitive on the way in
    upper = await world.publish("a", mp3(645), kind="dance_song", dance="Tandava", title="Up")
    assert upper.status_code == 201 and upper.json()["dance"] == "tandava"
    # a language is welcome for a dance music
    sung = await world.publish("a", mp3(646), kind="dance_song", dance="kaoshiki", language="bn")
    assert sung.status_code == 201 and sung.json()["language"] == "bn"


async def test_a_dance_belongs_to_the_dance_song_category_only(world: World) -> None:
    for n, kind in enumerate(("kiirtan", "bhajan", "spiritual_song")):
        extra = {"language": "en"} if kind == "spiritual_song" else {}
        r = await world.publish("a", mp3(650 + n), kind=kind, dance="tandava", **extra)
        assert r.status_code == 422, (kind, r.text)


async def test_kiirtan_drops_a_language_ps_keeps_it_optional_bhajan_needs_it(
    world: World,
) -> None:
    kiirtan = await world.publish("a", mp3(660), kind="kiirtan", language="sa", title="K")
    assert kiirtan.status_code == 201 and kiirtan.json()["language"] is None
    bhajan = await world.publish("a", mp3(661), kind="bhajan", title="B", language="hi")
    assert bhajan.status_code == 201 and bhajan.json()["language"] == "hi"
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
    """Even a writer that skips the API (a script) cannot store a dance music without a dance."""
    await world.publish("a", mp3(690), kind="kiirtan", title="seed")
    row = await world.scalar(select(Recording))
    assert row is not None
    for kind, fields in (
        ("dance_song", {}),  # no dance
        ("kiirtan", {"dance": "tandava"}),  # a dance on another category
        ("spiritual_song", {}),  # no language
        ("baba_audio", {}),  # no language
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
                    audio_sha256=hashlib.sha256(kind.encode()).hexdigest(),
                    **fields,
                )
            )
            with pytest.raises(IntegrityError):
                await session.commit()


async def test_a_new_bhajan_needs_a_language_and_an_old_one_stays_valid(world: World) -> None:
    missing = await world.publish("a", mp3(690), kind="bhajan", title="No language")
    assert missing.status_code == 422 and "language" in missing.text.lower()
    other = await world.publish("a", mp3(691), kind="bhajan", language="other", title="Other")
    assert other.status_code == 422  # "other" needs its name
    fine = await world.publish("a", mp3(692), kind="bhajan", language="bn", title="Fine")
    assert fine.status_code == 201
    # a Bhajan stored before the rule (no language, even the legacy kind id) still reads fine
    async with world.sessions() as session:
        row = await session.get(Recording, UUID(fine.json()["id"]))
        assert row is not None
        row.kind = "devotional_song"
        row.language = None
        await session.commit()
    shown = (await world.client.get("/api/v1/recordings", params={"kind": "bhajan"})).json()
    assert [(i["kind"], i["language"]) for i in shown["items"]] == [("bhajan", None)]
    # the other categories keep their rules: Prabhat Samgiita and dance music stay optional
    ps = await world.publish("a", mp3(693), kind="prabhat_samgiita", ps_song_number=3)
    assert ps.status_code == 201
    dance = await world.publish("a", mp3(694), kind="dance_song", dance="tandava")
    assert dance.status_code == 201


async def test_baba_audio_needs_a_language_and_names_no_performer(world: World) -> None:
    """Baba audio: language required, no performer, place and discourse optional."""
    for n, bad in enumerate((None, "", "   ", "klingon")):
        extra = {} if bad is None else {"language": bad}
        r = await world.publish("a", mp3(700 + n), kind="baba_audio", author="", **extra)
        assert r.status_code == 422, (bad, r.text)
    assert "language" in r.text.lower()
    ok = await world.publish(
        "a",
        mp3(710),
        kind="baba_audio",
        author="",
        by_author=True,
        language="en",
        title="Neohumanism",
        place="  Ranchi\u0000 ",
        discourse=" Discourse 12 ",
    )
    assert ok.status_code == 201, ok.text
    item = ok.json()
    assert item["kind"] == "baba_audio" and item["type"] == "other"
    assert item["language"] == "en" and item["dance"] is None and item["ps_song_number"] is None
    assert item["author"] == "Shrii Shrii Anandamurti" and item["by_author"] is False
    assert item["place"] == "Ranchi" and item["discourse"] == "Discourse 12"
    # a performer sent anyway does not replace Baba as the speaker
    again = await world.publish(
        "a", mp3(711), kind="baba_audio", author="Somebody", language="ru", title="Two"
    )
    assert again.status_code == 201 and again.json()["author"] == "Shrii Shrii Anandamurti"
    # place and discourse are optional
    bare = await world.publish(
        "a", mp3(712), kind="baba_audio", author="", language="es", title="3"
    )
    assert bare.status_code == 201
    assert bare.json()["place"] is None and bare.json()["discourse"] is None
    # a dance or a song number belongs to other categories
    for n, extra in enumerate(({"dance": "tandava"}, {"ps_song_number": 3})):
        r = await world.publish("a", mp3(713 + n), kind="baba_audio", language="en", **extra)
        assert r.status_code == 422, extra


async def test_place_and_discourse_are_dropped_for_the_other_categories(world: World) -> None:
    for n, kind in enumerate(("kiirtan", "bhajan")):
        extra = {"language": "en"} if kind == "bhajan" else {}
        r = await world.publish(
            "a", mp3(720 + n), kind=kind, place="Ranchi", discourse="12", title=kind, **extra
        )
        assert r.status_code == 201, r.text
        assert r.json()["place"] is None and r.json()["discourse"] is None
    # a performer is still required for every other single upload
    missing = await world.publish("a", mp3(725), kind="kiirtan", author="")
    assert missing.status_code == 422


async def test_the_list_filters_by_baba_audio(world: World) -> None:
    await world.publish("a", mp3(730), kind="baba_audio", language="en", title="Talk")
    await world.publish("a", mp3(731), kind="kiirtan", title="K")
    got = (await world.client.get("/api/v1/recordings", params={"kind": "baba_audio"})).json()
    assert [i["title"] for i in got["items"]] == ["Talk"]


async def _stored_without_language(world: World, seed: int, kind: str = "bhajan") -> str:
    """An old Bhajan stored before the rule: published, then its language removed."""
    fine = await world.publish("a", mp3(seed), kind=kind, language="bn", title=f"Old {seed}")
    assert fine.status_code == 201, fine.text
    async with world.sessions() as session:
        row = await session.get(Recording, UUID(fine.json()["id"]))
        assert row is not None
        row.language = None
        row.language_other = None
        await session.commit()
    return str(fine.json()["id"])


async def test_the_owner_adds_the_missing_language_of_an_old_bhajan(world: World) -> None:
    rid = await _stored_without_language(world, 740)
    url = f"/api/v1/recordings/{rid}/language"
    as_a, as_b = {"X-Test-Member": "a"}, {"X-Test-Member": "b"}
    # a stranger cannot, nor an empty or unknown language
    assert (await world.client.patch(url, headers=as_b, json={"language": "hi"})).status_code == 403
    for bad in ({"language": ""}, {"language": "klingon"}, {"language": "other"}, {}):
        r = await world.client.patch(url, headers=as_a, json=bad)
        assert r.status_code == 422, (bad, r.text)
    # "other" needs its name; the name is cleaned
    ok = await world.client.patch(
        url,
        headers=as_a,
        json={"language": "other", "language_other": " Old\u0000  Church  Slavonic "},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["language"] == "other" and ok.json()["language_other"] == "Old Church Slavonic"
    # it adds, it never rewrites
    again = await world.client.patch(url, headers=as_a, json={"language": "hi"})
    assert again.status_code == 409
    shown = (await world.client.get("/api/v1/recordings", params={"kind": "bhajan"})).json()
    assert [i["language"] for i in shown["items"]] == ["other"]


async def test_the_team_may_add_a_language_and_a_legacy_row_counts_as_a_bhajan(
    world: World,
) -> None:
    rid = await _stored_without_language(world, 750)
    async with world.sessions() as session:
        row = await session.get(Recording, UUID(rid))
        assert row is not None
        row.kind = "devotional_song"  # the legacy id of the same category
        member_b = await session.get(UserAccount, UUID("00000000-0000-0000-0000-00000000000b"))
        assert member_b is not None
        member_b.is_admin = True
        await session.commit()
    done = await world.client.patch(
        f"/api/v1/recordings/{rid}/language",
        headers={"X-Test-Member": "b"},
        json={"language": "ru"},
    )
    assert done.status_code == 200 and done.json()["language"] == "ru"


async def test_no_language_can_be_added_to_a_kiirtan_or_a_removed_recording(world: World) -> None:
    kiirtan = await world.publish("a", mp3(760), kind="kiirtan", title="K")
    refused = await world.client.patch(
        f"/api/v1/recordings/{kiirtan.json()['id']}/language",
        headers={"X-Test-Member": "a"},
        json={"language": "en"},
    )
    assert refused.status_code == 422
    rid = await _stored_without_language(world, 761)
    async with world.sessions() as session:
        row = await session.get(Recording, UUID(rid))
        assert row is not None
        row.status = "removed"
        await session.commit()
    gone = await world.client.patch(
        f"/api/v1/recordings/{rid}/language",
        headers={"X-Test-Member": "a"},
        json={"language": "en"},
    )
    assert gone.status_code == 409
    missing = await world.client.patch(
        "/api/v1/recordings/00000000-0000-0000-0000-0000000000ff/language",
        headers={"X-Test-Member": "a"},
        json={"language": "en"},
    )
    assert missing.status_code == 404
    signed_out = await world.client.patch(
        f"/api/v1/recordings/{rid}/language", json={"language": "en"}
    )
    assert signed_out.status_code == 401
