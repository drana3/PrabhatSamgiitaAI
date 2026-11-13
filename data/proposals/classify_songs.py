#!/usr/bin/env python3
"""Draft song categorisation for Prabhat Samgiita (offline, no network, no API keys).

MACHINE DRAFT. Nothing here is canonical. Every output needs human review before it is shown in the app.

Run from the repository root:

    python3 data/proposals/classify_songs.py

Inputs (read only):
    data/generated/songs.json              english_meaning, central_idea, first_line, lyrics_original, metadata_json
    data/generated/theme_collections.json  curated source-site collections (authoritative layer)
    data/proposals/song_taxonomy_v0.json   facets, values, seed lexicon (editable by hand)

Outputs (data/proposals/):
    song_categories_v0.json   per song: feeling, subject, time of day, season, imagery, source tags, curated tags
    review_queue_v0.csv       songs sorted by lowest confidence first, with empty columns for the reviewer
    spot_check_sample_v0.csv  100 songs, stratified and seeded, for the first human spot check
    pipeline_report_v0.json   coverage, confidence histograms, counts per value, lexicon suggestions, clusters

Method (stdlib + numpy only; the repo's FAISS index needs an Azure/OpenAI embedding key, so it is NOT used):
    1. Seed lexicon per value (weighted words and short phrases taken from the corpus' own English vocabulary).
       Score = sum of weight x (1 + ln count) x idf factor, damped by text length.
    2. Self-training: songs with a clear lexicon winner become pseudo-labels; a TF-IDF centroid per value is built
       from them (leave-one-out for the song itself); the centroid similarity (z-score) is added to the lexicon score.
    3. Time of day, season and imagery use the lexicon only (high-precision words, plus a few Romanised Bengali words
       from the lyrics for season and time).
    4. Source tags (Krsna, Shiva, language, tala/form, year) are read deterministically from the source site's own
       category text and date. No model.
    5. K-means on an SVD of the TF-IDF matrix is run only as a sanity check for themes the taxonomy may be missing.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
PROPOSALS = ROOT / "data" / "proposals"

STOPWORDS = set(
    """a about above after again all also am an and any are as at be because been before being below between both but by
    can cannot could did do does doing down during each few for from further had has have having he her here hers him his
    how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours out
    over own same she should so some such than that the their theirs them then there these they this those through to too
    under until up very was we were what when where which while who whom why will with would you your yours yourself o oh
    ever even shall may might upon whose thus yet let one two""".split()
)


def fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in text if not unicodedata.combining(c)).lower()


def stem(word: str) -> str:
    w = word
    if w.endswith("ies") and len(w) > 4:
        w = w[:-3] + "y"
    elif w.endswith("ing") and len(w) > 5:
        w = w[:-3]
    elif w.endswith("ed") and len(w) > 4:
        w = w[:-2]
    elif w.endswith("s") and not w.endswith("ss") and len(w) > 3:
        w = w[:-1]
    if w.endswith("e") and len(w) > 3:
        w = w[:-1]
    return w


def tokens(text: str) -> list[str]:
    return [stem(w) for w in re.findall(r"[a-z]+", fold(text).replace("'", "").replace("’", ""))]


def ngrams(toks: list[str], max_n: int = 3) -> Counter:
    c: Counter = Counter()
    for n in range(1, max_n + 1):
        for i in range(len(toks) - n + 1):
            c[" ".join(toks[i : i + n])] += 1
    return c


def stem_term(term: str) -> str:
    return " ".join(tokens(term))


def primary_meaning(text: str) -> tuple[str, bool]:
    """Some songs carry two or more translation variants separated by a dashed line. Use the first variant."""
    if not text:
        return "", False
    parts = re.split(r"\n\s*-{5,}\s*\n", text)
    if len(parts) > 1 and parts[0].strip():
        return parts[0].strip(), True
    return text.strip(), False


# ----------------------------------------------------------------------------------------------------------------------
# loading
# ----------------------------------------------------------------------------------------------------------------------


def load_inputs():
    songs = json.loads((ROOT / "data" / "generated" / "songs.json").read_text())
    collections = json.loads((ROOT / "data" / "generated" / "theme_collections.json").read_text())
    taxonomy = json.loads((PROPOSALS / "song_taxonomy_v0.json").read_text())
    return songs, collections, taxonomy


def build_documents(songs):
    docs = []
    for s in songs:
        meaning, had_variants = primary_meaning(s.get("english_meaning") or "")
        central = (s.get("central_idea") or "").strip()
        purport = ((s.get("metadata_json") or {}).get("purport") or "").strip()
        main_tokens = tokens(meaning)
        extra_tokens = tokens(central) if central else []
        grams = ngrams(main_tokens)
        if extra_tokens:
            # central idea counts double: it is the shortest and most direct statement of the song
            for g, n in ngrams(extra_tokens).items():
                grams[g] += 2 * n
        roman = Counter(re.findall(r"[a-z]+", fold(s.get("lyrics_original") or "")))
        roman.update(re.findall(r"[a-z]+", fold(s.get("first_line") or "")))
        docs.append(
            {
                "number": s["number"],
                "title": s.get("title") or "",
                "first_line": s.get("first_line") or "",
                "tokens": main_tokens,
                "grams": grams,
                "roman": roman,
                "n_words": max(len(main_tokens), 1),
                "has_meaning": bool(meaning),
                "has_central_idea": bool(central),
                "had_variants": had_variants,
                "purport": bool(purport),
            }
        )
    return docs


# ----------------------------------------------------------------------------------------------------------------------
# lexicon scoring
# ----------------------------------------------------------------------------------------------------------------------


def document_frequency(docs) -> Counter:
    df: Counter = Counter()
    for d in docs:
        df.update(d["grams"].keys())
    return df


def idf_factor(df_t: int, n_docs: int) -> float:
    if df_t <= 0:
        return 1.0
    return float(min(1.0, max(0.25, math.log(n_docs / df_t) / math.log(n_docs / 20))))


def compile_facet(facet: dict) -> dict:
    values = []
    for v in facet["values"]:
        terms = {}
        disp = {}
        for t, w in v["terms"].items():
            st = stem_term(t)
            if float(w) >= terms.get(st, 0):
                terms[st] = float(w)
                disp[st] = t  # editors read the original word, not the stem
        roman = {fold(t): float(w) for t, w in (v.get("roman") or {}).items()}
        values.append({**v, "_terms": terms, "_roman": roman, "_disp": disp})
    return {**facet, "values": values}


def lexicon_scores(docs, facet: dict, df: Counter, n_docs: int):
    """Return (scores [n_docs x n_values], evidence [n_docs][n_values] -> list of (term, contribution))."""
    values = facet["values"]
    scores = np.zeros((len(docs), len(values)), dtype=np.float64)
    evidence: list[list[list[tuple[str, float]]]] = [[[] for _ in values] for _ in docs]
    idf_cache: dict[str, float] = {}
    for i, d in enumerate(docs):
        norm = (d["n_words"] / 86.0) ** 0.3
        for j, v in enumerate(values):
            total = 0.0
            ev = []
            for term, w in v["_terms"].items():
                c = d["grams"].get(term, 0)
                if not c:
                    continue
                f = idf_cache.get(term)
                if f is None:
                    f = idf_factor(df.get(term, 0), n_docs)
                    idf_cache[term] = f
                contrib = w * (1.0 + math.log(c)) * f
                total += contrib
                ev.append((v["_disp"].get(term, term), contrib))
            for term, w in v["_roman"].items():
                c = d["roman"].get(term, 0)
                if c:
                    contrib = w * (1.0 + math.log(c)) * 0.8
                    total += contrib
                    ev.append((f"lyric:{term}", contrib))
            scores[i, j] = total / norm
            ev.sort(key=lambda x: -x[1])
            evidence[i][j] = ev
    return scores, evidence


# ----------------------------------------------------------------------------------------------------------------------
# TF-IDF matrix for the self-training step and the clustering check
# ----------------------------------------------------------------------------------------------------------------------


def build_tfidf(docs, min_df: int = 5):
    df: Counter = Counter()
    for d in docs:
        df.update(set(t for t in d["tokens"] if t not in STOPWORDS and len(t) > 2))
    vocab = sorted(t for t, c in df.items() if c >= min_df)
    index = {t: i for i, t in enumerate(vocab)}
    n = len(docs)
    X = np.zeros((n, len(vocab)), dtype=np.float32)
    idf = np.array([math.log((1 + n) / (1 + df[t])) + 1.0 for t in vocab], dtype=np.float32)
    for i, d in enumerate(docs):
        cnt = Counter(t for t in d["tokens"] if t in index)
        for t, c in cnt.items():
            X[i, index[t]] = (1.0 + math.log(c)) * idf[index[t]]
        norm = np.linalg.norm(X[i])
        if norm > 0:
            X[i] /= norm
    return X, vocab, df


def centroid_z(X, scores, min_score, lam_labels=1.6, margin=0.3):
    """Self-training: pseudo-label songs with a clear lexicon winner, build leave-one-out centroids, return z-scores."""
    n, k = scores.shape
    top = scores.argmax(axis=1)
    top_s = scores.max(axis=1)
    srt = np.sort(scores, axis=1)
    second = srt[:, -2] if k > 1 else np.zeros(n)
    labelled = (top_s >= lam_labels * min_score) & ((top_s - second) >= margin * top_s)
    sums = np.zeros((k, X.shape[1]), dtype=np.float64)
    counts = np.zeros(k, dtype=np.int64)
    for i in np.where(labelled)[0]:
        sums[top[i]] += X[i]
        counts[top[i]] += 1
    cos = np.zeros((n, k), dtype=np.float64)
    for v in range(k):
        if counts[v] < 3:
            continue
        for i in range(n):
            s = sums[v]
            c = counts[v]
            if labelled[i] and top[i] == v:
                s = s - X[i]
                c -= 1
            cen = s / max(c, 1)
            nrm = np.linalg.norm(cen)
            cos[i, v] = float(X[i] @ cen / nrm) if nrm > 0 else 0.0
    z = np.zeros_like(cos)
    for v in range(k):
        col = cos[:, v]
        sd = col.std() or 1.0
        z[:, v] = (col - col.mean()) / sd
    return np.clip(z, 0, 3.0), labelled, counts


def lexicon_suggestions(X, vocab, labelled, top, k, values, seed_terms, n_terms=15):
    """Words that are over-represented in the pseudo-labelled songs of a value and are not yet seeds (for editors)."""
    out = {}
    overall = X.mean(axis=0) + 1e-6
    for v in range(k):
        rows = np.where(labelled & (top == v))[0]
        if len(rows) < 5:
            out[values[v]["id"]] = []
            continue
        m = X[rows].mean(axis=0)
        ratio = (m + 1e-6) / overall
        cand = np.argsort(-(m * np.log(ratio + 1)))[: 200]
        got = []
        for ci in cand:
            t = vocab[ci]
            if t in seed_terms[v] or ratio[ci] < 1.5:
                continue
            got.append(t)
            if len(got) >= n_terms:
                break
        out[values[v]["id"]] = got
    return out


def kmeans(X, k, seed=7, iters=40):
    rng = np.random.default_rng(seed)
    centers = X[rng.choice(len(X), k, replace=False)]
    for _ in range(iters):
        sims = X @ centers.T
        lab = sims.argmax(axis=1)
        new = np.array([X[lab == c].mean(axis=0) if (lab == c).any() else centers[c] for c in range(k)])
        new /= np.linalg.norm(new, axis=1, keepdims=True) + 1e-9
        if np.allclose(new, centers, atol=1e-5):
            break
        centers = new
    return lab, centers


# ----------------------------------------------------------------------------------------------------------------------
# assignment of one facet
# ----------------------------------------------------------------------------------------------------------------------


def assign_facet(docs, facet, scores, z, evidence, lam=0.7):
    values = facet["values"]
    min_score = facet["min_score"]
    max_sec = facet.get("max_secondary", 2)
    final = scores + (lam * z if z is not None else 0.0)
    fb_id = facet.get("fallback_value")
    fb_idx = next((j for j, v in enumerate(values) if v["id"] == fb_id), None) if fb_id else None
    out = []
    for i, d in enumerate(docs):
        row = final[i].copy()
        used_default = False
        if fb_idx is not None:
            # Almost every song addresses the Beloved, so "devotion" is the default subject. A specific subject must
            # beat that baseline by a margin; otherwise the song stays under the default and is flagged low-confidence.
            base = facet.get("fallback_baseline", 3.0) + float(scores[i, fb_idx])
            row[fb_idx] = base
            best_specific = max((row[j] for j in range(len(values)) if j != fb_idx), default=0.0)
            if best_specific < facet.get("fallback_margin", 1.25) * base:
                used_default = True
        order = np.argsort(-row)
        top = int(order[0])
        if used_default:
            top = fb_idx
            order = np.array([fb_idx] + [int(j) for j in np.argsort(-row) if j != fb_idx])
        s_top = float(row[top])
        lex_top = float(scores[i, top])
        if not d["has_meaning"] or (s_top < min_score and not used_default):
            out.append(None)
            continue
        second_s = float(row[order[1]]) if len(order) > 1 else 0.0
        secondary = []
        for j in order[1 : 1 + max_sec + 1]:
            if len(secondary) >= max_sec:
                break
            if row[j] >= max(min_score, 0.55 * s_top) or (used_default and row[j] >= min_score):
                secondary.append(values[int(j)]["id"])
        ev_strength = s_top / (s_top + 4.0)
        margin = 1.0 - (second_s / s_top if s_top else 1.0)
        conf = ev_strength * (0.5 + 0.5 * margin)
        hits = evidence[i][top]
        basis = "lexicon" if lex_top >= min_score * 0.6 and hits else "model-only"
        if used_default:
            basis = "default" if not (lex_top >= min_score * 0.6 and hits) else "lexicon"
            conf = min(conf, 0.2) if basis == "default" else min(conf, 0.35)
            secondary = [x for x in secondary if x != fb_id]
        if basis == "model-only":
            conf = min(conf, 0.25)
        out.append(
            {
                "primary": values[top]["id"],
                "secondary": secondary,
                "confidence": round(float(conf), 3),
                "basis": basis,
                "evidence": [t for t, _ in hits[:6]],
                "score": round(s_top, 2),
                "reliability": values[top].get("draft_reliability", "untested"),
            }
        )
    return out


def assign_multi(docs, facet, scores, evidence):
    """Time of day, season, imagery: every value above the threshold, best first, up to 1 + max_secondary."""
    values = facet["values"]
    min_score = facet["min_score"]
    cap = 1 + facet.get("max_secondary", 1)
    out = []
    for i, d in enumerate(docs):
        row = scores[i]
        order = [int(j) for j in np.argsort(-row) if row[j] >= min_score]
        if not order or not d["has_meaning"]:
            out.append([])
            continue
        top_s = row[order[0]]
        picks = [j for j in order if row[j] >= 0.5 * top_s][:cap]
        out.append(
            [
                {
                    "id": values[j]["id"],
                    "score": round(float(row[j]), 2),
                    "evidence": [t for t, _ in evidence[i][j][:4]],
                }
                for j in picks
            ]
        )
    return out


# ----------------------------------------------------------------------------------------------------------------------
# deterministic source tags
# ----------------------------------------------------------------------------------------------------------------------


def norm_cat(text: str) -> str:
    return fold(text).replace("'", "").replace("’", "")


def match_tag(cat_norm: str, cat_tokens: set[str], patterns: list[str]) -> bool:
    for p in patterns:
        pn = norm_cat(p)
        if len(pn) <= 4:
            if pn in cat_tokens:
                return True
        elif pn in cat_norm:
            return True
    return False


def source_tags(song, taxonomy):
    meta = song.get("metadata_json") or {}
    cat = meta.get("category") or ""
    theme_label = song.get("theme") or meta.get("official_theme_label") or ""
    cat_norm = norm_cat(cat)
    cat_tokens = set(re.findall(r"[a-z]+", cat_norm))
    tags = taxonomy["source_tags"]
    figures = [k for k, v in tags["figure"].items() if match_tag(cat_norm, cat_tokens, v["match"])]
    languages = [k for k, v in tags["language"].items() if match_tag(cat_norm, cat_tokens, v["match"])]
    forms = [k for k, v in tags["form"].items() if match_tag(cat_norm, cat_tokens, v["match"])]
    code = None
    m = re.match(r"^\s*([KD](?:f|m)?(?:\s*\+\s*[KD](?:f|m)?)*)\b", cat.strip(), flags=re.I)
    if m:
        code = re.sub(r"\s+", "", m.group(1)).upper().replace("F", "f").replace("M", "m")
    date = meta.get("date") or ""
    year = None
    ym = re.search(r"(19[89]\d)", date)
    if ym:
        year = int(ym.group(1))
    return {
        "source_category": cat or None,
        "source_code": code,
        "figure": figures,
        "language": languages,
        "form": forms,
        "year": year,
        "lyric_lines": len([ln for ln in (song.get("lyrics_original") or "").split("\n") if ln.strip()]),
        "official_theme_label": theme_label or None,
    }


def curated_membership(collections):
    by_song: dict[int, list[dict]] = defaultdict(list)
    for c in collections:
        for n in c["song_numbers"]:
            by_song[n].append({"kind": c["category"], "label": c["label"]})
    return by_song


# ----------------------------------------------------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------------------------------------------------


def histogram(values, bins):
    h = Counter()
    for v in values:
        for lo, hi, name in bins:
            if lo <= v < hi:
                h[name] += 1
                break
    return {name: h.get(name, 0) for _, _, name in bins}


BINS = [(0.0, 0.2, "0.0-0.2"), (0.2, 0.3, "0.2-0.3"), (0.3, 0.4, "0.3-0.4"), (0.4, 0.5, "0.4-0.5"), (0.5, 0.6, "0.5-0.6"), (0.6, 1.01, "0.6-1.0")]


def band(conf: float) -> str:
    if conf >= 0.45:
        return "high"
    if conf >= 0.30:
        return "medium"
    return "low"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--suffix", default="v0", help="output file suffix")
    ap.add_argument("--no-model", action="store_true", help="lexicon only, skip the centroid step")
    args = ap.parse_args()

    songs, collections, taxonomy = load_inputs()
    docs = build_documents(songs)
    n = len(docs)
    df = document_frequency(docs)
    facets = {k: compile_facet(v) for k, v in taxonomy["facets"].items()}

    X, vocab, _ = build_tfidf(docs)

    results: dict[str, list] = {}
    report: dict = {"suggestions": {}}
    for fname in ("feeling", "subject"):
        f = facets[fname]
        sc, ev = lexicon_scores(docs, f, df, n)
        if args.no_model:
            z = None
            labelled = np.zeros(n, dtype=bool)
            counts = np.zeros(len(f["values"]), dtype=int)
        else:
            z, labelled, counts = centroid_z(X, sc, f["min_score"])
        results[fname] = assign_facet(docs, f, sc, z, ev)
        top = sc.argmax(axis=1)
        report["suggestions"][fname] = lexicon_suggestions(
            X, vocab, labelled, top, len(f["values"]), f["values"], [set(v["_terms"]) for v in f["values"]]
        )
        report.setdefault("pseudo_labels", {})[fname] = {
            f["values"][j]["id"]: int(counts[j]) for j in range(len(f["values"]))
        }
    for fname in ("time_of_day", "season", "imagery"):
        f = facets[fname]
        sc, ev = lexicon_scores(docs, f, df, n)
        results[fname] = assign_multi(docs, f, sc, ev)

    curated = curated_membership(collections)
    out_songs = {}
    for i, (s, d) in enumerate(zip(songs, docs)):
        num = s["number"]
        entry = {
            "title": s.get("title"),
            "feeling": results["feeling"][i],
            "subject": results["subject"][i],
            "time_of_day": results["time_of_day"][i],
            "season": results["season"][i],
            "imagery": results["imagery"][i],
            "source": source_tags(s, taxonomy),
            "curated": curated.get(num, []),
            "flags": [],
        }
        if not d["has_meaning"]:
            entry["flags"].append("no_english_meaning")
        if d["had_variants"]:
            entry["flags"].append("meaning_has_variants")
        confs = [x["confidence"] for x in (entry["feeling"], entry["subject"]) if x]
        entry["confidence"] = round(min(confs), 3) if confs else 0.0
        weak = any(x and x["reliability"] == "weak" for x in (entry["feeling"], entry["subject"]))
        # review priority: lower = look at it sooner. Weak values (poor in the hand check) move up by 0.15.
        entry["review_priority"] = round(entry["confidence"] - (0.15 if weak else 0.0) - (0.05 if len(confs) < 2 else 0.0), 3)
        entry["band"] = band(entry["confidence"]) if len(confs) == 2 else ("partial" if confs else "uncovered")
        out_songs[str(num)] = entry

    # --- k-means sanity check (discovery of themes the taxonomy might miss)
    u, sing, vt = np.linalg.svd(X - X.mean(axis=0), full_matrices=False)
    Z = u[:, :60] * sing[:60]
    Z = (Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-9)).astype(np.float32)
    lab, _ = kmeans(Z, 14)
    clusters = []
    overall = X.mean(axis=0) + 1e-6
    for c in range(14):
        rows = np.where(lab == c)[0]
        m = X[rows].mean(axis=0)
        ratio = m / overall
        idx = np.argsort(-(m * np.log(ratio + 1)))[:12]
        subj = Counter((out_songs[str(docs[r]["number"])]["subject"] or {}).get("primary", "none") for r in rows)
        feel = Counter((out_songs[str(docs[r]["number"])]["feeling"] or {}).get("primary", "none") for r in rows)
        clusters.append(
            {
                "cluster": c,
                "size": int(len(rows)),
                "top_terms": [vocab[i] for i in idx],
                "subject_mix": dict(subj.most_common(4)),
                "feeling_mix": dict(feel.most_common(4)),
                "example_numbers": [docs[r]["number"] for r in rows[:5]],
            }
        )
    report["kmeans_check"] = sorted(clusters, key=lambda x: -x["size"])

    # --- coverage, histograms, counts per value
    for fname in ("feeling", "subject"):
        rows = [out_songs[k][fname] for k in out_songs]
        assigned = [r for r in rows if r]
        report[f"{fname}_coverage"] = {
            "assigned": len(assigned),
            "unassigned": len(rows) - len(assigned),
            "model_only": sum(1 for r in assigned if r["basis"] == "model-only"),
            "confidence_histogram": histogram([r["confidence"] for r in assigned], BINS),
            "primary_counts": dict(Counter(r["primary"] for r in assigned).most_common()),
            "with_any_secondary": sum(1 for r in assigned if r["secondary"]),
            "any_count_incl_secondary": dict(
                Counter([r["primary"] for r in assigned] + [x for r in assigned for x in r["secondary"]]).most_common()
            ),
        }
    for fname in ("time_of_day", "season", "imagery"):
        rows = [out_songs[k][fname] for k in out_songs]
        report[f"{fname}_coverage"] = {
            "songs_with_any": sum(1 for r in rows if r),
            "counts": dict(Counter(x["id"] for r in rows for x in r).most_common()),
        }
    report["bands"] = dict(Counter(v["band"] for v in out_songs.values()))
    report["overall_confidence_histogram"] = histogram(
        [v["confidence"] for v in out_songs.values() if v["band"] != "uncovered"], BINS
    )
    tags = [v["source"] for v in out_songs.values()]
    report["source_tags"] = {
        "figure": dict(Counter(x for t in tags for x in t["figure"])),
        "language": dict(Counter(x for t in tags for x in t["language"])),
        "form": dict(Counter(x for t in tags for x in t["form"])),
        "source_code": dict(Counter(t["source_code"] for t in tags).most_common(12)),
        "year": dict(sorted(Counter(t["year"] for t in tags if t["year"]).items())),
        "no_year": sum(1 for t in tags if not t["year"]),
    }
    cur = {int(k) for k, v in out_songs.items() if v["curated"]}
    report["curated"] = {
        "songs_in_any_collection": len(cur),
        "songs_in_none": n - len(cur),
        "no_feeling_and_not_curated": sum(1 for k, v in out_songs.items() if not v["feeling"] and not v["curated"]),
    }

    # --- review queue and spot-check sample
    queue_rows = sorted(
        out_songs.items(), key=lambda kv: (kv[1]["review_priority"], int(kv[0]))
    )
    with (PROPOSALS / f"review_queue_{args.suffix}.csv").open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["number", "title", "band", "confidence", "review_priority", "feeling_primary", "feeling_secondary", "subject_primary", "subject_secondary", "evidence", "reviewer_verdict(ok/change/skip)", "reviewer_feeling", "reviewer_subject", "reviewer_note"])
        for k, v in queue_rows:
            fe, su = v["feeling"], v["subject"]
            ev = "; ".join(((su or {}).get("evidence") or [])[:3] + ((fe or {}).get("evidence") or [])[:3])
            w.writerow([k, v["title"], v["band"], v["confidence"], v["review_priority"], (fe or {}).get("primary", ""), "|".join((fe or {}).get("secondary", [])), (su or {}).get("primary", ""), "|".join((su or {}).get("secondary", [])), ev, "", "", "", ""])

    rng = random.Random(20261105)
    strata: dict[str, list[str]] = defaultdict(list)
    for k, v in out_songs.items():
        strata[(v["subject"] or {}).get("primary", "none")].append(k)
    picks: list[str] = []
    total = sum(len(x) for x in strata.values())
    for key, nums in sorted(strata.items()):
        take = max(2, round(100 * len(nums) / total))
        picks += rng.sample(nums, min(take, len(nums)))
    rng.shuffle(picks)
    picks = sorted(picks[:100], key=int)
    with (PROPOSALS / f"spot_check_sample_{args.suffix}.csv").open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["number", "title", "feeling_primary", "subject_primary", "confidence", "reviewer_verdict(ok/change)", "reviewer_feeling", "reviewer_subject", "reviewer_note"])
        for k in picks:
            v = out_songs[k]
            w.writerow([k, v["title"], (v["feeling"] or {}).get("primary", ""), (v["subject"] or {}).get("primary", ""), v["confidence"], "", "", "", ""])

    payload = {
        "meta": {
            "status": "MACHINE DRAFT. Not reviewed. Do not show in the app before human review.",
            "version": args.suffix,
            "method": "seed lexicon + self-trained TF-IDF centroids (offline). No embeddings, no API keys.",
            "songs": n,
            "taxonomy": "data/proposals/song_taxonomy_v0.json",
            "confidence_bands": "high >= 0.45, medium 0.30-0.45, low < 0.30 (relative ranks, NOT probabilities; the hand check showed the subject confidence does not separate right from wrong). 'partial' = only one of feeling/subject assigned; 'uncovered' = neither.",
            "ids": {fname: [{"id": v["id"], "label": v["label"]} for v in facets[fname]["values"]] for fname in facets},
        },
        "songs": out_songs,
        "review": {
            "uncovered": [int(k) for k, v in out_songs.items() if v["band"] == "uncovered"],
            "partial_no_feeling_or_no_subject": [int(k) for k, v in out_songs.items() if v["band"] == "partial"],
            "low_confidence": [int(k) for k, v in queue_rows if v["band"] == "low"],
            "queue_order": "review_queue_" + args.suffix + ".csv, ascending review_priority",
            "spot_check_sample": [int(k) for k in picks],
        },
    }
    (PROPOSALS / f"song_categories_{args.suffix}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    (PROPOSALS / f"pipeline_report_{args.suffix}.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))

    print("songs", n, "| bands", report["bands"])
    for fname in ("feeling", "subject"):
        print(fname, report[f"{fname}_coverage"]["assigned"], "assigned;", report[f"{fname}_coverage"]["primary_counts"])
    for fname in ("time_of_day", "season", "imagery"):
        print(fname, report[f"{fname}_coverage"]["songs_with_any"], report[f"{fname}_coverage"]["counts"])


if __name__ == "__main__":
    main()
