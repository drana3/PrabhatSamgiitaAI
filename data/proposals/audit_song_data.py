#!/usr/bin/env python3
"""Audit of the song data that any categorisation would rest on. Read only, offline.

    python3 data/proposals/audit_song_data.py        -> data/proposals/audit_v0.json (+ summary on stdout)
"""
from __future__ import annotations

import json
import math
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
G = ROOT / "data" / "generated"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return re.sub(r"[^a-z]", "", "".join(c for c in s if not unicodedata.combining(c)).lower())


def pct(sorted_vals, p):
    if not sorted_vals:
        return None
    k = (len(sorted_vals) - 1) * p / 100
    f, c = math.floor(k), math.ceil(k)
    return round(sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f), 1)


def main():
    songs = json.loads((G / "songs.json").read_text())
    cols = json.loads((G / "theme_collections.json").read_text())
    mobile = json.loads((G / "mobile_category_songs.json").read_text())
    n = len(songs)
    out: dict = {"songs": n}

    # --- field fill rates
    fill = Counter()
    for s in songs:
        for k, v in s.items():
            if k != "metadata_json" and v not in (None, "", [], {}):
                fill[k] += 1
        for k, v in (s.get("metadata_json") or {}).items():
            if v not in (None, "", [], {}):
                fill["metadata_json." + k] += 1
    out["fill_rate"] = {k: {"count": v, "pct": round(100 * v / n, 1)} for k, v in sorted(fill.items(), key=lambda x: -x[1])}
    out["fields_never_filled"] = [k for k in songs[0] if k != "metadata_json" and fill[k] == 0]

    # --- english_meaning quality
    words = [len((s.get("english_meaning") or "").split()) for s in songs]
    nz = sorted(w for w in words if w)
    out["english_meaning"] = {
        "missing": [s["number"] for s in songs if not s.get("english_meaning")],
        "words_min": nz[0], "words_p5": pct(nz, 5), "words_p25": pct(nz, 25), "words_median": pct(nz, 50),
        "words_p75": pct(nz, 75), "words_p95": pct(nz, 95), "words_max": nz[-1],
        "under_40_words": sum(1 for w in nz if w < 40), "under_60_words": sum(1 for w in nz if w < 60),
        "over_150_words": sum(1 for w in nz if w > 150),
        "equals_title_or_first_line": sum(1 for s in songs if s.get("english_meaning") and norm(s["english_meaning"]) in (norm(s["title"]), norm(s["first_line"]))),
        "with_translation_variants_separated_by_dashes": sum(1 for s in songs if re.search(r"\n\s*-{5,}\s*\n", s.get("english_meaning") or "") or re.search(r"_{8,}", s.get("english_meaning") or "")),
        "contains_non_latin_script": sum(1 for s in songs if re.search(r"[ऀ-ॿঀ-৿]", s.get("english_meaning") or "")),
        "with_editor_note_markers": sum(1 for s in songs if re.search(r"\*\s|\(note|editor", s.get("english_meaning") or "", re.I)),
        "histogram_words": dict(sorted(Counter(min((w // 20) * 20, 200) for w in nz).items())),
    }
    out["central_idea"] = {"count": fill["central_idea"], "purport_in_metadata": fill["metadata_json.purport"]}

    # --- duplicates
    def dup_groups(field):
        g = defaultdict(list)
        for s in songs:
            v = s.get(field)
            if v:
                g[norm(v)].append(s["number"])
        d = {k: v for k, v in g.items() if len(v) > 1}
        return {"groups": len(d), "songs_in_groups": sum(len(v) for v in d.values()), "largest_group": max((len(v) for v in d.values()), default=0), "examples": [v for v in list(d.values())[:5]]}
    out["duplicates"] = {"title": dup_groups("title"), "english_meaning": dup_groups("english_meaning"), "lyrics_original": dup_groups("lyrics_original")}
    # near duplicates in meaning: Jaccard on 5-word shingles, restricted by shared first shingles for speed
    sh = {}
    for s in songs:
        w = re.findall(r"[a-z]+", (s.get("english_meaning") or "").lower())
        sh[s["number"]] = {" ".join(w[i:i + 5]) for i in range(max(0, len(w) - 4))}
    inv = defaultdict(list)
    for num, grams in sh.items():
        for g in grams:
            inv[g].append(num)
    cand = Counter()
    for g, nums in inv.items():
        if 1 < len(nums) <= 4:
            for i in range(len(nums)):
                for j in range(i + 1, len(nums)):
                    cand[(nums[i], nums[j])] += 1
    near = []
    for (a, b), c in cand.items():
        if c >= 8:
            jac = len(sh[a] & sh[b]) / max(1, len(sh[a] | sh[b]))
            if jac >= 0.5:
                near.append((a, b, round(jac, 2)))
    out["near_duplicate_meanings_jaccard_ge_0.5"] = sorted(near, key=lambda x: -x[2])[:20]

    # --- curated coverage
    by_kind = defaultdict(set)
    allc = set()
    for c in cols:
        by_kind[c["category"]] |= set(c["song_numbers"])
        allc |= set(c["song_numbers"])
    out["curated_collections"] = {
        "collections": len(cols),
        "collections_by_kind": dict(Counter(c["category"] for c in cols)),
        "songs_in_any": len(allc), "songs_in_none": n - len(allc), "pct_in_any": round(100 * len(allc) / n, 1),
        "songs_by_kind": {k: len(v) for k, v in by_kind.items()},
        "collections_with_one_song": sum(1 for c in cols if c["count"] == 1),
        "sizes_top": sorted(((c["label"], c["count"]) for c in cols), key=lambda x: -x[1])[:8],
        "songs_in_2plus_collections": sum(1 for v in Counter(x for c in cols for x in c["song_numbers"]).values() if v > 1),
    }
    mc = {}
    for k, v in {**mobile["categories"], **mobile["searches"]}.items():
        mc[k] = len(v["song_numbers"])
    mset = set(x for v in {**mobile["categories"], **mobile["searches"]}.values() for x in v["song_numbers"])
    out["mobile_category_songs"] = {"entries": len(mc), "songs_in_any": len(mset), "pct": round(100 * len(mset) / n, 1), "union_with_curated": len(mset | allc), "sizes": mc,
                                    "note": "mobile_category_songs.json is itself a keyword/lexical search result (see scripts/build_mobile_category_songs.py), not human curation."}

    # --- source site tags
    out["source_category_codes"] = dict(Counter(((s.get("metadata_json") or {}).get("category") or "").strip()[:12] for s in songs).most_common(8))
    out["language_field"] = dict(Counter(s.get("language") for s in songs))
    (Path(__file__).parent / "audit_v0.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(json.dumps({k: out[k] for k in ("fields_never_filled", "english_meaning", "duplicates", "curated_collections", "mobile_category_songs")}, ensure_ascii=False, indent=1)[:6000])


if __name__ == "__main__":
    main()
