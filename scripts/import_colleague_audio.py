#!/usr/bin/env python3
"""Colleagues' Prabhat Samgiita recordings (audio archive) -> English file names -> R2 -> data/curated.

Reads the archive `аудио-*.zip` (one file per recording; the number at the start of the file name is the
Prabhat Samgiita number), names each file `<number> <English title>.<ext>` using the title the app holds in
`data/generated/songs.json` (diacritics dropped, Title Case; nothing translated or guessed) and records the
result in `data/curated/ps_colleagues/audio.json`. Cyrillic archive names are never carried over.

    python3 scripts/import_colleague_audio.py                    # dry run: the plan table, writes nothing
    python3 scripts/import_colleague_audio.py --write            # writes audio.json (status "planned")
    python3 scripts/import_colleague_audio.py --stage DIR        # also unpacks the renamed files into a NEW empty DIR
    python3 scripts/import_colleague_audio.py --upload           # uploads to R2 (see below), then --write records the keys

Upload: uses `r2.py` of Dada's audio-extractor (default `~/Developer/audio-extractor`, bucket and keys from its
own `.env`; never printed). A file goes to `<R2_PREFIX>ps-audio/<file name>`; one that is already there with the
same size is skipped, so a second run uploads nothing twice and nothing is ever deleted or overwritten.

Standard library only (boto3 comes in through `r2.py`). Two files for one number (9 songs) are both kept; neither
is marked current (`needs_decision`), the choice is Dada's.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "data" / "curated" / "ps_colleagues" / "audio.json"
GEN = REPO / "data" / "generated"
DEFAULT_ZIP = Path.home() / "Downloads" / "аудио-20261111T150419Z-1-001.zip"
R2_DIR = Path.home() / "Developer" / "audio-extractor"
AUDIO_EXT = {".m4a", ".mp3", ".wav"}
PREFIX_DIR = "ps-audio/"

# Dada, 2026-11-11: the Google Drive folder "ПС-КОНТЕНТ / аудио / Didi Sushraddha" holds recordings that are not sung
# correctly. These archive files match its listing by name, size (Drive shows MiB) and date, so they are left out
# of the import: (archive file name, bytes). The list on Dada's screenshot was cut off; more can be added here.
EXCLUDED_DRIVE_DIDI_SUSHRADDHA = {
    ("181.m4a", 5792541),
    ("199 Hiyara majhare.m4a", 5634119),
    ("209.m4a", 5603326),
    ("450 Se amar.m4a", 4199657),
    ("867 tandra-dao-katiye-cosmic love-.mp3", 8854810),
    ("903.m4a", 6522274),
    ("1315 Nayan majhare.m4a", 4452026),
    ("1682 Vasanteri.m4a", 4620982),
    ("3389 Tomay ami bhalobasi Диди.m4a", 5519106),
    ("4673 bhajo-re-ista-nam-man-amar.mp3", 13865823),
}
excluded_seen: list[dict] = []  # filled by plan(): song number, bytes and reason of every file left out


def english_title(title: str) -> str:
    """The app's song title as a plain file-name title: no diacritics, no punctuation, Title Case."""
    plain = unicodedata.normalize("NFKD", title)
    plain = "".join(c for c in plain if not unicodedata.combining(c))
    plain = re.sub(r"[^A-Za-z0-9 ]+", " ", plain.replace("’", "").replace("'", ""))
    return " ".join(w[:1].upper() + w[1:].lower() for w in plain.split())


def plan(zip_path: Path):
    songs = {s["number"]: s for s in json.loads((GEN / "songs.json").read_text(encoding="utf-8"))}
    prior: dict[int, int] = {}
    for name in ("media.json", "external_audio.json"):
        for m in json.loads((GEN / name).read_text(encoding="utf-8")):
            if m.get("kind") == "audio":
                prior[m["song_number"]] = prior.get(m["song_number"], 0) + 1
    entries, unmatched = [], []
    with zipfile.ZipFile(zip_path) as z:
        for info in sorted(z.infolist(), key=lambda i: Path(i.filename).name):
            base = Path(info.filename).name
            if info.is_dir() or not base or Path(base).suffix.lower() not in AUDIO_EXT:
                continue
            m = re.match(r"^(\d+)(?!\d)", base)
            if not m or int(m.group(1)) not in songs:
                unmatched.append(base)
                continue
            n = int(m.group(1))
            if (base, info.file_size) in EXCLUDED_DRIVE_DIDI_SUSHRADDHA:
                excluded_seen.append({"ps": n, "bytes": info.file_size, "reason": "from Drive folder Didi Sushraddha, not sung correctly (Dada, 2026-11-11)"})
                continue
            entries.append({"ps": n, "archive_name": base, "info": info, "ext": Path(base).suffix.lower()})
    by_song: dict[int, list[dict]] = {}
    for e in entries:
        by_song.setdefault(e["ps"], []).append(e)
    out = {}
    for n, items in sorted(by_song.items()):
        title = english_title(songs[n]["title"])
        many = len(items) > 1
        recs = []
        for k, e in enumerate(items, 1):
            suffix = f" ({k} of {len(items)})" if many else ""
            recs.append(
                {
                    "file_name": f"{n} {title}{suffix}{e['ext']}",
                    "container": e["ext"][1:],
                    "bytes": e["info"].file_size,
                    "is_current": None if many else True,
                    "needs_decision": "two files for one song in the archive: which one is current is not decided" if many else None,
                    "_archive_name": e["archive_name"],
                    "_info": e["info"],
                }
            )
        out[n] = {"app_title": songs[n]["title"], "previous_audio_links_kept": prior.get(n, 0), "recordings": recs}
    return out, unmatched


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", type=Path, default=DEFAULT_ZIP)
    ap.add_argument("--write", action="store_true", help="write data/curated/ps_colleagues/audio.json")
    ap.add_argument("--stage", type=Path, help="unpack the renamed files into this NEW empty folder")
    ap.add_argument("--upload", action="store_true", help="upload the renamed files to R2 (needs the audio-extractor r2.py)")
    ap.add_argument("--r2-dir", type=Path, default=R2_DIR)
    args = ap.parse_args()

    songs, unmatched = plan(args.zip)
    files = sum(len(v["recordings"]) for v in songs.values())
    for n, v in songs.items():
        for r in v["recordings"]:
            print(f"{n:>5}  {r['_archive_name']!r:60}  ->  {r['file_name']}")
    print(f"{files} files, {len(songs)} songs, unmatched: {unmatched}")
    multi = [n for n, v in songs.items() if len(v["recordings"]) > 1]
    print("songs with more than one file:", multi)

    uploaded: dict[str, str] = {}
    if args.stage or args.upload:
        stage = args.stage
        if stage:
            if stage.exists() and any(stage.iterdir()):
                raise SystemExit(f"{stage} is not empty")
            stage.mkdir(parents=True, exist_ok=True)
        if args.upload:
            sys.path.insert(0, str(args.r2_dir))
            import r2  # noqa: PLC0415  (Dada's own module; reads its .env, prints nothing secret)
            import tempfile

            problem = r2.test()
            if problem:
                raise SystemExit(f"R2: {problem}")
        for n, v in songs.items():
            for r in v["recordings"]:
                with zipfile.ZipFile(args.zip) as z:
                    data = z.read(r["_info"])
                r["sha256"] = hashlib.sha256(data).hexdigest()
                if stage:
                    (stage / r["file_name"]).write_bytes(data)
                if args.upload:
                    with tempfile.TemporaryDirectory() as tmp:
                        path = Path(tmp) / r["file_name"]
                        path.write_bytes(data)
                        key = r2.upload(path, PREFIX_DIR + r["file_name"])
                    uploaded[r["file_name"]] = key
                    print("uploaded", key)

    if args.write:
        doc = {
            "_meta": {
                "source_archive": args.zip.name,
                "storage": "Cloudflare R2, bucket am-site-books-private (private); key below is relative to the bucket",
                "note": "previous audio links are kept; a recording with is_current true is the one to play first",
                "excluded": sorted(excluded_seen, key=lambda x: x["ps"]),
            },
            "songs": {},
        }
        for n, v in songs.items():
            recs = []
            for r in v["recordings"]:
                rec = {k: val for k, val in r.items() if not k.startswith("_")}
                rec["r2_key"] = uploaded.get(r["file_name"])
                rec["status"] = "uploaded" if rec["r2_key"] else "planned"
                recs.append(rec)
            doc["songs"][str(n)] = {**{k: val for k, val in v.items() if k != "recordings"}, "recordings": recs}
        if OUT.exists():
            old = json.loads(OUT.read_text(encoding="utf-8"))["songs"]
            for n, v in doc["songs"].items():  # a plain --write must not forget keys recorded by an earlier --upload
                for rec in v["recordings"]:
                    was = next((x for x in old.get(n, {}).get("recordings", []) if x["file_name"] == rec["file_name"]), None)
                    if was and was.get("r2_key") and not rec["r2_key"]:
                        rec["r2_key"], rec["status"] = was["r2_key"], was["status"]
                    if was and was.get("sha256") and "sha256" not in rec:
                        rec["sha256"] = was["sha256"]
        OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print("wrote", OUT.relative_to(REPO))
    else:
        print("dry run: nothing written (use --write)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
