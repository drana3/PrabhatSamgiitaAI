"""Upload validation: names, first bytes, containers, lengths (docs/upload-validation.md)."""

# ruff: noqa: F811
from __future__ import annotations

import os
import struct
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
from sqlalchemy import select
from test_recordings import World, mp3, world  # noqa: F401

from app.models.recordings import Recording
from app.services import upload_validation as uv
from app.services.upload_validation import UploadRejected

MAX = 60 * 1024 * 1024
HOUR = 3600


# ---- builders: the smallest files that look like the real thing -------------------------------


def box(kind: bytes, body: bytes) -> bytes:
    return struct.pack(">I4s", 8 + len(body), kind) + body


def mvhd(seconds: int = 10, scale: int = 1000) -> bytes:
    times = bytes(8) + struct.pack(">II", scale, seconds * scale)
    return box(b"mvhd", bytes(4) + times + bytes(80))


def hdlr(handler: bytes) -> bytes:
    return box(b"hdlr", bytes(4) + bytes(4) + handler + bytes(12))


def m4a(
    brand: bytes = b"M4A ", *, handler: bytes = b"soun", seconds: int = 10, pad: int = 800
) -> bytes:
    ftyp = box(b"ftyp", brand + bytes(4) + brand)
    moov = box(b"moov", mvhd(seconds) + box(b"trak", hdlr(handler)))
    return ftyp + moov + box(b"mdat", bytes(pad))


def wav(*, tag: int = 1, channels: int = 1, rate: int = 8000, pad: int = 0) -> bytes:
    byte_rate = rate * channels * 2
    data = bytes(max(pad, 600))
    fmt = b"fmt " + struct.pack("<IHHIIHH", 16, tag, channels, rate, byte_rate, 2, 16)
    body = b"WAVE" + fmt + b"data" + struct.pack("<I", len(data)) + data
    return b"RIFF" + struct.pack("<I", len(body)) + body


def flac(
    *, samples: int = 48000, rate: int = 48000, channels: int = 2, extra_block: int = 0
) -> bytes:
    packed = (rate << 44) | ((channels - 1) << 41) | (15 << 36) | samples
    info = bytes(10) + packed.to_bytes(8, "big") + bytes(16)
    first = bytes([0x00 if extra_block else 0x80]) + (34).to_bytes(3, "big") + info
    blocks = first
    if extra_block:
        blocks += bytes([0x86]) + extra_block.to_bytes(3, "big")  # a PICTURE block, the last
    return b"fLaC" + blocks + bytes(600)


def ogg(codec: bytes = b"OpusHead") -> bytes:
    return b"OggS\x00\x02" + bytes(20) + codec + bytes(600)


def webm(codec: bytes = b"A_OPUS", doctype: bytes = b"webm") -> bytes:
    return b"\x1a\x45\xdf\xa3" + bytes(8) + b"B\x82" + doctype + bytes(20) + codec + bytes(600)


def write(tmp_path: Path, data: bytes, name: str = "audio") -> Path:
    path = tmp_path / name
    path.write_bytes(data)
    return path


def refused(tmp_path: Path, data: bytes, *, max_duration: float = 4 * HOUR) -> UploadRejected:
    with pytest.raises(UploadRejected) as caught:
        uv.check_file(write(tmp_path, data), max_bytes=MAX, max_duration_sec=max_duration)
    return caught.value


# ---- 1. the request ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "name", ["song.mp3", "Baba Nam Kevalam (1).M4A", "a.b.c.wav", "x.flac", "voice.opus", "ü.mp3"]
)
def test_ordinary_names_pass(name: str) -> None:
    uv.check_file_name(name)


@pytest.mark.parametrize(
    ("name", "status"),
    [
        ("", 422),
        ("a" * 300 + ".mp3", 422),
        ("bad\x00name.mp3", 422),
        ("line\nbreak.mp3", 422),
        ("../../etc/passwd.mp3", 422),
        ("folder/x.mp3", 422),
        ("folder\\x.mp3", 422),
        ("noextension", 415),
        ("song.txt", 415),
        ("song.mp3.exe", 415),
        ("song.exe.mp3", 415),
        ("page.html.mp3", 415),
        ("photo.svg.wav", 415),
        ("backup.zip.m4a", 415),
        ("shell.php.mp3", 415),
    ],
)
def test_dangerous_or_odd_names_are_refused(name: str, status: int) -> None:
    with pytest.raises(UploadRejected) as caught:
        uv.check_file_name(name)
    assert caught.value.status_code == status


def _ask(name: str, content_type: str, size: int) -> str:
    return uv.check_request(
        file_name=name, content_type=content_type, size_bytes=size, max_bytes=MAX
    )


def test_the_request_checks_type_and_size() -> None:
    assert _ask("a.mp3", "audio/mpeg", 2000) == "mp3"
    with pytest.raises(UploadRejected) as caught:
        _ask("a.mp4", "video/mp4", 2000)
    assert (caught.value.status_code, caught.value.code) == (415, "bad_type")
    with pytest.raises(UploadRejected) as caught:
        _ask("a.mp3", "audio/mpeg", 10)
    assert caught.value.code == "too_small"
    with pytest.raises(UploadRejected) as caught:
        _ask("a.mp3", "audio/mpeg", MAX + 1)
    assert caught.value.status_code == 413 and "60 MB" in caught.value.message


def test_a_file_name_for_the_log_has_no_control_characters_or_folders() -> None:
    assert uv.clean_file_name("a/b\\c\x00d\n.mp3") == "abcd.mp3"


# ---- 2. the first bytes -----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("head", "word"),
    [
        (b"MZ\x90\x00" + bytes(60), "program"),
        (b"\x7fELF" + bytes(60), "program"),
        (b"\xcf\xfa\xed\xfe" + bytes(60), "program"),
        (b"\xca\xfe\xba\xbe" + bytes(60), "program"),
        (b"#!/bin/sh\nrm -rf /", "script"),
        (b"PK\x03\x04" + bytes(60), "ZIP"),
        (b"Rar!\x1a\x07\x00" + bytes(60), "RAR"),
        (b"7z\xbc\xaf\x27\x1c" + bytes(60), "7z"),
        (b"\x1f\x8b\x08" + bytes(60), "gzip"),
        (b"%PDF-1.7" + bytes(60), "document"),
        (b"\x89PNG\r\n\x1a\n" + bytes(60), "picture"),
        (b"GIF89a" + bytes(60), "picture"),
        (b"\xff\xd8\xff\xe0" + bytes(60), "picture"),
        (b"RIFF\x00\x00\x00\x00WEBPVP8 " + bytes(60), "picture"),
        (b"  <?xml version", "web page"),
        (b"<!DOCTYPE html>", "web page"),
        (b"<HTML><body>", "web page"),
        (b"<svg xmlns=", "picture"),
        (b"<script>alert(1)</script>", "script"),
        (b"MThd\x00\x00\x00\x06", "MIDI"),
    ],
)
def test_things_that_are_not_audio_are_named(head: bytes, word: str) -> None:
    with pytest.raises(UploadRejected) as caught:
        uv.check_head(head)
    assert caught.value.code == "not_audio" and word in caught.value.message


@pytest.mark.parametrize(
    ("head", "fmt"),
    [
        (b"ID3\x04" + bytes(60), "mp3"),
        (b"\xff\xfb\x90\x00" + bytes(60), "mp3"),
        (b"\xff\xf1\x50\x80" + bytes(60), "aac"),
        (b"\x00\x00\x00\x20ftypM4A " + bytes(52), "m4a"),
        (b"RIFF\x00\x00\x00\x00WAVEfmt " + bytes(48), "wav"),
        (b"OggS" + bytes(60), "ogg"),
        (b"fLaC" + bytes(60), "flac"),
        (b"\x1a\x45\xdf\xa3" + bytes(60), "webm"),
    ],
)
def test_the_audio_formats_pass_the_first_bytes(head: bytes, fmt: str) -> None:
    assert uv.check_head(head) == fmt


def test_unknown_bytes_are_refused() -> None:
    with pytest.raises(UploadRejected):
        uv.check_head(b"random bytes here" + bytes(40))


# ---- 3. the containers: good ones pass --------------------------------------------------------


@pytest.mark.parametrize(
    ("data", "fmt"),
    [
        (mp3(1), "mp3"),
        (m4a(), "m4a"),
        (m4a(b"isom"), "m4a"),
        (m4a(b"mp42"), "m4a"),
        (wav(), "wav"),
        (wav(tag=0xFFFE, channels=2, rate=48000), "wav"),
        (flac(), "flac"),
        (ogg(), "ogg"),
        (ogg(b"\x01vorbis"), "ogg"),
        (webm(), "webm"),
        (b"\xff\xf1\x50\x80" + bytes(700), "aac"),
    ],
)
def test_ordinary_files_pass(tmp_path: Path, data: bytes, fmt: str) -> None:
    got, _ = uv.check_file(write(tmp_path, data), max_bytes=MAX, max_duration_sec=4 * HOUR)
    assert got == fmt


def test_the_declared_length_is_read(tmp_path: Path) -> None:
    def facts(data: bytes) -> uv.FileFacts:
        return uv.check_file(write(tmp_path, data), max_bytes=MAX, max_duration_sec=HOUR)[1]

    assert facts(m4a(seconds=95)).declared_duration_sec == 95
    wav_seconds = facts(wav(rate=8000, pad=16000)).declared_duration_sec
    assert wav_seconds is not None and wav_seconds == pytest.approx(1.0, rel=0.05)
    assert facts(flac(samples=48000 * 60)).declared_duration_sec == 60


# ---- 3. the containers: bad ones are refused --------------------------------------------------


def test_a_tiny_or_huge_file_is_refused(tmp_path: Path) -> None:
    assert refused(tmp_path, b"ID3\x04" + bytes(10)).code == "too_small"
    path = write(tmp_path, mp3(1))
    with pytest.raises(UploadRejected) as caught:
        uv.check_file(path, max_bytes=100, max_duration_sec=HOUR)
    assert caught.value.status_code == 413


def test_an_mp3_with_a_giant_tag_is_a_header_bomb(tmp_path: Path) -> None:
    huge = b"ID3\x04\x00\x00" + bytes([0x7F, 0x7F, 0x7F, 0x7F]) + bytes(2000)  # a 256 MB tag
    assert refused(tmp_path, huge).code == "bad_header"
    unsafe = b"ID3\x04\x00\x00" + bytes([0x80, 0, 0, 0]) + bytes(2000)  # not a valid size at all
    assert refused(tmp_path, unsafe).code == "bad_header"


def test_an_mp3_with_no_audio_in_it_is_refused(tmp_path: Path) -> None:
    empty = b"ID3\x04\x00\x00\x00\x00\x00\x00" + bytes(1000)
    assert refused(tmp_path, empty).code == "bad_container"


def test_video_in_an_mp4_wrapper_is_refused(tmp_path: Path) -> None:
    assert refused(tmp_path, m4a(b"qt  ")).code == "bad_container"
    video = refused(tmp_path, m4a(b"isom", handler=b"vide"))
    assert video.code == "bad_container" and "video" in video.message


def test_an_mp4_cannot_claim_more_than_the_file_holds(tmp_path: Path) -> None:
    broken = struct.pack(">I", 10_000_000) + m4a()[4:]  # the first box says it is 10 MB
    assert refused(tmp_path, broken).code == "bad_container"
    assert refused(tmp_path, box(b"free", bytes(900))).code == "not_audio"  # no ftyp at all


def test_a_giant_moov_is_a_header_bomb(tmp_path: Path) -> None:
    ftyp = box(b"ftyp", b"M4A " + bytes(4) + b"M4A ")
    declared = uv.MAX_METADATA_BYTES + 100
    moov = struct.pack(">I4s", 8 + declared, b"moov") + bytes(declared)
    assert refused(tmp_path, ftyp + moov).code == "bad_header"


def test_thousands_of_tiny_boxes_are_refused(tmp_path: Path) -> None:
    ftyp = box(b"ftyp", b"M4A " + bytes(4) + b"M4A ")
    many = box(b"free", b"") * (uv.MAX_BOXES + 10)
    assert refused(tmp_path, ftyp + many + bytes(600)).code == "bad_header"


def test_an_m4a_that_says_it_is_years_long_is_refused(tmp_path: Path) -> None:
    error = refused(tmp_path, m4a(seconds=10**6), max_duration=4 * HOUR)
    assert error.code == "too_long" and "4 hours" in error.message


def test_a_wav_with_odd_settings_is_refused(tmp_path: Path) -> None:
    assert refused(tmp_path, wav(tag=2)).code == "bad_container"  # ADPCM
    assert refused(tmp_path, wav(channels=64)).code == "bad_container"
    assert refused(tmp_path, wav(rate=10_000_000)).code == "bad_container"
    assert refused(tmp_path, b"RIFF\x00\x00\x00\x00WAVE" + bytes(900)).code == "bad_container"


def test_a_wav_that_declares_a_huge_length_is_too_long(tmp_path: Path) -> None:
    data = bytearray(wav(rate=100, channels=1))
    pos = data.index(b"data")
    data[pos + 4 : pos + 8] = struct.pack("<I", 4_000_000_000)
    # the length is capped at what the file holds, so this is not a way to fake a long file;
    # a genuinely long one is refused by the measured length instead
    assert uv.check_file(write(tmp_path, bytes(data)), max_bytes=MAX, max_duration_sec=HOUR)[0]
    long_one = wav(rate=1, channels=1, pad=10_000)
    assert refused(tmp_path, long_one, max_duration=60).code == "too_long"


def test_a_wav_with_a_giant_chunk_before_the_format_is_a_header_bomb(tmp_path: Path) -> None:
    body = b"WAVE" + b"LIST" + struct.pack("<I", 1_000_000_000) + bytes(900)
    assert refused(tmp_path, b"RIFF" + struct.pack("<I", len(body)) + body).code == "bad_header"


def test_a_flac_with_a_giant_picture_block_is_a_header_bomb(tmp_path: Path) -> None:
    assert refused(tmp_path, flac(extra_block=9_000_000)).code == "bad_header"
    assert refused(tmp_path, b"fLaC" + bytes([0x80, 0, 0, 5]) + bytes(900)).code == "bad_container"


def test_a_flac_with_odd_settings_is_refused(tmp_path: Path) -> None:
    assert refused(tmp_path, flac(rate=1_000_000)).code == "bad_container"


def test_video_in_ogg_and_webm_is_refused(tmp_path: Path) -> None:
    assert refused(tmp_path, ogg(b"\x80theora")).code == "bad_container"
    assert refused(tmp_path, ogg(b"unknown")).code == "bad_container"
    assert refused(tmp_path, webm(b"V_VP9")).code == "bad_container"
    assert refused(tmp_path, webm(doctype=b"mp4x")).code == "bad_container"


def test_a_cut_short_file_is_refused_not_crashed(tmp_path: Path) -> None:
    whole = m4a(pad=2000)
    for cut in (600, 900, 1500):
        error = refused(tmp_path, whole[:cut])
        assert error.code == "bad_container"
    # a file with no movie header at all is not playable audio
    no_moov = box(b"ftyp", b"M4A " + bytes(4) + b"M4A ") + box(b"mdat", bytes(2000))
    assert refused(tmp_path, no_moov).code == "bad_container"


# ---- 4. the measured length -------------------------------------------------------------------


def test_the_measured_length_is_checked_when_there_is_one() -> None:
    uv.check_duration(None, max_duration_sec=HOUR)
    uv.check_duration(HOUR, max_duration_sec=HOUR)
    with pytest.raises(UploadRejected) as caught:
        uv.check_duration(HOUR + 1, max_duration_sec=HOUR)
    assert caught.value.code == "too_long" and "1 hours" in caught.value.message


# ---- through the real upload flow -------------------------------------------------------------


async def test_the_upload_request_refuses_a_program_wearing_an_audio_name(world: World) -> None:
    sent = await world.client.post(
        "/api/v1/recordings/uploads",
        headers={"X-Test-Member": "a"},
        json={"file_name": "song.mp3.exe", "content_type": "audio/mpeg", "size_bytes": 5000},
    )
    assert sent.status_code == 415
    assert sent.headers["X-Error-Code"] == "bad_extension"


async def test_the_local_upload_refuses_a_program_before_it_is_stored(world: World) -> None:
    target = (
        await world.client.post(
            "/api/v1/recordings/uploads",
            headers={"X-Test-Member": "a"},
            json={"file_name": "x.mp3", "content_type": "audio/mpeg", "size_bytes": 5000},
        )
    ).json()
    path = "/" + target["url"].split("://", 1)[1].split("/", 1)[1]
    program = b"MZ\x90\x00" + bytes(4000)
    put = await world.client.put(path, content=program, headers=target["headers"])
    assert put.status_code == 422 and put.headers["X-Error-Code"] == "not_audio"
    assert "program" in put.json()["detail"]


async def test_publishing_refuses_and_deletes_a_file_with_a_bad_container(world: World) -> None:
    """The first bytes pass (it says ID3) but the tag is a header bomb: refused at publish."""
    bomb = b"ID3\x04\x00\x00" + bytes([0x7F, 0x7F, 0x7F, 0x7F]) + b"FP=1;" + bytes(2000)
    key = await world.upload("a", bomb)
    assert await world.storage.size(key) is not None
    answer = await world.client.post(
        "/api/v1/recordings", headers={"X-Test-Member": "a"}, json=world.body(key)
    )
    assert answer.status_code == 422
    assert answer.headers["X-Error-Code"] == "bad_header"
    assert await world.storage.size(key) is None  # the object is gone
    assert await world.scalar(select(Recording.id)) is None


async def test_publishing_refuses_a_recording_that_is_too_long(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(world.settings, "recording_max_duration_seconds", 60)
    key = await world.upload("a", m4a(seconds=3600), content_type="audio/mp4")
    answer = await world.client.post(
        "/api/v1/recordings", headers={"X-Test-Member": "a"}, json=world.body(key)
    )
    assert answer.status_code == 422 and answer.headers["X-Error-Code"] == "too_long"


async def test_an_ordinary_file_is_still_published(world: World) -> None:
    published = await world.publish("a", mp3(9))
    assert published.status_code == 201, published.text
