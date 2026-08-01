from __future__ import annotations

import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "generated" / "theme_assignments.json"
BASE_URL = "https://prabhatasamgiita.net"
INDEX_URL = f"{BASE_URL}/themes.html"

LANGUAGE_LABELS = {
    "Sanskrit Songs": "Sanskrit",
    "English Songs": "English",
    "Hindi Songs": "Hindi",
    "Urdu Songs": "Urdu",
    "Aungika Songs": "Aungika",
    "Maethili Song": "Maithili",
    "Bengali Dialect Songs": "Bengali dialect",
}
SEASON_LABELS = {
    "Spring Songs": "spring",
    "Summer Songs": "summer",
    "Autumn Songs (Sharat)": "autumn",
    "Autumn Songs (Hemante)": "autumn",
    "Winter Songs": "winter",
    "Rainy Season Songs": "rainy season",
    "Dry Season Songs": "dry season",
}


def fetch(url: str) -> str:
    completed = subprocess.run(
        [
            "curl",
            "--location",
            "--compressed",
            "--fail",
            "--silent",
            "--show-error",
            "--max-time",
            "30",
            "--user-agent",
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


def clean(value: str) -> str:
    return " ".join(value.split()).strip()


def theme_links(index_html: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(index_html, "html.parser")
    heading = next(
        (
            tag
            for tag in soup.find_all(["h1", "h2", "h3"])
            if "grouped according to specific themes" in clean(tag.get_text()).lower()
        ),
        None,
    )
    if heading is None:
        raise RuntimeError("Could not find the canonical themes heading")
    links: list[tuple[str, str]] = []
    for anchor in heading.find_all_next("a", href=True):
        label = clean(anchor.get_text(" ", strip=True))
        if label.lower() in {"prabhatasamgiita.net", "prabhata-samgiita.net"}:
            break
        href = str(anchor.get("href", ""))
        if not label or not href.lower().endswith((".html", ".htm")):
            continue
        links.append((label, urljoin(INDEX_URL, href)))
    return list(dict.fromkeys(links))


def song_numbers(page_html: str) -> list[int]:
    soup = BeautifulSoup(page_html, "html.parser")
    numbers: set[int] = set()
    for anchor in soup.find_all("a", href=True):
        text = clean(anchor.get_text(" ", strip=True))
        match = re.match(r"^(\d{1,4})(?:\s|$)", text)
        if not match:
            match = re.search(r"(?:ps_|#)(\d{1,4})(?:\D|$)", str(anchor.get("href", "")))
        if match:
            number = int(match.group(1))
            if 1 <= number <= 5018:
                numbers.add(number)
    return sorted(numbers)


def category_for(label: str) -> tuple[str, str]:
    if label in LANGUAGE_LABELS:
        return "language", LANGUAGE_LABELS[label]
    if label in SEASON_LABELS:
        return "season", SEASON_LABELS[label]
    lowered = label.lower()
    if any(
        marker in lowered
        for marker in (
            "birthday",
            "new year",
            "year-end",
            "dipavali",
            "purnima",
            "victory day",
            "national day",
        )
    ):
        return "festival", label.removesuffix(" Songs").removesuffix(" Song")
    if any(
        marker in lowered
        for marker in (
            "ceremony",
            "children",
            "marching",
            "sanyasii",
            "approaching the end",
            "memory of",
        )
    ):
        return "occasion", label.removesuffix(" Songs").removesuffix(" Song")
    return "theme", label.removesuffix(" Songs").removesuffix(" Song")


def build_assignments() -> list[dict[str, Any]]:
    assignments: dict[int, dict[str, Any]] = defaultdict(
        lambda: {
            "song_number": 0,
            "themes": [],
            "festivals": [],
            "occasions": [],
            "seasons": [],
            "languages": [],
            "source_urls": [],
        }
    )
    links = theme_links(fetch(INDEX_URL))
    for label, url in links:
        try:
            numbers = song_numbers(fetch(url))
        except subprocess.CalledProcessError:
            continue
        category, value = category_for(label)
        plural_key = {
            "theme": "themes",
            "festival": "festivals",
            "occasion": "occasions",
            "season": "seasons",
            "language": "languages",
        }[category]
        for number in numbers:
            row = assignments[number]
            row["song_number"] = number
            if value not in row[plural_key]:
                row[plural_key].append(value)
            if url not in row["source_urls"]:
                row["source_urls"].append(url)
    return [assignments[number] for number in sorted(assignments)]


def main() -> None:
    rows = build_assignments()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} canonical theme assignments to {OUTPUT}")


if __name__ == "__main__":
    main()
