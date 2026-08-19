from __future__ import annotations

import html
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urljoin, urlparse

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
    r'<A NAME="(?P<anchor>[^"]+)">\s*</A>\s*<H4>(?P<header>.*?)</H4>\s*'
    r'(?P<body>.*?)(?=(?:<A NAME="|</BODY>))',
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
    decoded = html.unescape(text)
    # The source contains decimal combining marks written as text (for example
    # "Su769" instead of "Ś"). Decode those artifacts before indexing.
    decoded = re.sub(
        r"(?<=[A-Za-z])u(7\d{2})\s*(?=[^\W\d_])",
        lambda match: chr(int(match.group(1))),
        decoded,
    )
    return re.sub(r"\s+", " ", decoded).strip()


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
    if not line:
        return False
    # Dialogue songs use mixed-case speaker labels such as "Krs'n'a:" before
    # uppercase Roman-Samskrta lyrics. Treat short labels as part of the lyric
    # block and classify the remaining lines by uppercase letter ratio.
    if line.endswith(":") and len(line) <= 48:
        return True
    letters = [character for character in line if character.isalpha()]
    if not letters:
        return False
    uppercase = sum(character.isupper() for character in letters)
    return uppercase / len(letters) >= 0.72


def split_song_sections(paragraphs: list[list[str]]) -> tuple[list[str], list[str], list[str]]:
    if not paragraphs:
        return [], [], []
    lines = [line for paragraph in paragraphs for line in paragraph]
    purport_index = next(
        (idx for idx, line in enumerate(lines) if line.lower().startswith("purport:")),
        None,
    )
    content = lines if purport_index is None else lines[:purport_index]
    purport = [] if purport_index is None else lines[purport_index + 1 :]

    lyric_start = next(
        (
            index
            for index, line in enumerate(content)
            if is_roman_lyric_line(line)
            and index + 1 < len(content)
            and is_roman_lyric_line(content[index + 1])
        ),
        None,
    )
    if lyric_start is None:
        return [], content, purport

    lyric_end = lyric_start
    while lyric_end < len(content) and is_roman_lyric_line(content[lyric_end]):
        lyric_end += 1
    lyrics = content[lyric_start:lyric_end]
    meaning = content[:lyric_start] + content[lyric_end:]
    if lyrics and lyrics[-1].endswith(":") and meaning:
        meaning.insert(len(content[:lyric_start]), lyrics.pop())
    return lyrics, meaning, purport


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
        first_line = next(
            (line for line in lyrics_lines if not line.endswith(":")),
            english_lines[0] if english_lines else None,
        )
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
        href_value = anchor.get("href")
        href = href_value.strip() if isinstance(href_value, str) else ""
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
            href_value = anchor.get("href")
            href = href_value.strip() if isinstance(href_value, str) else ""
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
    return deduplicate_media(media)


def deduplicate_media(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep one canonical record per URL, preferring number-linked media."""
    selected: dict[str, dict[str, Any]] = {}
    for row in rows:
        url = str(row.get("url") or "")
        current = selected.get(url)
        if current is None or (
            current.get("song_number") is None and row.get("song_number") is not None
        ):
            selected[url] = row
    return list(selected.values())


BENGALI_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def parse_bengali_int(value: str) -> int | None:
    """Convert Bengali (or mixed) digit strings like '২৯৬' to int."""
    digits = re.sub(r"\D", "", value.translate(BENGALI_DIGITS))
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def notation_part_index(title: str, filename: str) -> int | None:
    """Detect continuation parts (-1, -2) when a song spans multiple PDFs."""
    stem = Path(filename).stem
    for value in (title, stem):
        cleaned = value.strip()
        if re.fullmatch(r"_*\d+", cleaned):
            continue
        match = re.search(r"[-–—]\s*(\d+)\s*$", cleaned)
        if match and int(match.group(1)) in {1, 2, 3, 4, 5}:
            return int(match.group(1))
    return None


def parse_notation_label(text: str, filename: str) -> tuple[int | None, str, dict[str, Any]]:
    """Resolve song number from Andromeda label/filename (prefer Bengali display no.)."""
    metadata: dict[str, Any] = {"archive": "notations", "script": "bn", "display_script": "hi"}
    text = unquote(text or "").strip()
    filename = unquote(filename or "").strip()
    title = text
    leading: int | None = None
    display_raw: str | None = None

    match = re.match(
        r"_*(?P<number>\d+)\s*-\s*\((?P<display_number>[^)]+)\)\s*(?P<title>.*)",
        text,
    )
    if match:
        leading = int(match.group("number"))
        display_raw = match.group("display_number")
        title = match.group("title").strip()
    else:
        # Malformed parentheticals like "(৩৬২নূতন ..." (missing closing ')').
        open_paren = re.match(
            r"_*(?P<number>\d+)\s*-\s*\((?P<display_number>[০-৯0-9]{1,4})(?P<title>.*)",
            text,
        )
        if open_paren:
            leading = int(open_paren.group("number"))
            display_raw = open_paren.group("display_number")
            title = open_paren.group("title").lstrip(")").strip()
        else:
            alt = re.match(r"_*(?P<number>\d+)\s*-\s*(?P<title>.*)", text)
            if alt:
                leading = int(alt.group("number"))
                title = alt.group("title").strip()
            else:
                file_match = re.match(r"_*(?P<number>\d+)\b", filename)
                if file_match:
                    leading = int(file_match.group("number"))

    # Filenames sometimes keep a wrong leading number while the Bengali
    # parenthetical holds the true PS number, e.g. "__290 - (২৯৬) ...".
    display_number = parse_bengali_int(display_raw or "")
    if display_number is None:
        # Last resort: first Bengali digit run in the label/filename.
        bn_run = re.search(r"[০-৯]{1,4}", text) or re.search(r"[০-৯]{1,4}", filename)
        if bn_run:
            display_number = parse_bengali_int(bn_run.group(0))
            display_raw = bn_run.group(0)
    if display_raw:
        metadata["display_number"] = display_raw
    song_number = display_number or leading
    if display_number and leading and display_number != leading:
        metadata["filename_number"] = leading
        metadata["number_source"] = "bengali_display"
    elif song_number:
        metadata["number_source"] = "label" if leading else "filename"

    part = notation_part_index(title, filename)
    if part is not None:
        metadata["part"] = part
        title = re.sub(r"[-–—]\s*\d+\s*$", "", title).strip() or title

    return song_number, title, metadata


def _notation_row_quality(row: dict[str, Any]) -> tuple[int, int, int]:
    """Prefer decoded Bengali display numbers and non-empty titles when URLs collide."""
    meta = row.get("metadata_json") or {}
    number_score = 2 if meta.get("number_source") == "bengali_display" else 1 if row.get("song_number") else 0
    title = str(meta.get("title") or "")
    title_score = 1 if title and "%" not in title[:12] else 0
    display_score = 1 if meta.get("display_number") else 0
    return (number_score, display_score, title_score)


def parse_notations() -> list[dict[str, Any]]:
    html_text = fetch(urljoin(BASE_URL, NOTATION_ARCHIVE_PAGE))
    soup = BeautifulSoup(html_text, "html.parser")
    by_url: dict[str, dict[str, Any]] = {}
    for anchor in soup.find_all("a", href=True):
        href_value = anchor.get("href")
        href = href_value.strip() if isinstance(href_value, str) else ""
        absolute = urljoin(BASE_URL, href)
        if not absolute.lower().endswith(".pdf"):
            continue
        text = clean(anchor.get_text(" ", strip=True))
        filename = unquote(Path(urlparse(absolute).path).name)
        # Prefer the labeled text; fall back to filename when the icon link is empty.
        label = text or clean(filename.replace(".pdf", "").replace(".PDF", ""))
        song_number, title, metadata = parse_notation_label(label, filename)
        row = {
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
        current = by_url.get(absolute)
        if current is None or _notation_row_quality(row) > _notation_row_quality(current):
            by_url[absolute] = row
    return group_notation_parts(list(by_url.values()))


def group_notation_parts(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One DB row per song; keep every Andromeda PDF URL when a song has -1/-2 parts."""
    by_song: dict[int, list[dict[str, Any]]] = {}
    orphans: list[dict[str, Any]] = []
    for row in rows:
        number = int(row.get("song_number") or 0)
        if number <= 0:
            orphans.append(row)
            continue
        by_song.setdefault(number, []).append(row)

    grouped: list[dict[str, Any]] = []
    for number, parts in sorted(by_song.items()):
        parts = sorted(
            parts,
            key=lambda item: (
                int((item.get("metadata_json") or {}).get("part") or 0),
                str(item.get("source_url") or ""),
            ),
        )
        primary = dict(parts[0])
        urls = []
        seen: set[str] = set()
        for part in parts:
            url = str(part.get("source_url") or "")
            if url and url not in seen:
                seen.add(url)
                urls.append(url)
        metadata = dict(primary.get("metadata_json") or {})
        metadata["source_urls"] = urls
        metadata["part_count"] = len(urls)
        if len(urls) > 1:
            metadata["continuation_parts"] = True
        primary["source_url"] = urls[0]
        primary["metadata_json"] = metadata
        grouped.append(primary)
    grouped.extend(orphans)
    return grouped


def deduplicate_notations(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compatibility wrapper — prefer group_notation_parts for Andromeda sync."""
    return group_notation_parts(rows)


def crawl_inventory() -> list[Resource]:
    resources: dict[str, Resource] = {}
    for page_path in SITE_PAGES:
        try:
            html_text = fetch(urljoin(BASE_URL, page_path))
        except subprocess.CalledProcessError:
            continue
        soup = BeautifulSoup(html_text, "html.parser")
        for anchor in soup.find_all("a", href=True):
            href_value = anchor.get("href")
            href = href_value.strip() if isinstance(href_value, str) else ""
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


def sync_songs() -> list[SongRecord]:
    songs = parse_lyrics_page()
    parsed_numbers = {song.number for song in songs}
    missing_numbers = [number for number in range(1, 5019) if number not in parsed_numbers]
    for number in missing_numbers:
        song = parse_missing_song(number)
        if song:
            songs.append(song)
    songs.sort(key=lambda item: item.number)
    write_json(GENERATED_DIR / "songs.json", [asdict(item) for item in songs])
    return songs


def main(*, songs_only: bool = False) -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    songs = sync_songs()
    if songs_only:
        print(f"Wrote {len(songs)} songs to {GENERATED_DIR / 'songs.json'}")
        return
    media = parse_audio_media()
    notations = parse_notations()
    inventory = crawl_inventory()

    write_json(GENERATED_DIR / "media.json", media)
    write_json(GENERATED_DIR / "notations.json", notations)
    write_json(GENERATED_DIR / "inventory.json", [asdict(item) for item in inventory])

    print(
        "Wrote "
        f"{len(songs)} songs, {len(media)} media entries, {len(notations)} notations, "
        f"and {len(inventory)} inventory items to {GENERATED_DIR}"
    )


if __name__ == "__main__":
    main(songs_only="--songs-only" in sys.argv[1:])
