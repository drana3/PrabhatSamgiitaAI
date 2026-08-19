#!/usr/bin/env python3
"""Exhaustive lyric-search latency check across query varieties (full 5,018 catalog)."""

from __future__ import annotations

import random
import re
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.services.catalog import catalog_song_snapshot  # noqa: E402
from app.services.lyric_search import (  # noqa: E402
    confident_lyric_hits,
    lyric_index,
    normalize_lyric_text,
    search_lyrics,
)

SENTENCE = re.compile(r"[^.!?]+")
LINE = re.compile(r".+", re.M)


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((p / 100) * (len(ordered) - 1))))
    return ordered[index]


def first_sentence(value: str | None) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    match = SENTENCE.search(text)
    return (match.group(0) if match else text).strip()


def inner_line(value: str | None) -> str:
    lines = [line.strip() for line in (value or "").splitlines() if len(line.strip()) >= 12]
    if len(lines) >= 2:
        return lines[min(2, len(lines) - 1)]
    return lines[-1] if lines else ""


def time_search(query: str, repeats: int = 1) -> tuple[float, int, int | None]:
    started = time.perf_counter()
    hits = []
    for _ in range(repeats):
        hits = confident_lyric_hits(search_lyrics(query))
    elapsed_ms = ((time.perf_counter() - started) / repeats) * 1000
    top = hits[0].number if hits else None
    return elapsed_ms, len(hits), top


def summarize(name: str, samples: list[tuple[str, int | None, float, int, int | None]]) -> None:
    latencies = [row[2] for row in samples]
    hits = sum(1 for row in samples if row[3] > 0)
    expected = [row for row in samples if row[1] is not None]
    correct = sum(1 for query, number, _ms, _count, top in expected if top == number)
    print(f"\n=== {name} ({len(samples)} queries) ===")
    print(
        f"  latency ms  min={min(latencies):.2f}  p50={pct(latencies, 50):.2f}  "
        f"p95={pct(latencies, 95):.2f}  p99={pct(latencies, 99):.2f}  "
        f"max={max(latencies):.2f}  mean={statistics.fmean(latencies):.2f}"
    )
    print(f"  hit rate    {hits}/{len(samples)} ({100 * hits / len(samples):.1f}%)")
    if expected:
        print(
            f"  expected #  {correct}/{len(expected)} "
            f"({100 * correct / len(expected):.1f}% top-5 contains expected song as #1)"
        )
    slow = sorted(samples, key=lambda row: row[2], reverse=True)[:3]
    print("  slowest")
    for query, number, ms, count, top in slow:
        preview = re.sub(r"\s+", " ", query)[:72]
        print(f"    {ms:6.2f} ms  hits={count}  expected={number} top={top}  {preview!r}")


def main() -> None:
    rng = random.Random(5018)
    songs = list(catalog_song_snapshot())
    print(f"catalog songs: {len(songs)}")
    cold_start = time.perf_counter()
    records, _ = lyric_index()
    print(f"index warm: {len(records)} records in {(time.perf_counter() - cold_start) * 1000:.1f} ms")
    time_search("bandhu")  # JIT / remaining caches

    opening: list[tuple[str, int | None]] = []
    inner: list[tuple[str, int | None]] = []
    late: list[tuple[str, int | None]] = []
    short: list[tuple[str, int | None]] = []
    spoken: list[tuple[str, int | None]] = []

    for song in songs:
        number = int(song.number)
        first = (song.first_line or song.title or "").strip()
        if first:
            opening.append((first, number))
            words = first.split()
            if 2 <= len(words) <= 4:
                short.append((" ".join(words[:3]), number))
        verse = inner_line(song.lyrics_original)
        if verse:
            inner.append((verse, number))
            if len(verse.split()) >= 5:
                spoken.append((verse.lower(), number))
        if number >= 4000:
            if first:
                late.append((first, number))
            if verse:
                late.append((verse, number))

    misses = [
        ("zxqv plok mner", None),
        ("completely unrelated bicycle sandwich theorem", None),
        ("qwerty asdfgh lkjh", None),
        ("this line is not a prabhat samgiita lyric xyzzy", None),
        ("lorem ipsum dolor sit amet consectetur", None),
    ]

    buckets = {
        "opening line (original)": rng.sample(opening, min(250, len(opening))),
        "inner original verse": rng.sample(inner, min(250, len(inner))),
        "spoken lyric (lowercase)": rng.sample(spoken, min(200, len(spoken))),
        "late catalog 4000–5018": rng.sample(late, min(200, len(late))),
        "short 2–4 word opening": rng.sample(short, min(150, len(short))),
        "intentional misses": misses,
    }

    all_samples: list[tuple[str, int | None, float, int, int | None]] = []
    for name, queries in buckets.items():
        if not queries:
            print(f"\n=== {name} ===\n  skipped (no source text)")
            continue
        rows = []
        for query, number in queries:
            ms, count, top = time_search(query)
            rows.append((query, number, ms, count, top))
        summarize(name, rows)
        all_samples.extend(rows)

    print("\n=== ALL VARIETIES COMBINED ===")
    latencies = [row[2] for row in all_samples]
    print(f"  queries     {len(all_samples)}")
    print(
        f"  latency ms  min={min(latencies):.2f}  p50={pct(latencies, 50):.2f}  "
        f"p95={pct(latencies, 95):.2f}  p99={pct(latencies, 99):.2f}  "
        f"max={max(latencies):.2f}  mean={statistics.fmean(latencies):.2f}"
    )
    over_40 = sum(1 for ms in latencies if ms >= 40)
    over_15 = sum(1 for ms in latencies if ms >= 15)
    print(f"  >= 15 ms    {over_15}/{len(latencies)}")
    print(f"  >= 40 ms    {over_40}/{len(latencies)}")

    burst = rng.sample(inner, min(80, len(inner))) + rng.sample(opening, min(80, len(opening)))
    started = time.perf_counter()
    for query, _number in burst:
        search_lyrics(query)
    burst_ms = (time.perf_counter() - started) * 1000
    print(f"\n=== burst {len(burst)} mixed queries ===")
    print(f"  total {burst_ms:.1f} ms  avg {burst_ms / len(burst):.2f} ms/query")


if __name__ == "__main__":
    main()
