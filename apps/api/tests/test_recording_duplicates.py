"""Kiirtan duplicates, level by level (docs/kiirtan-publishing.md, section "Duplicates").

1. the same file is refused, also when two uploads race;
2. a similar sound warns, is confirmed once, and degrades safely without `fpcalc`;
3. reports "Duplicate", the admin "duplicate of", the daily allowance and the own-copy block.

The fixtures (`world`, `file_world`) come from test_recordings.py.
"""

# ruff: noqa: F811
# (the fixtures come in by name from test_recordings.py and are used as arguments)
from __future__ import annotations

import asyncio
import hashlib
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
import pytest
from sqlalchemy import func, select
from test_recordings import (  # noqa: F401  (fixtures are used by name)
    MEMBER_A,
    MEMBER_B,
    World,
    file_world,
    make_fake_fpcalc,
    mp3,
    world,
)

from app.models.recordings import (
    MemberNotice,
    Recording,
    RecordingReport,
    RecordingSimilarConfirm,
)
from app.services import recordings as service

AS_A = {"X-Test-Member": "a"}
AS_B = {"X-Test-Member": "b"}


async def attempt(world: World, who: str, data: bytes, **overrides: object) -> httpx.Response:
    """Like `world.publish`, but returns the answer of whichever step refused."""
    asked = await world.client.post(
        "/api/v1/recordings/uploads",
        headers={"X-Test-Member": who},
        json={"file_name": "x.mp3", "content_type": "audio/mpeg", "size_bytes": len(data)},
    )
    if asked.status_code != 201:
        return asked
    target = asked.json()
    path = "/" + target["url"].split("://", 1)[1].split("/", 1)[1]
    await world.client.put(path, content=data, headers=target["headers"])
    return await world.client.post(
        "/api/v1/recordings",
        headers={"X-Test-Member": who},
        json=world.body(target["key"], **overrides),
    )


async def count(world: World, model: type) -> int:
    return int(await world.scalar(select(func.count()).select_from(model)) or 0)


# ============================================================ level 1: same file


async def test_the_same_file_is_refused_with_a_clear_message_and_a_link(world: World) -> None:
    data = mp3(1)
    first = (await world.publish("a", data)).json()
    sha = hashlib.sha256(data).hexdigest()

    early = await world.client.post(
        "/api/v1/recordings/uploads",
        headers=AS_B,
        json={
            "file_name": "x.mp3",
            "content_type": "audio/mpeg",
            "size_bytes": len(data),
            "sha256": sha,
        },
    )
    assert early.status_code == 409
    detail = early.json()["detail"]
    assert detail["code"] == "duplicate"
    assert detail["message"] == "This file is already in the library."
    assert detail["duplicate_of"]["id"] == first["id"]
    assert detail["duplicate_of"]["audio_url"] == first["audio_url"]
    # Upper-case hash from a client is the same file.
    shouting = await world.client.post(
        "/api/v1/recordings/uploads",
        headers=AS_B,
        json={
            "file_name": "x.mp3",
            "content_type": "audio/mpeg",
            "size_bytes": len(data),
            "sha256": sha.upper(),
        },
    )
    assert shouting.status_code == 409

    # The hash was not sent (an old client): the stored bytes are checked before publishing.
    late = await world.publish("b", data)
    assert late.status_code == 409
    assert late.json()["detail"]["message"] == "This file is already in the library."
    assert late.json()["detail"]["duplicate_of"]["id"] == first["id"]
    assert await count(world, Recording) == 1
    assert list((world.storage.base_dir / "recordings" / str(MEMBER_B)).glob("*")) == []


async def test_the_hash_check_runs_before_any_byte_is_stored(world: World) -> None:
    data = mp3(2)
    await world.publish("a", data)
    stored_before = list(world.storage.base_dir.rglob("*.mp3"))
    refused = await world.client.post(
        "/api/v1/recordings/uploads",
        headers=AS_B,
        json={
            "file_name": "x.mp3",
            "content_type": "audio/mpeg",
            "size_bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        },
    )
    assert refused.status_code == 409
    assert "url" not in refused.json()  # no upload target was handed out
    assert list(world.storage.base_dir.rglob("*.mp3")) == stored_before


async def test_a_race_lost_at_the_unique_index_is_a_clean_duplicate_answer(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Both uploads passed the hash check (the other row was not there yet): the index decides."""
    world.settings.recording_fpcalc_path = "not-installed"  # so only the hash can object
    data = mp3(3)
    first = (await world.publish("a", data)).json()
    second_key = await world.upload("b", data)
    real = service.exact_duplicate
    calls = {"n": 0}

    async def blind_once(session, sha256):  # type: ignore[no-untyped-def]
        calls["n"] += 1
        return None if calls["n"] == 1 else await real(session, sha256)

    monkeypatch.setattr(service, "exact_duplicate", blind_once)
    lost = await world.client.post(
        "/api/v1/recordings", headers=AS_B, json=world.body(second_key, title="Same bytes")
    )
    assert lost.status_code == 409
    detail = lost.json()["detail"]
    assert detail["code"] == "duplicate" and detail["duplicate_of"]["id"] == first["id"]
    assert calls["n"] == 2
    assert await count(world, Recording) == 1
    assert list((world.storage.base_dir / "recordings" / str(MEMBER_B)).glob("*")) == []


async def test_two_simultaneous_uploads_of_the_same_bytes_store_one(file_world: World) -> None:
    world = file_world
    data = mp3(4)
    key_a = await world.upload("a", data)
    key_b = await world.upload("b", data)
    results = await asyncio.gather(
        world.client.post("/api/v1/recordings", headers=AS_A, json=world.body(key_a, title="One")),
        world.client.post("/api/v1/recordings", headers=AS_B, json=world.body(key_b, title="Two")),
    )
    assert sorted(r.status_code for r in results) == [201, 409]
    loser = next(r for r in results if r.status_code == 409)
    assert loser.json()["detail"]["code"] == "duplicate"
    assert await count(world, Recording) == 1


async def test_the_hash_is_unique_in_the_database_itself(world: World) -> None:
    from sqlalchemy.exc import IntegrityError

    row = (await world.publish("a", mp3(5))).json()
    async with world.sessions() as session:
        original = await session.get(Recording, UUID(row["id"]))
        assert original is not None
        session.add(
            Recording(
                kind="kiirtan",
                title="Copy",
                added_by="x",
                audio_key="k",
                audio_url="u",
                audio_sha256=original.audio_sha256,
            )
        )
        with pytest.raises(IntegrityError):
            await session.commit()


# ============================================================ level 2: similar sound


async def test_a_similar_sound_warns_and_a_confirmed_pair_is_not_asked_again(world: World) -> None:
    first = (await world.publish("a", mp3(10, b"NOISE=0;"), title="Original")).json()
    data = mp3(10, b"NOISE=4;")
    key = await world.upload("b", data)
    warn = await world.client.post("/api/v1/recordings", headers=AS_B, json=world.body(key))
    assert warn.status_code == 409
    detail = warn.json()["detail"]
    assert detail["code"] == "similar_recording"
    assert detail["message"].startswith("Sounds like a recording already in the library")
    assert [s["id"] for s in detail["similar"]] == [first["id"]]
    assert detail["similar"][0]["audio_url"] == first["audio_url"]
    assert await count(world, RecordingSimilarConfirm) == 0  # asking costs nothing

    confirmed = await world.client.post(
        "/api/v1/recordings",
        headers=AS_B,
        json=world.body(key, title="Another performance", confirm_different=True),
    )
    assert confirmed.status_code == 201, confirmed.text
    assert confirmed.json()["duplicate_of"] == first["id"]
    pairs = (await world.scalar(select(func.count()).select_from(RecordingSimilarConfirm))) or 0
    assert pairs == 1

    # The publish row is lost (say the app crashed): the same file is not asked about again.
    async with world.sessions() as session:
        row = (
            await session.scalars(select(Recording).where(Recording.title == "Another performance"))
        ).one()
        await session.delete(row)
        await session.commit()
    again = await world.client.post(
        "/api/v1/recordings", headers=AS_B, json=world.body(key, title="Another performance")
    )
    assert again.status_code == 201, again.text


async def test_the_remembered_pair_only_covers_that_file_and_that_recording(world: World) -> None:
    a = (await world.publish("a", mp3(11, b"NOISE=0;"), title="A")).json()
    b_key = await world.upload("b", mp3(11, b"NOISE=3;"))
    await world.client.post(
        "/api/v1/recordings",
        headers=AS_B,
        json=world.body(b_key, title="B", confirm_different=True),
    )
    # Another file of the same sound still gets its own question, now about both recordings.
    c_key = await world.upload("a", mp3(11, b"NOISE=6;"))
    warn = await world.client.post(
        "/api/v1/recordings", headers=AS_A, json=world.body(c_key, title="C")
    )
    assert warn.status_code == 409
    assert a["id"] in {s["id"] for s in warn.json()["detail"]["similar"]}
    assert len(warn.json()["detail"]["similar"]) == 2


async def test_confirm_similar_is_still_accepted_as_the_old_name(world: World) -> None:
    await world.publish("a", mp3(12, b"NOISE=0;"), title="First")
    key = await world.upload("b", mp3(12, b"NOISE=4;"))
    done = await world.client.post(
        "/api/v1/recordings",
        headers=AS_B,
        json=world.body(key, title="Second", confirm_similar=True),
    )
    assert done.status_code == 201


async def test_cancel_removes_the_stored_file_and_only_for_its_owner(world: World) -> None:
    await world.publish("a", mp3(13, b"NOISE=0;"), title="First")
    key = await world.upload("b", mp3(13, b"NOISE=4;"))
    assert (world.storage.base_dir / key).is_file()
    stranger = await world.client.post(
        "/api/v1/recordings/uploads/discard", headers=AS_A, json={"key": key}
    )
    assert stranger.status_code == 403
    assert (world.storage.base_dir / key).is_file()
    done = await world.client.post(
        "/api/v1/recordings/uploads/discard", headers=AS_B, json={"key": key}
    )
    assert done.status_code == 204
    assert not (world.storage.base_dir / key).exists()
    # Discarding twice is harmless; the signed-out are refused.
    again = await world.client.post(
        "/api/v1/recordings/uploads/discard", headers=AS_B, json={"key": key}
    )
    assert again.status_code == 204
    anonymous = await world.client.post("/api/v1/recordings/uploads/discard", json={"key": key})
    assert anonymous.status_code == 401


async def test_a_published_file_cannot_be_discarded(world: World) -> None:
    key = await world.upload("a", mp3(14))
    await world.client.post("/api/v1/recordings", headers=AS_A, json=world.body(key))
    refused = await world.client.post(
        "/api/v1/recordings/uploads/discard", headers=AS_A, json={"key": key}
    )
    assert refused.status_code == 409
    assert (world.storage.base_dir / key).is_file()


async def test_without_fpcalc_there_is_no_warning_and_the_upload_still_works(world: World) -> None:
    world.settings.recording_fpcalc_path = "definitely-not-installed"
    first = await world.publish("a", mp3(15, b"NOISE=0;"), title="First")
    second = await world.publish("b", mp3(15, b"NOISE=4;"), title="Second")
    assert first.status_code == 201 and second.status_code == 201
    rows = (
        await world.scalar(
            select(func.count()).select_from(Recording).where(Recording.fingerprint.is_(None))
        )
    ) or 0
    assert rows == 2
    # Exact copies are still caught by the hash.
    data = mp3(16)
    await world.publish("a", data, title="Third")
    assert (await world.publish("b", data, title="Fourth")).status_code == 409


async def test_a_broken_fpcalc_never_crashes_an_upload(world: World, tmp_path: Path) -> None:
    broken = tmp_path / "broken-fpcalc"
    for body in (
        "#!/bin/sh\nexit 1\n",  # fails
        "#!/bin/sh\necho 'not json'\n",  # garbage
        '#!/bin/sh\necho \'{"duration": 5, "fingerprint": []}\'\n',  # empty fingerprint
    ):
        broken.write_text(body)
        broken.chmod(0o755)
        world.settings.recording_fpcalc_path = str(broken)
        response = await world.publish("a", mp3(17 + len(body)), title=f"Chant {len(body)}")
        assert response.status_code == 201, response.text
    assert (
        await world.scalar(
            select(func.count()).select_from(Recording).where(Recording.fingerprint.is_not(None))
        )
        == 0
    )


async def test_fpcalc_comes_back_and_the_warning_with_it(world: World, tmp_path: Path) -> None:
    good = make_fake_fpcalc(tmp_path)
    world.settings.recording_fpcalc_path = "definitely-not-installed"
    await world.publish("a", mp3(18, b"NOISE=0;"), title="Old")  # no fingerprint stored
    world.settings.recording_fpcalc_path = str(good)
    await world.publish("a", mp3(18, b"NOISE=0;"), title="Newer")  # has one, nothing to compare to
    warn = await world.publish("b", mp3(18, b"NOISE=3;"), title="Third")
    assert warn.status_code == 409 and warn.json()["detail"]["code"] == "similar_recording"
    assert len(warn.json()["detail"]["similar"]) == 1  # only the one that has a fingerprint


async def test_the_same_author_cannot_add_the_same_title_and_sound_twice(world: World) -> None:
    first = (await world.publish("a", mp3(20, b"NOISE=0;"), title="Baba Nam Kevalam")).json()
    again = await world.publish("a", mp3(20, b"NOISE=3;"), title="baba-nam-kevalam")
    assert again.status_code == 409
    detail = again.json()["detail"]
    assert detail["code"] == "own_duplicate"
    assert detail["duplicate_of"]["id"] == first["id"]
    assert await count(world, Recording) == 1
    # A different title, same sound: only the soft question. Another member: same.
    other_title = await world.publish("a", mp3(20, b"NOISE=5;"), title="A different name")
    assert (
        other_title.status_code == 409
        and other_title.json()["detail"]["code"] == "similar_recording"
    )
    other_member = await world.publish("b", mp3(20, b"NOISE=6;"), title="Baba Nam Kevalam")
    assert (
        other_member.status_code == 409
        and other_member.json()["detail"]["code"] == "similar_recording"
    )


# ============================================================ level 3: after publication


async def test_duplicate_is_a_report_reason(world: World) -> None:
    item = (await world.publish("a", mp3(130), title="Copy")).json()
    url = f"/api/v1/recordings/{item['id']}/report"
    ok = await world.client.post(
        url, headers=AS_B, json={"reason": "duplicate", "comment": "Same as the one from March"}
    )
    assert ok.status_code == 201 and ok.json()["status"] == "received"
    stored = await world.scalar(select(RecordingReport))
    assert stored is not None and stored.reason == "duplicate"
    detail = (await world.client.get(f"/api/v1/admin/recordings/{item['id']}")).json()
    assert detail["reports"][0]["reason"] == "duplicate"
    row = await world.scalar(select(Recording).where(Recording.id == UUID(item["id"])))
    assert row is not None and row.status == "published" and row.reports_count == 1
    async with world.sessions() as session:
        target = await session.get(Recording, UUID(item["id"]))
        assert target is not None
        for index in range(2):
            await service.add_report(
                session,
                recording=target,
                reporter_key=f"anon:{index}",
                reporter_id=None,
                reason="duplicate",
                comment=None,
                flag_threshold=3,
            )
    row = await world.scalar(select(Recording).where(Recording.id == UUID(item["id"])))
    assert row is not None and row.status == "flagged"  # three reports flag it, as for the others


async def test_admin_marks_a_recording_as_a_duplicate_of_another(world: World) -> None:
    original = (
        await world.publish("a", mp3(140), title="Baba Nam Kevalam", author="Ananda Group")
    ).json()
    copy = (
        await world.publish("b", mp3(141), title="Baba Nam Kevalam (again)", author="Someone")
    ).json()
    for _ in range(3):
        await world.client.post(
            f"/api/v1/recordings/{copy['id']}/play", headers={"X-Forwarded-For": "1.1.1.1"}
        )
        service.limiter.reset()
    await world.client.post(f"/api/v1/recordings/{original['id']}/play")
    service.limiter.reset()

    marked = await world.client.post(
        f"/api/v1/admin/recordings/{copy['id']}/duplicate-of",
        json={"original_id": original["id"], "reviewer": "Dada"},
    )
    assert marked.status_code == 200, marked.text
    out = marked.json()
    assert out["status"] == "removed" and out["removed_by"] == "Dada"
    assert out["removed_duplicate_of"] == original["id"]
    assert (
        "Baba Nam Kevalam" in out["removed_reason"]
        and "already in the library" in out["removed_reason"]
    )
    assert out["plays"] == 0

    kept = (await world.client.get(f"/api/v1/recordings/{original['id']}")).json()
    assert kept["status"] == "published" and kept["plays"] == 1 + 3  # the copy's plays moved over
    assert (await world.client.get(f"/api/v1/recordings/{copy['id']}")).status_code == 404

    notices = (await world.client.get("/api/v1/recordings/notices", headers=AS_B)).json()
    assert len(notices) == 1
    notice = notices[0]
    assert notice["kind"] == "recording_removed"
    assert "Baba Nam Kevalam" in notice["title"] and "already in the library" in notice["title"]
    assert notice["payload"]["duplicate_of"]["id"] == original["id"]
    assert notice["payload"]["duplicate_of"]["title"] == "Baba Nam Kevalam"
    assert notice["payload"]["actions"] == ["open_original", "contact"]
    assert "original" in notice["body"] and "Contact us" in notice["body"]
    mine = (await world.client.get("/api/v1/recordings/mine", headers=AS_B)).json()["items"][0]
    assert mine["removed_duplicate_of"] == original["id"]

    # The same bytes still cannot come back; restoring clears the link.
    assert (await world.publish("a", mp3(141))).status_code in (201, 409)
    restored = await world.client.post(f"/api/v1/admin/recordings/{copy['id']}/restore", json={})
    assert restored.json()["removed_duplicate_of"] is None


async def test_marking_a_duplicate_is_checked(world: World) -> None:
    a = (await world.publish("a", mp3(150), title="A")).json()
    b = (await world.publish("b", mp3(151), title="B")).json()
    url = lambda rid: f"/api/v1/admin/recordings/{rid}/duplicate-of"  # noqa: E731
    itself = await world.client.post(url(a["id"]), json={"original_id": a["id"]})
    assert itself.status_code == 422
    ghost = await world.client.post(url(a["id"]), json={"original_id": str(uuid4())})
    assert ghost.status_code == 404
    missing = await world.client.post(url(uuid4()), json={"original_id": a["id"]})
    assert missing.status_code == 404
    # The original must be live: a removed one is no reference.
    await world.client.post(
        f"/api/v1/admin/recordings/{a['id']}/remove", json={"reason": "Not suitable"}
    )
    to_removed = await world.client.post(url(b["id"]), json={"original_id": a["id"]})
    assert to_removed.status_code == 409
    c = (await world.publish("a", mp3(152), title="C")).json()
    ok = await world.client.post(url(b["id"]), json={"original_id": c["id"]})
    assert ok.status_code == 200
    twice = await world.client.post(url(b["id"]), json={"original_id": c["id"]})
    assert twice.status_code == 409
    assert await count(world, MemberNotice) == 2  # A was removed, B was removed as a duplicate


async def test_a_member_may_add_a_limited_number_of_recordings_a_day(world: World) -> None:
    world.settings.recording_uploads_per_day = 3
    for n in range(3):
        assert (await world.publish("a", mp3(160 + n), title=f"Chant {n}")).status_code == 201
    key = None
    refused = await world.client.post(
        "/api/v1/recordings/uploads",
        headers=AS_A,
        json={"file_name": "x.mp3", "content_type": "audio/mpeg", "size_bytes": 100},
    )
    assert refused.status_code == 429
    assert refused.headers["X-Error-Code"] == "upload_daily_limit"
    message = refused.json()["detail"]
    assert "3 recordings a day" in message and "tomorrow" in message
    # Even with a file already stored (the check is also made when publishing).
    world.settings.recording_uploads_per_day = 10
    key = await world.upload("a", mp3(170))
    world.settings.recording_uploads_per_day = 3
    late = await world.client.post(
        "/api/v1/recordings", headers=AS_A, json=world.body(key, title="One more")
    )
    assert late.status_code == 429 and late.headers["X-Error-Code"] == "upload_daily_limit"
    # Other members are not affected.
    assert (await world.publish("b", mp3(171), title="Mine")).status_code == 201


async def test_the_daily_allowance_counts_a_sliding_day_and_removed_recordings(
    world: World,
) -> None:
    world.settings.recording_uploads_per_day = 2
    first = (await world.publish("a", mp3(180), title="One")).json()
    await world.publish("a", mp3(181), title="Two")
    assert (await attempt(world, "a", mp3(182), title="Three")).status_code == 429
    # A removed recording still counts (removing does not give the slot back).
    await world.client.post(
        f"/api/v1/admin/recordings/{first['id']}/remove", json={"reason": "Not suitable"}
    )
    assert (await attempt(world, "a", mp3(183), title="Four")).status_code == 429
    # Older than 24 hours: the slot is free again.
    async with world.sessions() as session:
        rows = (
            await session.scalars(select(Recording).where(Recording.author_id == MEMBER_A))
        ).all()
        for row in rows:
            row.published_at = datetime.now(UTC) - timedelta(hours=25)
        await session.commit()
    assert (await world.publish("a", mp3(184), title="Five")).status_code == 201


async def test_the_default_allowance_is_twenty_and_can_be_set_from_the_environment() -> None:
    from app.config import Settings

    assert Settings.model_validate({}).recording_uploads_per_day == 20
    assert (
        Settings.model_validate({"RECORDING_UPLOADS_PER_DAY": "7"}).recording_uploads_per_day == 7
    )
    with pytest.raises(ValueError):
        Settings.model_validate({"RECORDING_UPLOADS_PER_DAY": "0"})


async def test_the_default_allowance_of_twenty_is_enforced(world: World) -> None:
    for n in range(20):
        service.limiter.reset()
        assert (await world.publish("a", mp3(200 + n), title=f"Chant {n}")).status_code == 201
    service.limiter.reset()
    over = await attempt(world, "a", mp3(230), title="Chant 21")
    assert over.status_code == 429 and "20 recordings a day" in over.json()["detail"]
