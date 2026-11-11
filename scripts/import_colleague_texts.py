#!/usr/bin/env python3
"""Colleagues' Prabhat Samgiita texts (docx archive) -> data/curated/ps_colleagues/.

Reads the archive `тексты-*.zip` (231 files `PS_<number>.docx` + 2 chord PDFs), parses every docx
(chord charts, translations in en / ru / uk / fr) and writes plain JSON next to the app's data.
Standard library only. Nothing here touches a database or the network.

    python3 scripts/import_colleague_texts.py                 # dry run: counts and differences, writes nothing
    python3 scripts/import_colleague_texts.py --write         # writes data/curated/ps_colleagues/*.json

Idempotent: the output depends only on the archive and `data/generated/songs.json`, so a second run
rewrites the same bytes. Before a file is overwritten with different content, the old one is copied to
`data/curated/ps_colleagues/backup/`. The previous English translation of every song the archive touches
is saved once in `backup/prior_english_meaning.json` (read from `songs.json`, which is never edited).

Rules kept here (Dada, 2026-11-11): nothing is invented and nothing is corrected. Chord lines are kept
character for character (only the no-break space is turned into a plain space, the same width), so a chord
stays above the same letter. Section labels in the documents are sometimes wrong (an "(EN)" section that
holds French); the language of a translation is therefore detected from its words and every disagreement
with the label is reported. Whatever is unclear stays empty and is listed in `report.json`.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "data" / "curated" / "ps_colleagues"
SONGS = REPO / "data" / "generated" / "songs.json"
DEFAULT_ZIP = Path.home() / "Downloads" / "тексты-20261111T150500Z-1-001.zip"

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
HDR = re.compile(r"\(\s*(EN|ENG|RU|UA|UА|UKR|FR|CAPO|САРО|CАРО|CAРО)\s*(\d*)\s*\)\s*", re.I)
HDR_START = re.compile(r"^\s*(#|No\.|\d|CHORDS\b)")
CAPO_ONLY = re.compile(r"^\s*\(?\s*(CAPO|САРО|NO CAPO)\s*(\d*)\s*\)?\s*$", re.I)
MARK = re.compile(
    r"^\s*(Translated\s+from|Traduit\s+de|Перевод\s*[cс]?\s*(с|c)\s+|Перевод\s+с\s|Перевод\s+c\s"
    r"|Переклад\s|Перекладено\s|Перевод\s+Дады)",
    re.I,
)
CHORD = re.compile(r"^(?:[A-G][#b♯♭]?(?:m|maj|min|dim|aug|sus|add|M)?\d*(?:/[A-G][#b]?)?(?:\([^)]*\))?)(?:[xх]\d)?$")
HEADER_LANG = {"EN": "en", "ENG": "en", "RU": "ru", "UA": "uk", "UА": "uk", "UKR": "uk", "FR": "fr"}

FR_WORDS = set(
    "le la les de du des et je tu ton tes ta mon ma mes est dans pour qui que ne pas un une seigneur oh "
    "avec sur sans comme mais ou où il elle nous vous Te T’en suis es ai as à au aux se sa son".split()
)
EN_WORDS = set(
    "the and of to is in you your my me i with that are for this it on all not be as by from was O "
    "have has will can".lower().split()
)


# --------------------------------------------------------------------------- docx


def read_paragraphs(data: bytes, name: str) -> list[str]:
    """Text of every paragraph; a soft line break stays as a newline, a tab as a tab."""
    import io

    with zipfile.ZipFile(io.BytesIO(data)) as z:
        xml = z.read("word/document.xml")
    if b"<!DOCTYPE" in xml or b"<!ENTITY" in xml:  # stdlib parser: refuse entity tricks in untrusted input
        raise SystemExit(f"{name}: document type declaration found, refusing to parse")
    root = ET.fromstring(xml)
    body = root.find(W + "body")
    out: list[str] = []
    for el in body:
        if el.tag == W + "p":
            s = ""
            for r in el.iter():
                if r.tag == W + "t":
                    s += r.text or ""
                elif r.tag == W + "tab":
                    s += "\t"
                elif r.tag == W + "br":
                    s += "\n"
            out.append(s)
        elif el.tag == W + "tbl":  # none in this archive; a table would be a surprise
            raise SystemExit(f"{name}: unexpected table")
    return out


def norm(s: str) -> str:
    return s.replace("\xa0", " ")


def is_caps(line: str) -> bool:
    letters = [c for c in line if c.isalpha()]
    return bool(letters) and not any(c.islower() for c in letters)


def is_chord_line(line: str) -> bool:
    tokens = norm(line).split()
    if not tokens:
        return False
    ok = all(
        CHORD.match(t) or t in ("|", "-", "/", ".", "%", "N.C.") or re.match(r"^\(?[xх]\d\)?$", t)
        for t in tokens
    )
    return ok and any(CHORD.match(t) for t in tokens)


def date_like(line: str) -> bool:
    if re.search(r"\b(1[89]\d\d|20\d\d)\b", line) and len(line) < 45 and not is_caps(line):
        return True
    return bool(re.match(r"^\s*(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+\w+\s*,?\s*\d{4})", line))


def split_sections(paragraphs: list[str]):
    """-> (preamble lines, sections). A section starts at a line like `3570 (EN)` or `(CAPO 2)`."""
    sections: list[dict] = []
    current = None
    pre: list[str] = []
    for text in paragraphs:
        buf: list[str] = []
        for ln in text.split("\n"):
            m = HDR.search(ln.strip()) if HDR_START.match(ln) else None
            c = CAPO_ONLY.match(ln)
            if (m and len(ln.strip()) < 90) or c:
                (current["lines"] if current is not None else pre).extend(buf)
                buf = []
                if m:
                    code, number = m.group(1).upper(), m.group(2)
                    kind = "chords" if code in ("CAPO", "САРО", "CАРО", "CAРО") else "text"
                else:
                    code, number, kind = c.group(1).upper(), c.group(2), "chords"
                    if code == "NO CAPO":
                        number = "none"
                current = {"header": ln.strip(), "code": code, "capo": number, "kind": kind, "lines": []}
                sections.append(current)
            else:
                buf.append(ln)
        (current["lines"] if current is not None else pre).extend(buf)
        if current is not None:
            current["lines"].append("\x00P")  # paragraph boundary
    return pre, sections


def parse_text_section(lines: list[str]) -> dict:
    flat: list[str] = []
    for x in lines:
        if x == "\x00P":
            if flat and flat[-1] != "":
                flat.append("")
        else:
            flat.append(x.rstrip() if x.strip() else "")
    while flat and flat[0] == "":
        flat.pop(0)
    while flat and flat[-1] == "":
        flat.pop()
    i = 0
    while i < len(flat) and (flat[i] == "" or is_caps(flat[i])):
        i += 1
    translit, rest = flat[:i], flat[i:]
    mi = next((k for k, x in enumerate(rest) if MARK.match(x)), None)
    body, footer, trailing = (rest, None, []) if mi is None else (rest[:mi], rest[mi], rest[mi + 1 :])
    # a header of the next section (`1  JYOTIRGIITA`) can be left at the end of the body
    while body and (body[-1] == "" or (re.match(r"^\s*\d+\s+\S", body[-1]) and is_caps(body[-1]))):
        body.pop()
    while body and body[0] == "":
        body.pop(0)
    date = None
    if body and date_like(body[0]):
        date = body.pop(0)
    while body and body[0] == "":
        body.pop(0)
    title = None
    if body and is_caps(body[0]) and not date_like(body[0]):
        t = []
        while body and body[0] != "" and is_caps(body[0]):
            t.append(body.pop(0))
        title = " ".join(t)
    while body and body[0] == "":
        body.pop(0)
    collapsed: list[str] = []
    for x in body:
        if x == "" and collapsed and collapsed[-1] == "":
            continue
        collapsed.append(x)
    # without a "Translated from" line the romanised lyric can follow the translation: cut it off
    # (two Latin all-caps lines in a row after at least one translation line)
    def roman(x: str) -> bool:
        return is_caps(x) and bool(re.search("[A-ZÁÍÚŚŃ]{3,}", x)) and not re.search("[А-Яа-я]", x)

    nonblank = [k for k, x in enumerate(collapsed) if x]
    for pos, k in enumerate(nonblank[:-1]):
        if pos > 0 and roman(collapsed[k]) and roman(collapsed[nonblank[pos + 1]]):
            trailing = [x for x in collapsed[k:] if x] + trailing
            collapsed = collapsed[:k]
            break
    return {
        "romanisation_lines": [x for x in translit if x],
        "date_line": date,
        "title_line": title,
        "text": "\n".join(collapsed).strip("\n"),
        "lines": [x for x in collapsed if x],
        "source_note": footer,
        "after_note_lines": [x for x in trailing if x],
    }


def detect_language(text: str, fallback: str) -> str:
    cyr = sum("Ѐ" <= c <= "ӿ" for c in text)
    lat = sum(c.isascii() and c.isalpha() or "À" <= c <= "ɏ" for c in text)
    if cyr > lat:
        if re.search("[іїєґІЇЄҐ]", text):
            return "uk"
        if re.search("[ыэъёЫЭЪЁ]", text):
            return "ru"
        return fallback if fallback in ("ru", "uk") else "ru"
    words = re.findall(r"[\wÀ-ɏ’']+", text)
    fr = sum(w in FR_WORDS or w.lower() in FR_WORDS for w in words)
    en = sum(w.lower() in EN_WORDS for w in words)
    if fr > en:
        return "fr"
    if en > fr:
        return "en"
    return fallback


def chord_chart(section: dict) -> dict:
    raw = [x for x in section["lines"] if x != "\x00P"]
    lines = [norm(x).rstrip() for x in raw]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    placements = []
    for idx, line in enumerate(lines):
        if not is_chord_line(line):
            continue
        j = idx + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        lyric_idx = j if j < len(lines) and not is_chord_line(lines[j]) else None
        for m in re.finditer(r"\S+", line):
            tok = m.group(0)
            if not CHORD.match(tok):
                continue
            under = None
            if lyric_idx is not None:
                ly = lines[lyric_idx]
                col = m.start()
                if col < len(ly) and ly[col] != " ":
                    a = col
                    while a > 0 and ly[a - 1] != " ":
                        a -= 1
                    b = col
                    while b < len(ly) and ly[b] != " ":
                        b += 1
                    under = ly[a:b]
            placements.append({"line": idx, "col": m.start(), "chord": re.sub(r"[xх]\d$", "", tok), "lyric_line": lyric_idx, "under_word": under})
    capo = section["capo"]
    return {
        "capo": None if capo == "" else capo,
        "capo_note": "capo not stated in the document" if capo == "" else None,
        "header": section["header"],
        "lines": lines,
        "placements": placements,
    }


def parse_docx(ps: int, data: bytes, name: str) -> dict:
    pre, sections = split_sections(read_paragraphs(data, name))
    rec = {"chords": [], "translations": {}, "extra_versions": [], "flags": []}
    pre_lines = [x for x in pre if x.strip()]
    if len(pre_lines) > 8 and re.match(r"^\s*(#|\d)", pre_lines[0]):
        # a text section whose heading carries no (EN)/(RU) label: take the language from the words
        first = next(k for k, x in enumerate(pre) if x.strip())
        d = parse_text_section(pre[first + 1 :])
        d["header"] = pre_lines[0].strip()
        if d["text"]:
            lang = detect_language(d["text"], "en")
            d["language"] = lang
            rec["translations"][lang] = d
            rec["flags"].append(f"heading {pre_lines[0].strip()!r} has no language label: read as {lang} from the words")
            pre = []
    for s in sections:
        if s["kind"] == "chords":
            rec["chords"].append(chord_chart(s))
            continue
        label = HEADER_LANG.get(s["code"], s["code"].lower())
        d = parse_text_section(s["lines"])
        d["header"] = s["header"]
        lang = detect_language(d["text"], label) if d["text"] else label
        if d["text"] and lang != label:
            rec["flags"].append(f"section labelled {s['code']} holds {lang}")
        d["language"] = lang
        if not d["text"]:
            rec["flags"].append(f"section labelled {s['code']}: no translation text found")
            continue
        if lang in rec["translations"]:
            rec["extra_versions"].append(d)
            rec["flags"].append(f"second {lang} text in the document (kept as extra version)")
        else:
            rec["translations"][lang] = d
    if len(rec["chords"]) > 1:
        rec["flags"].append("more than one chord chart")
    if pre and any(x.strip() for x in pre):
        rec["flags"].append("text before the first section: " + " / ".join(x.strip() for x in pre if x.strip())[:120])
    for lang, d in rec["translations"].items():
        if any(is_caps(x) and re.search("[A-Z]{4,}", x) for x in d["lines"]):
            rec["flags"].append(f"{lang}: translation holds an all-caps line (maybe romanised lyric)")
    return rec


# --------------------------------------------------------------------------- the two chord PDFs


def read_pdf_charts(data: bytes) -> dict[int, dict]:
    """Song number -> {capo, chord_lines} from a chord sheet PDF (needs `pdftotext`; empty dict without it).

    Only the capo label and the chord lines are kept: pdftotext loses some accented letters of the lyric.
    """
    import subprocess
    import tempfile

    if not shutil.which("pdftotext"):
        return {}
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(data)
        f.flush()
        text = subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, text=True, check=True).stdout
    lines = text.replace("\f", "\n").split("\n")
    marks = [i for i, ln in enumerate(lines) if re.fullmatch(r"\s*#?\d{1,4}\s*", ln)]
    out: dict[int, dict] = {}
    for a, b in zip(marks, marks[1:] + [len(lines)]):
        num = int(lines[a].strip().lstrip("#"))
        chunk = lines[a + 1 : b]
        capo = None
        for ln in chunk:
            m = re.fullmatch(r"\s*(no capo|capo\s*(\d+))\s*", ln, re.I)
            if m:
                capo = "none" if m.group(1).lower() == "no capo" else m.group(2)
                break
        out[num] = {"capo": capo, "chord_lines": [ln.rstrip() for ln in chunk if is_chord_line(ln)]}
    return out


# --------------------------------------------------------------------------- comparison


def simplify(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def letters_only(text: str) -> str:
    return re.sub(r"[\W_]+", "", text).lower()


def compare_en(docx_text: str, was: str | None) -> str:
    if not was:
        return "app_has_none"
    versions = [v for v in re.split(r"^[ \t]*-{3,}[ \t]*$", was, flags=re.M)]
    if any(simplify(docx_text) == simplify(v) for v in versions):
        return "same"
    if any(letters_only(docx_text) == letters_only(v) for v in versions):
        return "line_breaks_or_punctuation_only"
    return "different"


# --------------------------------------------------------------------------- main


def dump(path: Path, obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1, sort_keys=False) + "\n"


def write_with_backup(path: Path, content: str) -> str:
    if path.exists():
        if path.read_text(encoding="utf-8") == content:
            return "unchanged"
        backup = OUT / "backup"
        backup.mkdir(parents=True, exist_ok=True)
        n = 1
        while (backup / f"{path.stem}.{n}{path.suffix}").exists():
            n += 1
        shutil.copy2(path, backup / f"{path.stem}.{n}{path.suffix}")
        status = "updated (old copy in backup/)"
    else:
        status = "created"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return status


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", type=Path, default=DEFAULT_ZIP)
    ap.add_argument("--write", action="store_true", help="write the JSON files (default is a dry run)")
    args = ap.parse_args()

    songs = {s["number"]: s for s in json.loads(SONGS.read_text(encoding="utf-8"))}
    parsed: dict[int, dict] = {}
    pdfs: list[str] = []
    pdf_charts: dict[int, dict] = {}
    with zipfile.ZipFile(args.zip) as z:
        for info in z.infolist():
            base = Path(info.filename).name
            if info.is_dir() or not base:
                continue
            m = re.fullmatch(r"PS_(\d+)\.docx", base)
            if m:
                parsed[int(m.group(1))] = parse_docx(int(m.group(1)), z.read(info), base)
            elif base.lower().endswith(".pdf"):
                pdfs.append(base)
                for num, item in read_pdf_charts(z.read(info)).items():
                    pdf_charts[num] = {"source_pdf": base, **item}

    unmatched = sorted(n for n in parsed if n not in songs)
    chords_out, trans_out, prior, diffs = {}, {}, {}, []
    counts = {"songs": len(parsed), "with_chords": 0}
    for lang in ("en", "ru", "uk", "fr"):
        counts[f"translation_{lang}"] = 0
    compare = {"same": 0, "line_breaks_or_punctuation_only": 0, "different": 0, "app_has_none": 0, "no_docx_en": 0}
    flags = {}
    for n in sorted(parsed):
        rec = parsed[n]
        key = str(n)
        if rec["flags"]:
            flags[key] = rec["flags"]
        if rec["chords"]:
            counts["with_chords"] += 1
            chords_out[key] = {"charts": rec["chords"]}
        if rec["translations"] or rec["extra_versions"]:
            t = {lang: d for lang, d in sorted(rec["translations"].items())}
            for lang in t:
                counts[f"translation_{lang}"] += 1
            trans_out[key] = {"translations": t, "extra_versions": rec["extra_versions"]}
        song = songs.get(n)
        en = rec["translations"].get("en")
        if song is None:
            continue
        was = song.get("english_meaning")
        if en is None:
            compare["no_docx_en"] += 1
            continue
        verdict = compare_en(en["text"], was)
        compare[verdict] += 1
        prior[key] = {"english_meaning": was}
        diffs.append({"ps": n, "verdict": verdict, "was": was, "now": en["text"]})

    def tokens(lines):
        return [t for ln in lines for t in norm(ln).split()]

    pdf_vs_docx = {}
    for num, item in sorted(pdf_charts.items()):
        docx = parsed.get(num)
        charts = docx["chords"] if docx else []
        docx_capo = charts[0]["capo"] if charts else None
        docx_tokens = [t for c in charts for ln in c["lines"] if is_chord_line(ln) for t in norm(ln).split()]
        pdf_tokens = tokens(item["chord_lines"])
        pdf_vs_docx[str(num)] = {
            "pdf_capo": item["capo"],
            "docx_capo": docx_capo,
            "capo_agrees": item["capo"] == docx_capo,
            "chord_sequence_agrees": pdf_tokens == docx_tokens,
            "pdf_chords": len(pdf_tokens),
            "docx_chords": len(docx_tokens),
            "in_docx_archive": docx is not None,
        }

    meta = {"source_archive": args.zip.name, "pdf_files": pdfs, "format": "see docs in scripts/import_colleague_texts.py"}
    report = {
        "counts": counts,
        "english_compared_with_app": compare,
        "not_in_app": unmatched,
        "flags_by_song": flags,
        "pdf_files": pdfs,
        "pdf_charts_vs_docx": pdf_vs_docx,
        "word_by_word": "none of the documents holds a word-by-word translation; nothing was generated",
    }
    files = {
        "chords.json": dump(OUT / "chords.json", {"_meta": meta, "songs": chords_out}),
        "translations.json": dump(OUT / "translations.json", {"_meta": meta, "songs": trans_out}),
        "chords_from_pdf.json": dump(OUT / "chords_from_pdf.json", {"_meta": meta, "songs": {str(k): v for k, v in sorted(pdf_charts.items())}}),
        "report.json": dump(OUT / "report.json", report),
        "diff_english.json": dump(OUT / "diff_english.json", diffs),
        "backup/prior_english_meaning.json": dump(OUT / "backup" / "prior_english_meaning.json", prior),
    }
    print(json.dumps(report["counts"], ensure_ascii=False))
    print("english vs app:", json.dumps(compare))
    print("not in app:", unmatched, "| flagged songs:", len(flags))
    if not args.write:
        print("dry run: nothing written (use --write)")
        return 0
    for name, content in files.items():
        print(f"{name}: {write_with_backup(OUT / name, content)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
