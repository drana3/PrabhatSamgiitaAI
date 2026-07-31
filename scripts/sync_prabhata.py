from __future__ import annotations

import html
import json
import re
import subprocess
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

BASE_URL = "https://prabhatasamgiita.net"
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
DATA_DIR = ROOT_DIR / "data"
GENERATED_DIR = DATA_DIR / "generated"

LYRICS_PAGE = "/1-5018.htm"
AUDIO_ARCHIVE_PAGES = [
    "/1-999/andromeda.php",
    "/1000-1999/andromeda.php",
    "/2000-2999/andromeda.php",
    "/3000-3999/andromeda.php",
    "/4000-5018/andromeda.php",
]
NOTATION_ARCHIVE_PAGE = "/notations/andromeda.php"
SITE_PAGES = [
    "/",
    "/index.html",
    "/listings.html",
    "/links.html",
    "/stories.html",
    "/resources.html",
    "/rawa.html",
    "/song-search.html",
    "/themes.html",
    "/audio-files.html",
    "/more-about.html",
    "/various.html",
    "/contact-form.html",
    "/prsarkar.html",
    "/numerical.html",
    "/romansanskrit.html",
    "/roman.html",
    "/bangla/index.html",
    "/bangla/listing.html",
    LYRICS_PAGE,
    NOTATION_ARCHIVE_PAGE,
    *AUDIO_ARCHIVE_PAGES,
]

SONG_SECTION_RE = re.compile(
    r'<A NAME="(?P<anchor>[^"]+)">\s*</A>\s*<H4>(?P<header>.*?)</H4>\s*(?P<body>.*?)(?=(?:<A NAME="|</BODY>))',
    re.IGNORECASE | re.DOTALL,
)
PARAGRAPH_RE = re.compile(r"<P>(.*?)</P>", re.IGNORECASE | re.DOTALL)


@dataclass(slots=True)
class Resource:
    source_kind: str
    title: str
    url: str
    status: str = "active"
    metadata_json: dict[str, Any] | None = None
    notes: str | None = None


@dataclass(slots=True)
class SongRecord:
    number: int
    title: str
    first_line: str | None = None
    lyrics_original: str | None = None
    transliteration: str | None = None
    hindi_meaning: str | None = None
    english_meaning: str | None = None
    theme: str | None = None
    occasion: str | None = None
    festival: str | None = None
    season: str | None = None
    mood: str | None = None
    language: str | None = "Roman"
    difficulty: str | None = None
    meditation_context: str | None = None
    raga: str | None = None
    tala: str | None = None
    harmonium_notation: str | None = None
    canonical_source_url: str | None = LYRICS_PAGE
    canonical_source_status: str = "verified"
    is_verified: bool = True
    metadata_json: dict[str, Any] = field(default_factory=dict)


def fetch(url: str) -> str:
    completed = subprocess.run(
        [
            "curl",
            "-L",
            "--compressed",
            "--fail",
            "--silent",
            "--show-error",
            "-A",
            "Mozilla/5.0",
            url,
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return completed.stdout


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def html_to_lines(fragment: str) -> list[str]:
    fragment = re.sub(r"(?i)<br\s*/?>", "\n", fragment)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    lines: list[str] = []
    for raw_line in html.unescape(fragment).splitlines():
        line = clean(raw_line)
        if not line:
            continue
        if re.fullmatch(r"\.+", line):
            continue
        lines.append(line)
    return lines


def parse_song_header(header: str, anchor: str) -> tuple[int, dict[str, str]]:
    cleaned = clean(header)
    match = re.match(r"(?P<number>\d+)\s+\((?P<date>[^)]+)\)\s*(?P<category>.*)", cleaned)
    if match:
        return int(match.group("number")), {
            "date": match.group("date").strip(),
            "category": match.group("category").strip(),
            "anchor": anchor.strip(),
        }
    fallback = re.match(r"(?P<number>\d+)", anchor)
    if fallback:
        return int(fallback.group("number")), {"anchor": anchor}
    raise ValueError(f"Could not parse song header: {header!r}")


def is_roman_lyric_line(line: str) -> bool:
    return bool(line) and not re.search(r"[a-z]", line)


def split_song_sections(paragraphs: list[list[str]]) -> tuple[list[str], list[str], list[str]]:
    if not paragraphs:
        return [], [], []
    first_paragraph = paragraphs[0]
    lyric_prefix: list[str] = []
    for line in first_paragraph:
        if is_roman_lyric_line(line):
            lyric_prefix.append(line)
            continue
        break
    remainder = first_paragraph[len(lyric_prefix) :] + [line for paragraph in paragraphs[1:] for line in paragraph]
    purport_index = next(
        (idx for idx, line in enumerate(remainder) if line.lower().startswith("purport:")),
        None,
    )
    if purport_index is None:
        return lyric_prefix, remainder, []
    return lyric_prefix, remainder[:purport_index], remainder[purport_index + 1 :]


def parse_lyrics_page() -> list[SongRecord]:
    return parse_song_page(LYRICS_PAGE)


def parse_song_page(page_path: str) -> list[SongRecord]:
    html_text = fetch(urljoin(BASE_URL, page_path))
    songs: list[SongRecord] = []
    for match in SONG_SECTION_RE.finditer(html_text):
        anchor = match.group("anchor")
        number, metadata = parse_song_header(match.group("header"), anchor)
        paragraphs = [html_to_lines(block) for block in PARAGRAPH_RE.findall(match.group("body"))]
        paragraphs = [paragraph for paragraph in paragraphs if paragraph]
        if not paragraphs:
            continue
        lyrics_lines, english_lines, purport_lines = split_song_sections(paragraphs)
        first_line = lyrics_lines[0] if lyrics_lines else None
        songs.append(
            SongRecord(
                number=number,
                title=first_line or f"Song {number}",
                first_line=first_line,
                lyrics_original="\n".join(lyrics_lines) or None,
                english_meaning="\n".join(english_lines) or None,
                metadata_json={
                    "source": "official-lyrics-page",
                    **metadata,
                    "purport": "\n".join(purport_lines) or None,
                },
            )
        )
    songs.sort(key=lambda item: item.number)
    return songs


def parse_missing_song(number: int) -> SongRecord | None:
    page_path = f"/lyrics/ps_{number}.htm"
    try:
        songs = parse_song_page(page_path)
    except subprocess.CalledProcessError:
        return None
    for song in songs:
        if song.number == number:
            song.metadata_json = {
                **song.metadata_json,
                "source": "official-single-song-page",
                "source_page": page_path,
            }
            return song
    return songs[0] if songs else None


def parse_archive_page(page_path: str) -> list[Resource]:
    html_text = fetch(urljoin(BASE_URL, page_path))
    soup = BeautifulSoup(html_text, "html.parser")
    resources: list[Resource] = []
    archive_name = page_path.strip("/").split("/")[0]
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        absolute = urljoin(BASE_URL, href)
        text = clean(anchor.get_text(" ", strip=True))
        if not text:
            text = Path(urlparse(absolute).path).name or absolute
        metadata: dict[str, Any] = {"discovered_from": page_path, "archive": archive_name}
        if absolute.lower().endswith(".mp3"):
            kind = "audio"
            provider = "official"
            notes = f"Official MP3 from the {archive_name} archive"
            if "old version" in text.lower():
                metadata["version"] = "old"
            resources.append(
                Resource(
                    source_kind=kind,
                    title=text,
                    url=absolute,
                    status="active",
                    metadata_json={
                        **metadata,
                        "provider": provider,
                    },
                    notes=notes,
                )
            )
        elif absolute.lower().endswith(".pdf"):
            resources.append(
                Resource(
                    source_kind="notation",
                    title=text,
                    url=absolute,
                    status="active",
                    metadata_json=metadata,
                    notes=f"Official notation PDF from the {archive_name} archive",
                )
            )
    return resources


def parse_song_audio_title(text: str) -> tuple[int | None, str, dict[str, Any]]:
    cleaned = clean(text)
    match = re.match(r"(?P<number>\d+)\s+(?P<title>.*?)(?:\s+\(old version\))?$", cleaned)
    metadata: dict[str, Any] = {}
    if match:
        number = int(match.group("number"))
        title = match.group("title").strip()
        if "(old version)" in cleaned.lower():
            metadata["version"] = "old"
        return number, title, metadata
    return None, cleaned, metadata


def parse_audio_media() -> list[dict[str, Any]]:
    media: list[dict[str, Any]] = []
    for page_path in AUDIO_ARCHIVE_PAGES:
        html_text = fetch(urljoin(BASE_URL, page_path))
        soup = BeautifulSoup(html_text, "html.parser")
        archive_name = page_path.strip("/").split("/")[0]
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"].strip()
            absolute = urljoin(BASE_URL, href)
            if not absolute.lower().endswith(".mp3"):
                continue
            text = clean(anchor.get_text(" ", strip=True))
            number, title, extra_metadata = parse_song_audio_title(text)
            media.append(
                {
                    "song_number": number,
                    "kind": "audio",
                    "provider": "official",
                    "title": title,
                    "url": absolute,
                    "embed_url": absolute,
                    "verification_status": "verified",
                    "source_url": urljoin(BASE_URL, page_path),
                    "notes": f"Official MP3 from the {archive_name} archive"
                    + (" (old version)" if extra_metadata.get("version") == "old" else ""),
                    "metadata_json": {
                        "archive": archive_name,
                        **extra_metadata,
                    },
                }
            )
    return media


def parse_notations() -> list[dict[str, Any]]:
    html_text = fetch(urljoin(BASE_URL, NOTATION_ARCHIVE_PAGE))
    soup = BeautifulSoup(html_text, "html.parser")
    notations: list[dict[str, Any]] = []
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        absolute = urljoin(BASE_URL, href)
        if not absolute.lower().endswith(".pdf"):
            continue
        text = clean(anchor.get_text(" ", strip=True))
        match = re.match(r"(?P<number>\d+)\s*-\s*\((?P<display_number>[^)]+)\)\s*(?P<title>.*)", text)
        song_number: int | None = None
        title = text
        metadata: dict[str, Any] = {"archive": "notations"}
        if match:
            song_number = int(match.group("number"))
            metadata["display_number"] = match.group("display_number")
            title = match.group("title").strip()
        else:
            alt = re.match(r"(?P<number>\d+)\s+(?P<title>.*)", text)
            if alt:
                song_number = int(alt.group("number"))
                title = alt.group("title").strip()
        notations.append(
            {
                "song_number": song_number or 0,
                "source_url": absolute,
                "notation_text": None,
                "scale": None,
                "verification_status": "verified",
                "metadata_json": {
                    **metadata,
                    "title": title,
                    "url": absolute,
                    "archive_url": urljoin(BASE_URL, NOTATION_ARCHIVE_PAGE),
                },
            }
        )
    return notations


def crawl_inventory() -> list[Resource]:
    resources: dict[str, Resource] = {}
    for page_path in SITE_PAGES:
        try:
            html_text = fetch(urljoin(BASE_URL, page_path))
        except subprocess.CalledProcessError:
            continue
        soup = BeautifulSoup(html_text, "html.parser")
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"].strip()
            absolute = urljoin(BASE_URL, href)
            title = clean(anchor.get_text(" ", strip=True)) or Path(urlparse(absolute).path).name
            if not title:
                title = absolute
            if "youtube.com" in absolute or "youtu.be" in absolute:
                kind = "video"
            elif absolute.lower().endswith(".mp3"):
                kind = "audio"
            elif absolute.lower().endswith(".pdf"):
                kind = "notation"
            else:
                kind = "page"
            resources.setdefault(
                absolute,
                Resource(
                    source_kind=kind,
                    title=title,
                    url=absolute,
                    metadata_json={"discovered_from": page_path},
                ),
            )

    return sorted(resources.values(), key=lambda item: (item.source_kind, item.title, item.url))


def write_json(path: Path, data: list[dict[str, Any]]) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    songs = parse_lyrics_page()
    missing_numbers = [number for number in range(1, 5019) if number not in {song.number for song in songs}]
    for number in missing_numbers:
        song = parse_missing_song(number)
        if song:
            songs.append(song)
    songs.sort(key=lambda item: item.number)
    media = parse_audio_media()
    notations = parse_notations()
    inventory = crawl_inventory()

    write_json(GENERATED_DIR / "songs.json", [asdict(item) for item in songs])
    write_json(GENERATED_DIR / "media.json", media)
    write_json(GENERATED_DIR / "notations.json", notations)
    write_json(GENERATED_DIR / "inventory.json", [asdict(item) for item in inventory])

    print(
        "Wrote "
        f"{len(songs)} songs, {len(media)} media entries, {len(notations)} notations, "
        f"and {len(inventory)} inventory items to {GENERATED_DIR}"
    )


if __name__ == "__main__":
    main()
