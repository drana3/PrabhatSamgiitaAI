"""One place that decides whether an upload may become a recording (docs/upload-validation.md).

Everything an upload sends is somebody else's bytes: the name, the claimed type, the size and the
file itself. This module checks them, cheaply and before any heavy tool (Chromaprint, ffmpeg) is
started, and in this order:

1. `check_request`: the name, the claimed type and the claimed size, before the file travels.
2. `check_head`: the first bytes. Programs, archives, documents, pictures and video are named and
   refused; only the audio formats we play pass (`sniff_audio`).
3. `check_file`: the whole stored file. Size, a container check per format that reads a bounded
   amount (a file cannot make us read gigabytes of header), and the length the file declares.
4. `check_duration`: the real length, after Chromaprint measured it.

Nothing here decodes audio. A file that passes still goes to ffmpeg with a fixed demuxer and a time
limit (`recording_loudness.ffmpeg_input_arguments`). A virus scan (ClamAV) can be added as a fifth
step: see "Planned" in the document. Every refusal is an `UploadRejected` with an HTTP status and
a plain message; the caller turns it into the answer and deletes the stored object.
"""

from __future__ import annotations

import re
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from app.services.recording_storage import extension_for, sniff_audio

# ---- the limits (one place each) -------------------------------------------------------------

MIN_FILE_BYTES = 512  # below this it is not a recording
MAX_NAME_CHARS = 255
HEAD_BYTES = 64
# Metadata a container may carry before the audio. Cover art is a few hundred KB; this is generous
# and still small enough that no tool downstream has to chew through a header bomb.
MAX_METADATA_BYTES = 8 * 1024 * 1024
MAX_BOXES = 4096  # top-level boxes / chunks / blocks walked per file
MAX_SAMPLE_RATE = 384_000
MAX_CHANNELS = 8
DEFAULT_MAX_DURATION_SEC = 4 * 3600

EXTENSIONS = {"mp3", "m4a", "aac", "wav", "ogg", "flac", "webm", "mp4", "opus", "oga"}
# A name that hides a program or a page behind an audio extension ("song.mp3.exe", "x.php.mp3").
DANGEROUS_PARTS = {
    "exe", "dll", "bat", "cmd", "com", "scr", "msi", "ps1", "vbs", "js", "jar", "apk", "app",
    "sh", "bash", "py", "pl", "rb", "php", "phtml", "asp", "aspx", "jsp", "html", "htm", "svg",
    "xml", "zip", "rar", "7z", "gz", "tar", "iso", "dmg", "lnk", "pdf", "doc", "docx", "xls",
}  # fmt: skip

# What the first bytes say about a file that is NOT audio: (prefix, what to call it).
_NOT_AUDIO: tuple[tuple[bytes, str], ...] = (
    (b"MZ", "a Windows program"),
    (b"\x7fELF", "a program"),
    (b"\xfe\xed\xfa\xce", "a program"),
    (b"\xfe\xed\xfa\xcf", "a program"),
    (b"\xce\xfa\xed\xfe", "a program"),
    (b"\xcf\xfa\xed\xfe", "a program"),
    (b"\xca\xfe\xba\xbe", "a program"),
    (b"#!", "a script"),
    (b"PK\x03\x04", "an archive (ZIP)"),
    (b"PK\x05\x06", "an archive (ZIP)"),
    (b"Rar!", "an archive (RAR)"),
    (b"7z\xbc\xaf\x27\x1c", "an archive (7z)"),
    (b"\x1f\x8b", "an archive (gzip)"),
    (b"BZh", "an archive (bzip2)"),
    (b"\xfd7zXZ\x00", "an archive (xz)"),
    (b"%PDF", "a document"),
    (b"\xd0\xcf\x11\xe0", "a document"),
    (b"{\\rtf", "a document"),
    (b"\x89PNG", "a picture"),
    (b"GIF8", "a picture"),
    (b"\xff\xd8\xff", "a picture"),
    (b"BM", "a picture"),
    (b"MThd", "a MIDI file"),
    (b"<?xml", "a web page or an XML file"),
    (b"<!DOCTYPE", "a web page"),
    (b"<html", "a web page"),
    (b"<svg", "a picture"),
    (b"<script", "a script"),
    (b"\x00\x00\x01\xba", "a video"),
    (b"\x00\x00\x01\xb3", "a video"),
    (b"FLV\x01", "a video"),
)

AUDIO_BRANDS = {b"M4A ", b"M4B ", b"M4P ", b"mp42", b"mp41", b"isom", b"iso2", b"dash", b"f4a "}


class UploadRejected(Exception):  # noqa: N818
    """The upload is refused. `status_code` and `message` are the answer to the member."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def _no(status_code: int, code: str, message: str) -> UploadRejected:
    return UploadRejected(status_code, code, message)


# ---- 1. the request --------------------------------------------------------------------------


def clean_file_name(name: str) -> str:
    """The name for logs and messages only. The stored key never uses it (it is a random id)."""
    return "".join(ch for ch in name if ch.isprintable() and ch not in "/\\")[:MAX_NAME_CHARS]


def check_file_name(name: str) -> None:
    if not name or len(name) > MAX_NAME_CHARS:
        raise _no(422, "bad_name", "The file name is empty or too long.")
    if "\x00" in name or any(ord(ch) < 32 or ord(ch) == 127 for ch in name):
        raise _no(422, "bad_name", "The file name has characters that are not allowed.")
    if "/" in name or "\\" in name or name.strip(". ") != name.strip():
        raise _no(422, "bad_name", "The file name must be a plain name, without a folder.")
    parts = [p.lower() for p in name.split(".")[1:]]
    if not parts or parts[-1] not in EXTENSIONS:
        raise _no(415, "bad_extension", "Send an MP3, M4A, WAV, OGG or FLAC file.")
    if any(p in DANGEROUS_PARTS for p in parts[:-1]):
        raise _no(415, "bad_extension", "This file name looks like it hides a program or a page.")


def check_request(*, file_name: str, content_type: str, size_bytes: int, max_bytes: int) -> str:
    """Before the file travels. Returns the extension to store it under."""
    check_file_name(file_name)
    extension = extension_for(content_type)
    if extension is None:
        raise _no(415, "bad_type", "Send an MP3, M4A, WAV, OGG or FLAC file.")
    if size_bytes < MIN_FILE_BYTES:
        raise _no(422, "too_small", "This file is too small to be a recording.")
    if size_bytes > max_bytes:
        limit_mb = max_bytes // (1024 * 1024)
        raise _no(413, "too_large", f"The file is larger than {limit_mb} MB.")
    return extension


# ---- 2. the first bytes ----------------------------------------------------------------------


def check_head(head: bytes) -> str:
    """The audio format named by the first bytes. Refuses anything that is not audio."""
    lowered = head[:16].lstrip().lower()
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        raise _no(422, "not_audio", "This looks like a picture, not an audio file.")
    for prefix, name in _NOT_AUDIO:
        if head.startswith(prefix) or (prefix[:1] == b"<" and lowered.startswith(prefix.lower())):
            raise _no(422, "not_audio", f"This looks like {name}, not an audio file.")
    fmt = sniff_audio(head)
    if fmt is None:
        raise _no(422, "not_audio", "This does not look like an audio file (MP3, M4A, WAV).")
    return fmt


# ---- 3. the whole file -----------------------------------------------------------------------


@dataclass(frozen=True)
class FileFacts:
    container: str
    declared_duration_sec: float | None = None


def _read(handle: BinaryIO, offset: int, size: int) -> bytes:
    handle.seek(offset)
    return handle.read(size)


def _mp3(handle: BinaryIO, size: int) -> FileFacts:
    head = _read(handle, 0, 10)
    offset = 0
    if head.startswith(b"ID3"):
        tag = (head[6] << 21) | (head[7] << 14) | (head[8] << 7) | head[9]
        if any(b & 0x80 for b in head[6:10]) or tag > MAX_METADATA_BYTES:
            raise _no(422, "bad_header", "This file's tag is too large to be a real recording.")
        offset = 10 + tag
    window = _read(handle, offset, 128 * 1024)
    for i in range(len(window) - 1):
        if window[i] == 0xFF and (window[i + 1] & 0xE0) == 0xE0:
            return FileFacts("mp3")
    raise _no(422, "bad_container", "This MP3 file has no audio in it.")


def _mp4(handle: BinaryIO, size: int) -> FileFacts:
    offset = 0
    seen_ftyp = False
    seen_moov = False
    duration: float | None = None
    boxes = 0
    while offset + 8 <= size:
        boxes += 1
        if boxes > MAX_BOXES:
            raise _no(422, "bad_header", "This file has too many parts to be a real recording.")
        header = _read(handle, offset, 16)
        length, kind = struct.unpack(">I4s", header[:8])
        if length == 1:
            if len(header) < 16:
                break
            length = struct.unpack(">Q", header[8:16])[0]
        elif length == 0:
            length = size - offset
        if length < 8 or offset + length > size:
            raise _no(422, "bad_container", "This file is damaged or cut short.")
        if kind == b"ftyp":
            seen_ftyp = True
            brand = header[8:12]
            if brand not in AUDIO_BRANDS:
                raise _no(
                    422, "bad_container", "This is not an audio M4A file (it looks like video)."
                )
        elif kind == b"moov":
            seen_moov = True
            if length > MAX_METADATA_BYTES:
                raise _no(
                    422, "bad_header", "This file's header is too large to be a real recording."
                )
            body = _read(handle, offset + 8, length - 8)
            for match in re.finditer(b"hdlr", body):
                handler = body[match.start() + 12 : match.start() + 16]
                if handler == b"vide":
                    raise _no(422, "bad_container", "This file has a video track. Send audio only.")
            pos = body.find(b"mvhd")
            if pos >= 0:
                version = body[pos + 4]
                if version == 1 and len(body) >= pos + 36:
                    scale, dur = struct.unpack(">IQ", body[pos + 24 : pos + 36])
                elif len(body) >= pos + 24:
                    scale, dur = struct.unpack(">II", body[pos + 16 : pos + 24])
                else:
                    scale, dur = 0, 0
                if scale:
                    duration = dur / scale
        offset += length
    if not seen_ftyp:
        raise _no(422, "bad_container", "This does not look like an M4A file.")
    if not seen_moov:
        raise _no(422, "bad_container", "This audio file is damaged or cut short.")
    return FileFacts("m4a", duration)


def _wav(handle: BinaryIO, size: int) -> FileFacts:
    head = _read(handle, 0, 12)
    if head[:4] != b"RIFF" or head[8:12] != b"WAVE":
        raise _no(422, "bad_container", "This does not look like a WAV file.")
    offset = 12
    fmt: tuple[int, int, int, int] | None = None
    chunks = 0
    while offset + 8 <= size:
        chunks += 1
        if chunks > MAX_BOXES:
            raise _no(422, "bad_header", "This file has too many parts to be a real recording.")
        chunk = _read(handle, offset, 8)
        ident, length = struct.unpack("<4sI", chunk)
        if ident == b"fmt ":
            body = _read(handle, offset + 8, 16)
            if len(body) < 16:
                break
            tag, channels, rate, byte_rate = struct.unpack("<HHII", body[:12])
            if tag not in (1, 3, 0xFFFE, 0x55):
                raise _no(422, "bad_container", "This WAV file uses a format we do not accept.")
            if not 1 <= channels <= MAX_CHANNELS or not 1 <= rate <= MAX_SAMPLE_RATE:
                raise _no(422, "bad_container", "This WAV file has unusual audio settings.")
            fmt = (tag, channels, rate, byte_rate)
        elif ident == b"data":
            if fmt is None:
                raise _no(422, "bad_container", "This WAV file is damaged.")
            length = min(length, size - offset - 8)
            duration = length / fmt[3] if fmt[3] else None
            return FileFacts("wav", duration)
        elif length > MAX_METADATA_BYTES and ident != b"data":
            raise _no(422, "bad_header", "This file's header is too large to be a real recording.")
        offset += 8 + length + (length & 1)
    raise _no(422, "bad_container", "This WAV file has no audio in it.")


def _flac(handle: BinaryIO, size: int) -> FileFacts:
    if _read(handle, 0, 4) != b"fLaC":
        raise _no(422, "bad_container", "This does not look like a FLAC file.")
    offset = 4
    blocks = 0
    metadata = 0
    duration: float | None = None
    while offset + 4 <= size:
        blocks += 1
        header = _read(handle, offset, 4)
        last = bool(header[0] & 0x80)
        kind = header[0] & 0x7F
        length = int.from_bytes(header[1:4], "big")
        metadata += length
        if blocks > 128 or metadata > MAX_METADATA_BYTES:
            raise _no(422, "bad_header", "This file's header is too large to be a real recording.")
        if blocks == 1:
            if kind != 0 or length != 34:
                raise _no(422, "bad_container", "This FLAC file is damaged.")
            info = _read(handle, offset + 4, 34)
            packed = int.from_bytes(info[10:18], "big")
            rate = packed >> 44
            channels = ((packed >> 41) & 0x7) + 1
            samples = packed & ((1 << 36) - 1)
            if not 1 <= rate <= MAX_SAMPLE_RATE or channels > MAX_CHANNELS:
                raise _no(422, "bad_container", "This FLAC file has unusual audio settings.")
            duration = samples / rate if samples else None
        offset += 4 + length
        if last:
            return FileFacts("flac", duration)
    raise _no(422, "bad_container", "This FLAC file is damaged or cut short.")


def _ogg(handle: BinaryIO, size: int) -> FileFacts:
    head = _read(handle, 0, 512)
    if not head.startswith(b"OggS") or head[4] != 0:
        raise _no(422, "bad_container", "This does not look like an OGG file.")
    if b"theora" in head or b"\x80theora" in head or b"dirac" in head:
        raise _no(422, "bad_container", "This file has a video track. Send audio only.")
    if not any(tag in head for tag in (b"OpusHead", b"\x01vorbis", b"\x7fFLAC", b"Speex")):
        raise _no(422, "bad_container", "This OGG file has no audio we accept.")
    return FileFacts("ogg")


def _webm(handle: BinaryIO, size: int) -> FileFacts:
    head = _read(handle, 0, 16 * 1024)
    if b"webm" not in head[:64] and b"matroska" not in head[:64]:
        raise _no(422, "bad_container", "This does not look like an audio WebM file.")
    if re.search(rb"V_(VP8|VP9|AV1|MPEG|MS|UNCOMP|THEORA)", head):
        raise _no(422, "bad_container", "This file has a video track. Send audio only.")
    return FileFacts("webm")


def _aac(handle: BinaryIO, size: int) -> FileFacts:
    return FileFacts("aac")


_CONTAINERS = {
    "mp3": _mp3,
    "m4a": _mp4,
    "wav": _wav,
    "flac": _flac,
    "ogg": _ogg,
    "webm": _webm,
    "aac": _aac,
}


def check_file(path: Path, *, max_bytes: int, max_duration_sec: float) -> tuple[str, FileFacts]:
    """The whole stored file: size, first bytes, container, declared length. Returns the format."""
    size = path.stat().st_size
    if size < MIN_FILE_BYTES:
        raise _no(422, "too_small", "This file is too small to be a recording.")
    if size > max_bytes:
        raise _no(413, "too_large", "The audio file is too large.")
    with path.open("rb") as handle:
        fmt = check_head(handle.read(HEAD_BYTES))
        handle.seek(0)
        try:
            facts = _CONTAINERS[fmt](handle, size)
        except (struct.error, IndexError, OSError) as exc:
            raise _no(422, "bad_container", "This audio file is damaged.") from exc
    if facts.declared_duration_sec is not None and facts.declared_duration_sec > max_duration_sec:
        raise _no(422, "too_long", _too_long(max_duration_sec))
    return fmt, facts


# ---- 4. the measured length ------------------------------------------------------------------


def _too_long(max_duration_sec: float) -> str:
    hours = max_duration_sec / 3600
    return f"This recording is longer than {hours:g} hours."


def check_duration(duration_sec: float | None, *, max_duration_sec: float) -> None:
    """After Chromaprint measured the real length (None when it could not: nothing to check)."""
    if duration_sec is not None and duration_sec > max_duration_sec:
        raise _no(422, "too_long", _too_long(max_duration_sec))
