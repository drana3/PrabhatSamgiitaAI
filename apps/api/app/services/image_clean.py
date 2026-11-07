"""Pictures people upload: what kind they are, and the metadata taken out of them.

Used for the cover of a playlist (and any later picture the same rules fit). The phone makes the
picture small and re-encodes it, which already drops the camera's metadata; the server does not
trust that, so JPEG, PNG and WebP are walked here and every block that can carry a location, a
device or a name is cut out: the Exif block (GPS lives there), XMP, IPTC, text chunks and comments.
Pixels are never touched, so no image library is needed.
"""

from __future__ import annotations

import struct

PHOTO_MAX_BYTES = 300 * 1024


class ImageError(ValueError):
    """The bytes are not a picture this app takes. `code` is a short machine word."""

    def __init__(self, code: str, status: int = 422, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code
        self.status = status
        self.message = message or code


def sniff_image(data: bytes) -> str | None:
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _strip_jpeg(data: bytes) -> bytes:
    """Keep the picture and its colour profile; drop Exif and XMP (APP1), IPTC (APP13), the other
    application blocks (APP3 to APP15, and APP2 unless it is the ICC profile) and comments."""
    out = bytearray(data[:2])
    pos = 2
    while pos + 4 <= len(data):
        if data[pos] != 0xFF:
            raise ImageError("photo_corrupt", 422, "This picture is damaged.")
        marker = data[pos + 1]
        if marker == 0xFF:  # fill byte
            pos += 1
            continue
        if marker == 0xDA:  # start of scan: the rest is pixels
            out += data[pos:]
            return bytes(out)
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            out += data[pos : pos + 2]
            pos += 2
            continue
        (length,) = struct.unpack(">H", data[pos + 2 : pos + 4])
        if length < 2 or pos + 2 + length > len(data):
            raise ImageError("photo_corrupt", 422, "This picture is damaged.")
        segment = data[pos : pos + 2 + length]
        body = segment[4:]
        keep = True
        if marker == 0xFE or marker == 0xED or marker == 0xE1:
            keep = False
        elif 0xE3 <= marker <= 0xEF:
            keep = False
        elif marker == 0xE2 and not body.startswith(b"ICC_PROFILE"):
            keep = False
        if keep:
            out += segment
        pos += 2 + length
    return bytes(out)


_PNG_DROP = {b"eXIf", b"tEXt", b"zTXt", b"iTXt", b"tIME"}


def _strip_png(data: bytes) -> bytes:
    out = bytearray(data[:8])
    pos = 8
    while pos + 12 <= len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        kind = data[pos + 4 : pos + 8]
        end = pos + 12 + length
        if end > len(data):
            raise ImageError("photo_corrupt", 422, "This picture is damaged.")
        if kind not in _PNG_DROP:
            out += data[pos:end]
        pos = end
    return bytes(out)


def _strip_webp(data: bytes) -> bytes:
    """Drop the EXIF and XMP chunks, clear their flags in VP8X, and fix the RIFF size."""
    body = bytearray()
    pos = 12
    while pos + 8 <= len(data):
        kind = data[pos : pos + 4]
        (length,) = struct.unpack("<I", data[pos + 4 : pos + 8])
        end = pos + 8 + length + (length & 1)
        if pos + 8 + length > len(data):
            raise ImageError("photo_corrupt", 422, "This picture is damaged.")
        chunk = bytearray(data[pos : min(end, len(data))])
        if kind in (b"EXIF", b"XMP "):
            pos = end
            continue
        if kind == b"VP8X" and len(chunk) >= 9:
            chunk[8] &= ~(0x08 | 0x04)  # EXIF and XMP flags
        body += chunk
        pos = end
    return b"RIFF" + struct.pack("<I", len(body) + 4) + b"WEBP" + bytes(body)


def clean_image(data: bytes) -> tuple[str, bytes]:
    """The mime type and the bytes without metadata. Raises ImageError for empty, too big or not a
    JPEG, PNG or WebP."""
    if not data:
        raise ImageError("photo_empty", 422, "Choose a picture.")
    if len(data) > PHOTO_MAX_BYTES:
        raise ImageError("photo_too_big", 413, "The picture is too big.")
    mime = sniff_image(data)
    if mime is None:
        raise ImageError("photo_type", 415, "Use a JPEG, PNG or WebP picture.")
    if mime == "image/jpeg":
        return mime, _strip_jpeg(data)
    if mime == "image/png":
        return mime, _strip_png(data)
    return mime, _strip_webp(data)
