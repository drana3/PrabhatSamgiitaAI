"""Re-check bundled YouTube data against the stricter verification rules, with no network.

Reads data/generated/songs.json, youtube_videos.json and youtube_review_queue.json. A video that
fails a rule of `scripts.sync_youtube.verification_problems` is DOWNGRADED from verified to
needs_review (its row stays in the file, clients never see it). Nothing is ever upgraded, deleted
or relinked; the review queue file is only read.

    python -m scripts.recheck_youtube_local            # dry run, prints the numbers
    python -m scripts.recheck_youtube_local --write    # writes the data file and docs/youtube-recheck.md
"""
# ruff: noqa: E501

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

from scripts.sync_youtube import (
    CHANNELS,
    TITLE_AGREEMENT_MIN,
    VERIFIED_STATUSES,
    explicit_song_number,
    title_agreement,
    verification_problems,
)

ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "data" / "generated"
REPORT_PATH = ROOT / "docs" / "youtube-recheck.md"

# "Ambiguous by title" pairs from the data audit (2026-11-05): the same short title fits both
# songs. The video is linked to the first number; its title carries that number.
AMBIGUOUS_PAIRS: tuple[tuple[int, int], ...] = (
    (116, 3790), (152, 2506), (1272, 4738), (1391, 3334), (3476, 1442), (3201, 1481),
    (3299, 4395), (1228, 3264), (2586, 1064), (2850, 2596), (3261, 4000), (2137, 2750),
    (2732, 4287), (2797, 1692), (2741, 1841), (3850, 3841), (4678, 3601), (2648, 1371),
    (2603, 2560), (579, 2668), (1395, 3324), (3209, 3324), (4595, 1932), (2712, 4118),
    (1406, 1594), (2579, 2876),
)  # fmt: skip

RECHECK_MARK = "recheck_youtube_local"


def load_json(name: str) -> list[dict[str, Any]]:
    data: list[dict[str, Any]] = json.loads((GENERATED / name).read_text(encoding="utf-8"))
    return data


def channel_for(channel_id: str) -> dict[str, Any]:
    for channel in CHANNELS:
        if channel["id"] == channel_id:
            return channel
    return CHANNELS[0]


def check_row(row: dict[str, Any], songs: dict[int, dict[str, Any]]) -> list[str]:
    """Problems of one bundled video row, judged by its title alone (no network)."""
    meta = row.get("metadata_json") or {}
    channel = channel_for(str(meta.get("channel_id") or ""))
    number = int(row["song_number"])
    from_title = str(channel.get("number_source") or "title") == "title"
    return verification_problems(
        str(row.get("title") or ""),
        number,
        songs.get(number),
        programme_ok=bool(channel.get("allow_programme") or meta.get("programme_ok")),
        number_from_title=from_title,
    )


def downgrade(rows: list[dict[str, Any]], songs: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    """Mutates rows in place; returns one entry per downgraded video."""
    changed: list[dict[str, Any]] = []
    for row in rows:
        if row.get("verification_status") not in VERIFIED_STATUSES:
            continue
        problems = check_row(row, songs)
        if not problems:
            continue
        meta = row.setdefault("metadata_json", {})
        changed.append(
            {
                "song_number": row["song_number"],
                "external_id": meta.get("external_id"),
                "title": row.get("title"),
                "was": row["verification_status"],
                "problems": problems,
            }
        )
        row["verification_status"] = "needs_review"
        meta["needs_review_reasons"] = problems
        meta["downgraded_by"] = RECHECK_MARK
        meta["previous_verification_status"] = changed[-1]["was"]
    return changed


def downgraded_entries(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Every row this pass has downgraded, now or in an earlier run (the report lists them all)."""
    return [
        {
            "song_number": row["song_number"],
            "external_id": (row.get("metadata_json") or {}).get("external_id"),
            "title": row.get("title"),
            "was": (row.get("metadata_json") or {}).get("previous_verification_status"),
            "problems": (row.get("metadata_json") or {}).get("needs_review_reasons") or [],
        }
        for row in rows
        if (row.get("metadata_json") or {}).get("downgraded_by") == RECHECK_MARK
    ]


def queue_verdicts(
    queue: list[dict[str, Any]],
    songs: dict[int, dict[str, Any]],
    linked: dict[str, int],
) -> list[dict[str, Any]]:
    """What the new rules say about each pending queue item. The queue itself is not changed."""
    out: list[dict[str, Any]] = []
    for item in queue:
        title = str(item.get("title") or "")
        number = explicit_song_number(title)
        channel = channel_for(str(item.get("channel_id") or ""))
        if number is None:
            verdict, reasons = "no usable song number", ["missing_explicit_song_number"]
        elif number not in songs:
            verdict, reasons = "number is not a song", ["number_out_of_range"]
        else:
            reasons = verification_problems(
                title,
                number,
                songs[number],
                programme_ok=bool(channel.get("allow_programme")),
            )
            verdict = "still needs a person" if reasons else "would verify"
        out.append(
            {
                "external_id": item.get("external_id"),
                "title": title,
                "channel": item.get("channel_name"),
                "number": number,
                "verdict": verdict,
                "reasons": reasons,
                "already_linked_to": linked.get(str(item.get("external_id"))),
            }
        )
    return out


def pair_rows(rows: list[dict[str, Any]], songs: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    by_song: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        by_song.setdefault(int(row["song_number"]), []).append(row)
    result: list[dict[str, Any]] = []
    for first, second in AMBIGUOUS_PAIRS:
        for video in by_song.get(first, []):
            title = str(video.get("title") or "")
            result.append(
                {
                    "pair": f"{first}/{second}",
                    "title": title,
                    "own": title_agreement(title, songs[first]),
                    "other": title_agreement(title, songs[second]),
                    "number_in_title": explicit_song_number(title),
                    "status": video["verification_status"],
                    "same_title": str(songs[first].get("title")).strip().lower()
                    == str(songs[second].get("title")).strip().lower(),
                }
            )
    return result


def md(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def build_report(
    changed: list[dict[str, Any]],
    pairs: list[dict[str, Any]],
    verdicts: list[dict[str, Any]],
    total: int,
) -> str:
    reasons = Counter(p.split(":")[0] for entry in changed for p in entry["problems"])
    lines = [
        "# YouTube recheck (local pass, no network)",
        "",
        "Date: 2026-11-05. Script: `python -m scripts.recheck_youtube_local --write`.",
        "",
        "The pass re-judges the bundled `data/generated/youtube_videos.json` with the stricter",
        "rules now in `scripts/sync_youtube.py` (`verification_problems`):",
        "",
        "1. the number is a plausible song number: 1..5018, not a year (1900-2099 without a",
        "   marker such as `#`, `No.`, `PS`), not a date, a length or a part number;",
        "2. the title is not a dance, compilation, interview, live, Kiirtan or Mahamantra",
        "   programme (unless the channel or video is flagged `allow_programme` / `programme_ok`);",
        "3. the song title, first line or opening lyric lines agree with the video title",
        f"   (fuzzy, accents and spelling folded, at least {TITLE_AGREEMENT_MIN}).",
        "",
        "Only downgrades happen: a failing entry goes from `verified` to `needs_review` and stays in",
        "the file with `metadata_json.needs_review_reasons`. Nothing is upgraded, deleted or relinked.",
        "The review queue file is not changed (queue statuses stay `pending_review`).",
        "",
        "## Numbers",
        "",
        f"- bundled videos checked: {total}",
        f"- downgraded to needs_review: {len(changed)}",
        f"- reasons: {', '.join(f'{k} {v}' for k, v in sorted(reasons.items())) or 'none'}",
        f"- review queue items judged: {len(verdicts)}",
        f"- ambiguous pairs listed in the audit: {len(AMBIGUOUS_PAIRS)} pairs ({len(pairs)} videos);",
        "  the audit's summary row says 28, but only these pairs are named",
        "",
        "## Downgraded videos",
        "",
    ]
    if changed:
        lines += ["| Song | Video | Title | Reasons |", "|---|---|---|---|"]
        for entry in sorted(changed, key=lambda e: int(e["song_number"])):
            lines.append(
                f"| {entry['song_number']} | {entry['external_id']} | {md(entry['title'])} "
                f"| {md(', '.join(entry['problems']))} |"
            )
    else:
        lines.append("None.")
    lines += [
        "",
        "Each of these needs a person to listen/watch and either restore `verified` or unlink.",
        "",
        "## Ambiguous pairs (short title fits two songs)",
        "",
        "`own` is the agreement of the video title with the linked song, `other` with the second",
        "song of the pair. The number in the title decides, so a pair stays verified when the title",
        "carries the linked number and agrees with its song.",
        "",
        "| Pair | Title | own | other | Number in title | Same song title | Status now |",
        "|---|---|---|---|---|---|---|",
    ]
    for p in pairs:
        lines.append(
            f"| {p['pair']} | {md(p['title'])} | {p['own']} | {p['other']} | {p['number_in_title']} "
            f"| {'yes' if p['same_title'] else 'no'} | {p['status']} |"
        )
    lines += [
        "",
        "## Review queue (117 pending items, statuses unchanged)",
        "",
        "Verdict by the new rules. 'would verify' means the rules alone would not stop an approval;",
        "nobody approves queue items automatically any more (`persist_youtube_inventory` approves",
        "a queue entry only for a video that was actually linked as verified).",
        "",
        "| Video | Channel | Title | Number | Verdict | Reasons | Already a bundled video of |",
        "|---|---|---|---|---|---|---|",
    ]
    for v in verdicts:
        lines.append(
            f"| {v['external_id']} | {md(v['channel'])} | {md(v['title'])} | {v['number'] or ''} "
            f"| {v['verdict']} | {md(', '.join(v['reasons']))} | {v['already_linked_to'] or ''} |"
        )
    lines += [
        "",
        "Items the audit warned about:",
        "",
        "- `Prabhata Samgiita Divas 2025` (4 items) and the Purodha Pramukh address with 2026: the",
        "  year is no longer read as a song number (`missing_explicit_song_number`).",
        "- `Siddha Mahamantra in 8 Prabhat Samgiita Tunes | 25 Mins` on 25: the 25 is a length, no",
        "  longer read as a song number; the Kiirtan / Mahamantra words would block it anyway.",
        "- interviews, podcasts, festival cuts: blocked by `programme_title:*` or by the missing number.",
        "",
        "## Neon database (not touched by this pass)",
        "",
        "The same videos exist as `media` rows with `verification_status = 'verified'` in Neon. The",
        "API already hides everything that is not verified / verified_external / human_reviewed, but",
        "the Neon rows still say `verified`. To make the database agree with the file, a person runs",
        "the SQL below (review it first; it was NOT run):",
        "",
        "```sql",
        "UPDATE media",
        "SET verification_status = 'needs_review'",
        "WHERE provider = 'youtube'",
        "  AND verification_status IN ('verified', 'verified_external')",
        "  AND metadata_json->>'external_id' IN (",
    ]
    ids = [
        f"    '{e['external_id']}'" for e in sorted(changed, key=lambda e: int(e["song_number"]))
    ]
    lines += [",\n".join(ids) if ids else "    ''", "  );", "```", ""]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="write the data file and the report")
    args = parser.parse_args()
    songs = {int(row["number"]): row for row in load_json("songs.json") if row.get("number")}
    rows = load_json("youtube_videos.json")
    queue = load_json("youtube_review_queue.json")
    linked = {
        str((r.get("metadata_json") or {}).get("external_id")): int(r["song_number"]) for r in rows
    }
    new_now = downgrade(rows, songs)
    changed = downgraded_entries(rows)
    pairs = pair_rows(rows, songs)
    verdicts = queue_verdicts(queue, songs, linked)
    print(
        f"videos {len(rows)}, downgraded now {len(new_now)}, "
        f"downgraded in total {len(changed)}, queue {len(verdicts)}"
    )
    for entry in changed:
        print(entry["song_number"], entry["external_id"], entry["problems"], entry["title"])
    if args.write:
        (GENERATED / "youtube_videos.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(build_report(changed, pairs, verdicts, len(rows)), encoding="utf-8")
        print(f"wrote {REPORT_PATH}")


if __name__ == "__main__":
    main()
