#!/usr/bin/env python3
"""Read the notes of the collection "50 PS s perevodom" (a MuseScore PDF, Leland/SMuFL font) into JSON.

The staff of that PDF is vector, not a picture: note heads, rests, flags, accidentals, dots, clefs and time signatures
are Leland glyphs (SMuFL code points); staff lines, stems, beams, barlines, slurs and volta brackets are paths. The
script reads those glyphs and paths with PyMuPDF and works out, for every song:

    number, title, tal, capo, key signature, Sa (and how it was found), chords, the notes of every bar
    (pitch, semitones above Sa, swara, length in quarter notes, rests, ties, syllable under the note, chord over it),
    voltas and repeats, and `doubts`: everything that did not read cleanly.

Nothing is guessed silently: a bar whose lengths do not add up to the time signature, a Sa that the key signature,
the chords and the last note do not agree on, a volta without a printed repeat sign: each lands in `doubts`.

Dry run by default (prints the summary, writes nothing). Needs only PyMuPDF:

    python3 -m venv .venv-psnotes && .venv-psnotes/bin/pip install pymupdf
    .venv-psnotes/bin/python scripts/ps_piano_from_pdf.py --pdf "50 PS s perevodom.pdf"                 # dry run
    .venv-psnotes/bin/python scripts/ps_piano_from_pdf.py --pdf "..." --write                          # data/curated/ps_piano_from_pdf/
    .venv-psnotes/bin/python scripts/ps_piano_from_pdf.py --pdf "..." --overlay /tmp/overlay --songs 1,2  # check pictures

It writes no database and calls no API.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import pymupdf  # PyMuPDF

# ---------------------------------------------------------------- SMuFL code points (Leland)
NOTE_WHOLE, NOTE_HALF, NOTE_BLACK = 0xE0A2, 0xE0A3, 0xE0A4
NOTEHEADS = {NOTE_WHOLE: 4.0, NOTE_HALF: 2.0, NOTE_BLACK: 1.0}
REST_LEN = {0xE4E3: None, 0xE4E4: 2.0, 0xE4E5: 1.0, 0xE4E6: 0.5, 0xE4E7: 0.25}  # whole rest = the whole bar
FLAG_UP, FLAG_DOWN = {0xE240: 1, 0xE242: 2, 0xE244: 3}, {0xE241: 1, 0xE243: 2, 0xE245: 3}
ACCIDENTAL = {0xE260: -1, 0xE261: 0, 0xE262: 1}
DOT = 0xE1E7
ORNAMENTS = {0xE567, 0xE56C, 0xE56D}  # turn / mordent family in Leland
CLEF_G, CLEF_G_8VB = 0xE050, 0xE052
REPEAT_DOTS = 0xE044
TIME_DIGITS = range(0xE080, 0xE08A)

# letters of the treble clef, C = 0 .. B = 6; the bottom line is E4
LETTERS = "CDEFGAB"
SEMITONE_OF_LETTER = [0, 2, 4, 5, 7, 9, 11]
SHARPS_ORDER = "FCGDAEB"
FLATS_ORDER = "BEADGCF"
PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]  # as the app's keys.ts names the tonics
SWARA = ["Sa", "re", "Re", "ga", "Ga", "Ma", "Ma#", "Pa", "dha", "Dha", "ni", "Ni"]
ROOT_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def swara_text(k: int) -> str:
    octave, base = divmod(k, 12)
    name = SWARA[base]
    return name + "'" * octave if octave > 0 else "." * (-octave) + name if octave < 0 else name


CYRILLIC_LOOKALIKES = str.maketrans("АВСЕНКМОРТавсе", "ABCEHKMOPTabce")
CHORD_RE = re.compile(r"^[A-G][#b♯♭]?(m|maj|dim|aug|sus|add|M)?\d*(/[A-G][#b♯♭]?)?$")


def pc_of_root(symbol: str) -> int | None:
    symbol = symbol.translate(CYRILLIC_LOOKALIKES)
    m = re.match(r"^([A-G])([#b♯♭]?)", symbol)
    if not m:
        return None
    acc = m.group(2)
    pc = ROOT_PC[m.group(1)] + (1 if acc in ("#", "♯") else -1 if acc in ("b", "♭") else 0)
    return pc % 12


def is_minor(symbol: str) -> bool:
    m = re.match(r"^[A-G][#b♯♭]?(m(?!aj))", symbol)
    return bool(m)


# ---------------------------------------------------------------- reading a page
class Glyph:
    __slots__ = ("code", "x", "y", "size", "font")

    def __init__(self, code: int, x: float, y: float, size: float, font: str):
        self.code, self.x, self.y, self.size, self.font = code, x, y, size, font

    def __repr__(self) -> str:
        return f"G({self.code:#x},{self.x:.1f},{self.y:.1f},{self.size:.0f})"


class Word:
    __slots__ = ("text", "x0", "x1", "y", "font", "size")

    def __init__(self, text: str, x0: float, x1: float, y: float, font: str, size: float):
        self.text, self.x0, self.x1, self.y, self.font, self.size = text, x0, x1, y, font, size

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    def __repr__(self) -> str:
        return f"W({self.text!r},{self.x0:.1f},{self.y:.1f})"


def read_text(page: pymupdf.Page) -> tuple[list[Glyph], list[Word]]:
    glyphs: list[Glyph] = []
    words: list[Word] = []
    for block in page.get_text("rawdict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                font, size = span["font"], span["size"]
                if font.startswith("Leland"):
                    for ch in span["chars"]:
                        glyphs.append(Glyph(ord(ch["c"]), ch["origin"][0], ch["origin"][1], size, font))
                    continue
                cur: list[dict] = []
                for ch in span["chars"] + [{"c": " ", "origin": (0, 0), "bbox": (0, 0, 0, 0)}]:
                    if ch["c"].isspace():
                        if cur:
                            words.append(Word("".join(c["c"] for c in cur), cur[0]["bbox"][0], cur[-1]["bbox"][2], cur[0]["origin"][1], font, size))
                            cur = []
                    else:
                        cur.append(ch)
    return glyphs, words


class Geometry:
    def __init__(self, page: pymupdf.Page):
        self.hlines: list[tuple[float, float, float, float]] = []  # y, x0, x1, width
        self.vlines: list[tuple[float, float, float, float]] = []  # x, y0, y1, width
        self.beams: list[list[tuple[float, float]]] = []
        self.curves: list[tuple[tuple[float, float], tuple[float, float], str]] = []
        self.polylines: list[list[tuple[float, float]]] = []
        for d in page.get_drawings():
            items = d["items"]
            width = d.get("width") or 0.0
            fill = d.get("fill")
            kinds = [it[0] for it in items]
            if d["type"] == "f" and fill is not None and sum(fill) < 0.5 and set(kinds) == {"l"} and len(items) >= 3:
                pts = [(it[1].x, it[1].y) for it in items] + [(items[-1][2].x, items[-1][2].y)]
                if d["rect"].width > 3 and d["rect"].height < 16:
                    self.beams.append(pts)
                continue
            if "c" in kinds and d["type"] in ("fs", "f") and len(items) <= 4 and kinds.count("c") >= 2:
                first = items[0]
                self.curves.append(((first[1].x, first[1].y), (first[4].x, first[4].y), "crescent"))
                continue
            if d["type"] == "s" and kinds == ["c", "c"]:
                self.curves.append(((items[0][1].x, items[0][1].y), (items[1][4].x, items[1][4].y), "stroke"))
                continue
            if d["type"] != "s":
                continue
            if kinds == ["l"]:
                p, q = items[0][1], items[0][2]
                if abs(p.y - q.y) < 0.05:
                    self.hlines.append((p.y, min(p.x, q.x), max(p.x, q.x), width))
                elif abs(p.x - q.x) < 0.05:
                    self.vlines.append((p.x, min(p.y, q.y), max(p.y, q.y), width))
            elif set(kinds) == {"l"} and 2 <= len(items) <= 4:
                pts = [(items[0][1].x, items[0][1].y)] + [(it[2].x, it[2].y) for it in items]
                self.polylines.append(pts)


class Staff:
    def __init__(self, ys: list[float], x0: float, x1: float):
        self.ys = ys
        self.top, self.bottom = ys[0], ys[-1]
        self.sp = (ys[-1] - ys[0]) / 4
        self.x0, self.x1 = x0, x1

    def step(self, y: float) -> int:
        """Half-spaces above the bottom line (E4 in the treble clef)."""
        return round((self.bottom - y) / (self.sp / 2))


def find_staves(geo: Geometry) -> list[Staff]:
    by_y: dict[float, list[tuple[float, float]]] = defaultdict(list)
    for y, x0, x1, w in geo.hlines:
        if 0.4 <= w <= 0.7 and x1 - x0 > 18:
            by_y[round(y, 1)].append((x0, x1))
    ys = sorted(by_y)
    staves: list[Staff] = []
    used: set[float] = set()
    for i, y in enumerate(ys):
        if y in used or i + 4 >= len(ys):
            continue
        group = ys[i : i + 5]
        gaps = [group[j + 1] - group[j] for j in range(4)]
        if max(gaps) - min(gaps) < 0.35 and 3.5 < gaps[0] < 7:
            segs = [s for g in group for s in by_y[g]]
            staves.append(Staff(group, min(s[0] for s in segs), max(s[1] for s in segs)))
            used.update(group)
    return staves


# ---------------------------------------------------------------- one system (a line of staff)
class Note:
    def __init__(self, x: float, y: float, staff: Staff, kind: str, size: float):
        self.x, self.y, self.kind = x, y, kind  # kind: whole/half/black/rest/restwhole
        self.step = staff.step(y)
        self.size = size
        self.dots = 0
        self.flags = 0
        self.accidental: int | None = None
        self.stem_x: float | None = None
        self.stem_up: bool | None = None
        self.rest_code = 0
        self.tie_next = False
        self.slur_next = False
        self.syllable: str | None = None
        self.chord: str | None = None
        self.letter = ""
        self.octave = 0
        self.alter = 0
        self.midi = 0
        self.beats = 0.0
        self.grace = False
        self.ornament = False
        self.tuplet = 0

    @property
    def is_rest(self) -> bool:
        return self.kind.startswith("rest")


def decode_pitch(note: Note, bar_accidentals: dict[tuple[str, int], int], key_alters: dict[str, int]) -> None:
    n = 2 + note.step  # E = 2
    note.letter = LETTERS[n % 7]
    note.octave = 4 + n // 7
    if note.accidental is not None:
        bar_accidentals[(note.letter, note.octave)] = note.accidental
    note.alter = bar_accidentals.get((note.letter, note.octave), key_alters.get(note.letter, 0))
    note.midi = 12 * (note.octave + 1) + SEMITONE_OF_LETTER[LETTERS.index(note.letter)] + note.alter


def key_alterations(count: int) -> dict[str, int]:
    if count > 0:
        return {l: 1 for l in SHARPS_ORDER[:count]}
    return {l: -1 for l in FLATS_ORDER[: -count]}


def key_tonic_pc(count: int) -> int:
    """Pitch class of the major tonic for a key signature (+sharps / -flats)."""
    return (count * 7) % 12


class Measure:
    def __init__(self, x0: float, x1: float):
        self.x0, self.x1 = x0, x1
        self.notes: list[Note] = []
        self.time = (4, 4)
        self.ends: str = "single"  # single / double / final / repeat_end / repeat_start
        self.letter: str | None = None
        self.volta: str | None = None
        self.number: int | None = None
        self.sum_beats = 0.0


class System:
    def __init__(self, page_no: int, staff: Staff, index: int):
        self.page_no, self.staff, self.index = page_no, staff, index
        self.measures: list[Measure] = []
        self.clef = CLEF_G
        self.key_count = 0
        self.first_number: int | None = None
        self.voltas: list[tuple[str, float, float]] = []


def parse_system(page_no: int, index: int, staff: Staff, glyphs: list[Glyph], words: list[Word], geo: Geometry, doubts: list[str], time_in: tuple[int, int] = (4, 4)) -> System:
    sysm = System(page_no, staff, index)
    sp = staff.sp
    near = lambda y: staff.top - 5 * sp <= y <= staff.bottom + 5 * sp
    gl = [g for g in glyphs if near(g.y) and staff.x0 - 2 <= g.x <= staff.x1 + 2]

    clefs = [g for g in gl if g.code in (CLEF_G, CLEF_G_8VB)]
    sysm.clef = clefs[0].code if clefs else CLEF_G
    if not clefs:
        doubts.append(f"p{page_no} system {index + 1}: no clef found, treble assumed")
    clef_x = clefs[0].x if clefs else staff.x0

    # ---- barlines
    cand = [(x, y0, y1, w) for x, y0, y1, w in geo.vlines if w >= 0.7 and abs(y0 - staff.top) < 1.5 and abs(y1 - staff.bottom) < 1.5 and staff.x0 - 1 <= x <= staff.x1 + 3]
    cand.sort()
    clusters: list[list[tuple[float, float, float, float]]] = []
    for c in cand:
        if clusters and c[0] - clusters[-1][-1][0] < 9:
            clusters[-1].append(c)
        else:
            clusters.append([c])
    dots = [g for g in gl if g.code == REPEAT_DOTS]
    bars: list[tuple[float, str]] = []
    for cl in clusters:
        xs = [c[0] for c in cl]
        thick = any(c[3] > 1.5 for c in cl)
        cx_left, cx_right = min(xs), max(xs)
        dots_left = any(cx_left - 14 < d.x < cx_left + 1 for d in dots)
        dots_right = any(cx_right - 1 < d.x < cx_right + 14 for d in dots)
        if len(cl) == 1 and not thick and cx_left < staff.x0 + 3:
            continue  # the line at the left edge of the system
        if dots_left and dots_right:
            kind = "repeat_both"
        elif dots_left:
            kind = "repeat_end"
        elif dots_right:
            kind = "repeat_start"
        elif thick:
            kind = "final"
        elif len(cl) > 1:
            kind = "double"
        else:
            kind = "single"
        bars.append((cx_right if kind != "repeat_start" else cx_left, kind))
    # the staff ends where the last barline stands; if the last barline is not at the staff end, a last bar is open
    bounds: list[tuple[float, str]] = list(bars)
    content_x = [g.x for g in gl if g.code in NOTEHEADS or g.code in REST_LEN]
    last_x = bounds[-1][0] if bounds else staff.x0
    # a lone time-signature change after the last barline (a courtesy signature) does not make a bar
    if not bounds or (staff.x1 - last_x > 6 and any(x > last_x for x in content_x)):
        bounds.append((staff.x1, "open"))
    start = staff.x0
    for bx, kind in bounds:
        m = Measure(start, bx)
        m.ends = kind
        sysm.measures.append(m)
        start = bx
    # a start-repeat barline opens the next bar: mark by moving the kind to the following measure
    for i, m in enumerate(sysm.measures):
        if m.ends == "repeat_start" and i + 1 < len(sysm.measures):
            sysm.measures[i + 1].ends = sysm.measures[i + 1].ends  # kept; start flag below
    sysm.starts_repeat = [i + 1 for i, m in enumerate(sysm.measures) if m.ends == "repeat_start"]  # type: ignore[attr-defined]

    def measure_at(x: float) -> Measure | None:
        for m in sysm.measures:
            if m.x0 - 0.5 <= x < m.x1 + 0.5:
                return m
        return None

    # ---- time signature(s): digit pairs stacked at one x
    digit_glyphs = [g for g in gl if g.code in TIME_DIGITS]
    groups: dict[float, list[Glyph]] = defaultdict(list)
    for g in digit_glyphs:
        key = next((k for k in groups if abs(k - g.x) < 12), g.x)
        groups[key].append(g)
    time_events: list[tuple[float, tuple[int, int]]] = []
    mid = (staff.top + staff.bottom) / 2
    for key, gs in sorted(groups.items()):
        top = "".join(str(g.code - 0xE080) for g in sorted(gs, key=lambda g: g.x) if g.y < mid)
        bot = "".join(str(g.code - 0xE080) for g in sorted(gs, key=lambda g: g.x) if g.y >= mid)
        if top and bot:
            time_events.append((min(g.x for g in gs), (int(top), int(bot))))
    cur_time = time_in
    for m in sysm.measures:
        for x, ts in time_events:
            if x < m.x1:
                cur_time = ts
        m.time = cur_time
    for x, ts in time_events:
        cur_time = ts if x >= (sysm.measures[-1].x1 if sysm.measures else 0) else cur_time
    sysm.time_out = cur_time  # type: ignore[attr-defined]
    # a time signature belongs to the system header (before the first note) or to a bar start
    sysm.time_events = time_events  # type: ignore[attr-defined]

    # ---- key signature: accidentals in the header, left of the first note/rest and of any time signature
    heads_x = sorted(g.x for g in gl if g.code in NOTEHEADS or g.code in REST_LEN)
    first_content = heads_x[0] if heads_x else staff.x1
    header_end = min([first_content] + [x for x, _ in time_events if x < first_content]) if time_events else first_content
    accs = sorted((g for g in gl if g.code in ACCIDENTAL and g.x < header_end - 1), key=lambda g: g.x)
    keyacc: list[Glyph] = []
    prev_x = clef_x + 14
    for a in accs:
        if a.x - prev_x > 9:
            break
        keyacc.append(a)
        prev_x = a.x
    # the last "accidental" right before the first note belongs to that note, not to the key
    if keyacc and heads_x and not time_events and heads_x[0] - keyacc[-1].x < 9.5 and abs(keyacc[-1].y - next((g.y for g in gl if g.code in NOTEHEADS and g.x == heads_x[0]), 1e9)) < 0.6:
        keyacc.pop()
    sharps = [a for a in keyacc if a.code == 0xE262]
    flats = [a for a in keyacc if a.code == 0xE260]
    sysm.key_count = len(sharps) if sharps else -len(flats)
    # sanity: the sign positions must be the standard ones
    std_sharps = [8, 5, 9, 6, 3, 7, 4]
    std_flats = [4, 7, 3, 6, 2, 5, 1]
    steps = [staff.step(a.y) for a in keyacc]
    want = (std_sharps if sharps else std_flats)[: len(keyacc)]
    if steps != want and keyacc:
        doubts.append(f"p{page_no} system {index + 1}: key signature signs sit at unusual positions {steps} (expected {want})")
    key_alters = key_alterations(sysm.key_count)
    key_glyph_ids = {id(a) for a in keyacc}

    # ---- noteheads and rests
    notes: list[Note] = []
    for g in gl:
        if g.code in NOTEHEADS:
            n = Note(g.x, g.y, staff, {NOTE_WHOLE: "whole", NOTE_HALF: "half", NOTE_BLACK: "black"}[g.code], g.size)
            if g.size < 17:
                n.grace = True
            notes.append(n)
        elif g.code in REST_LEN:
            n = Note(g.x, g.y, staff, "restwhole" if g.code == 0xE4E3 else "rest", g.size)
            n.rest_code = g.code
            notes.append(n)
    notes.sort(key=lambda n: (n.x, n.y))

    # ---- stems (vertical hairlines), beams, flags
    stems = [(x, y0, y1) for x, y0, y1, w in geo.vlines if w < 0.7 and y1 - y0 > 8 and near((y0 + y1) / 2)]
    beams = [b for b in geo.beams if near(sum(p[1] for p in b) / len(b))]
    flag_g = [g for g in gl if g.code in FLAG_UP or g.code in FLAG_DOWN]
    for n in notes:
        if n.kind in ("whole",) or n.is_rest:
            continue
        best = None
        for sx, y0, y1 in stems:
            if not (n.x - 1.0 <= sx <= n.x + 7.5):
                continue
            if abs(y0 - n.y) < 2.0:
                up = False
                tip = y1
            elif abs(y1 - n.y) < 2.0:
                up = True
                tip = y0
            else:
                continue
            d = abs(sx - (n.x + 6.2 if up else n.x + 0.2))
            if best is None or d < best[0]:
                best = (d, sx, up, tip)
        if best is None:
            doubts.append(f"p{page_no} system {index + 1}: note at x={n.x:.0f} has no stem")
            continue
        _, n.stem_x, n.stem_up, tip = best
        levels = 0
        for b in beams:
            xs = [p[0] for p in b]
            x0, x1 = min(xs), max(xs)
            if x0 - 0.8 <= n.stem_x <= x1 + 0.8:
                left = [p[1] for p in b if abs(p[0] - x0) < 0.2]
                right = [p[1] for p in b if abs(p[0] - x1) < 0.2]
                yl, yr = sum(left) / len(left), sum(right) / len(right)
                yc = yl + (yr - yl) * ((n.stem_x - x0) / (x1 - x0) if x1 > x0 else 0)
                if abs(yc - tip) < 11 and (n.stem_up is False) == (yc > n.y - 0.5 * 0) or abs(yc - tip) < 11:
                    levels += 1
        flag = 0
        for g in flag_g:
            if abs(g.x - n.stem_x) < 1.5 and abs(g.y - tip) < 3.0:
                flag = (FLAG_UP if g.code in FLAG_UP else FLAG_DOWN)[g.code]
        n.flags = max(levels, flag)
        if levels and flag:
            doubts.append(f"p{page_no} system {index + 1}: note at x={n.x:.0f} has both a flag and a beam")

    # ---- augmentation dots: right of the head, in the same line or the space above it
    dot_glyphs = sorted((g for g in gl if g.code == DOT), key=lambda g: g.x)
    for g in dot_glyphs:
        owner = None
        for n in notes:
            if 3.0 < g.x - n.x < 15.0 and abs(g.y - n.y) < 0.5 * sp + 0.6:
                if owner is None or n.x > owner.x:
                    owner = n
        if owner is not None:
            owner.dots += 1
        else:
            doubts.append(f"p{page_no} system {index + 1}: augmentation dot at x={g.x:.0f} belongs to no note")

    # ---- accidentals: left of the head, same line
    for g in gl:
        if g.code in ACCIDENTAL and id(g) not in key_glyph_ids:
            owner = None
            for n in notes:
                if n.is_rest:
                    continue
                dx = n.x - g.x
                if 0.5 < dx < 15 and abs(g.y - n.y) < 1.4:
                    if owner is None or dx < owner.x - g.x:
                        owner = n
            if owner is not None:
                owner.accidental = ACCIDENTAL[g.code]
            else:
                doubts.append(f"p{page_no} system {index + 1}: accidental at x={g.x:.0f} belongs to no note")

    # ---- put the notes in bars, read pitches bar by bar
    for n in notes:
        m = measure_at(n.x)
        if m is None:
            doubts.append(f"p{page_no} system {index + 1}: note at x={n.x:.0f} outside every bar")
            continue
        if n.x < header_end - 1 and not n.is_rest:
            doubts.append(f"p{page_no} system {index + 1}: note at x={n.x:.0f} inside the header")
        m.notes.append(n)
    for m in sysm.measures:
        bar_acc: dict[tuple[str, int], int] = {}
        for n in sorted(m.notes, key=lambda n: n.x):
            if n.is_rest:
                continue
            decode_pitch(n, bar_acc, key_alters)
        num, den = m.time
        bar_len = num * 4.0 / den
        for n in m.notes:
            if n.grace:
                n.beats = 0.0
                continue
            if n.kind == "restwhole":
                n.beats = bar_len
            elif n.is_rest:
                n.beats = REST_LEN[n.rest_code]
            else:
                n.beats = NOTEHEADS[{"whole": NOTE_WHOLE, "half": NOTE_HALF, "black": NOTE_BLACK}[n.kind]]
                if n.kind == "black" and n.flags:
                    n.beats = 1.0 / (2 ** n.flags)
            dotted = n.beats
            add = n.beats
            for _ in range(n.dots):
                add /= 2
                dotted += add
            n.beats = dotted
        m.sum_beats = sum(n.beats for n in m.notes)

    # ---- ornaments (mordent, turn): kept as a flag on the note, never played as extra notes
    for g in gl:
        if g.code in ORNAMENTS:
            target = min((n for n in notes if not n.is_rest and not n.grace), key=lambda n: abs(n.x + 3 - g.x), default=None)
            if target is not None and abs(target.x + 3 - g.x) < 9:
                target.ornament = True

    # ---- tuplets: an italic "3" over (or under) a group of three notes. The group is the three neighbours around the
    # number whose shortened lengths make the bar add up exactly; if no triple does, it is a doubt.
    for w in words:
        if w.font == "FreeSerifItalic" and w.text.isdigit() and staff.top - 22 < w.y < staff.bottom + 22 and staff.x0 < w.x0 < staff.x1:
            m = measure_at(w.cx)
            if m is None:
                continue
            count = int(w.text)
            bar_len = m.time[0] * 4.0 / m.time[1]
            seq = sorted((n for n in m.notes if not n.grace), key=lambda n: n.x)
            best = None
            if count == 3:
                for i in range(len(seq) - 2):
                    trio = seq[i : i + 3]
                    nominal = sum(n.beats for n in trio)
                    if abs(m.sum_beats - nominal / 3 - bar_len) < 1e-6:
                        centre = sum(n.x + 3 for n in trio) / 3
                        if best is None or abs(centre - w.cx) < best[0]:
                            best = (abs(centre - w.cx), trio)
            if best is None:
                doubts.append(f"p{page_no} system {index + 1}: a tuplet mark '{w.text}' at x={w.cx:.0f} could not be applied to any three notes; its bar keeps the written lengths")
            else:
                for n in best[1]:
                    n.beats *= 2 / 3
                    n.tuplet = 3
                m.sum_beats = sum(n.beats for n in m.notes)

    # ---- slurs and ties
    for p0, p1, kind in geo.curves:
        if not near(p0[1]) and not near(p1[1]):
            continue
        a = min((n for n in notes if not n.is_rest), key=lambda n: abs((n.x + 3) - p0[0]) + (0 if abs(n.y - p0[1]) < 9 else 99), default=None)
        b = min((n for n in notes if not n.is_rest), key=lambda n: abs((n.x + 3) - p1[0]) + (0 if abs(n.y - p1[1]) < 9 else 99), default=None)
        if a is None or b is None or a is b:
            if a is not None and (p1[0] > staff.x1 - 6):
                a.tie_next = a.tie_next or False
                a.slur_next = True  # leaves the system: decided across systems later
                a.__dict__["leaves"] = True
            continue
        if abs(a.x - p0[0] + 3) > 12 or abs(b.x - p1[0] + 3) > 12:
            continue
        if a.midi == b.midi:
            a.tie_next = True
        else:
            a.slur_next = True

    # ---- chords above the staff, syllables below
    for w in words:
        if staff.top - 30 < w.y < staff.top - 2 and staff.x0 - 3 < w.x0 < staff.x1 + 5 and w.font.startswith("FreeSerif") and w.size < 11 and w.size > 9.5 and w.font == "FreeSerif":
            sysm.__dict__.setdefault("chord_words", []).append(w)
        elif staff.bottom + 6 < w.y < staff.bottom + 34 and w.font == "FreeSerif" and 8.5 < w.size < 9.8:
            sysm.__dict__.setdefault("syl_words", []).append(w)
    note_list = [n for n in notes if not n.is_rest and not n.grace]
    for w in getattr(sysm, "chord_words", []):
        text = w.text.translate(CYRILLIC_LOOKALIKES)
        if not CHORD_RE.match(text):
            sysm.__dict__.setdefault("annotations", []).append(w.text)
            continue
        target = min((n for n in notes if not n.grace), key=lambda n: abs(n.x + 3 - w.x0 - 1), default=None)
        if target is not None:
            target.chord = text
    taken: dict[int, Word] = {}
    for w in getattr(sysm, "syl_words", []):
        target = min(note_list, key=lambda n: abs(n.x + 3 - w.cx), default=None)
        if target is None:
            continue
        if abs(target.x + 3 - w.cx) > 14:
            doubts.append(f"p{page_no} system {index + 1}: syllable {w.text!r} is far from every note")
            continue
        if id(target) in taken:
            target.syllable = (target.syllable or "") + "+" + w.text
            doubts.append(f"p{page_no} system {index + 1}: two syllables under one note ({target.syllable})")
        else:
            target.syllable = w.text
            taken[id(target)] = w

    # ---- rehearsal letters and bar numbers (to the left of the system)
    for w in words:
        if w.font == "FreeSerifBold" and abs(w.size - 14) < 1.5 and 1 <= len(w.text) <= 2 and staff.top - 28 < w.y < staff.top + 2:
            m = measure_at(w.x0 + 1)
            if m is not None:
                m.letter = w.text
        if w.font == "FreeSerif" and abs(w.size - 8) < 1 and w.text.isdigit() and w.x0 < staff.x0 and staff.top - 8 < w.y < staff.bottom + 8:
            sysm.first_number = int(w.text)

    # ---- voltas: a bracket above the staff and a "1." / "2." label
    for pts in geo.polylines:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        if staff.top - 30 < min(ys) < staff.top - 3 and max(ys) - min(ys) < 12 and max(xs) - min(xs) > 20:
            label = None
            for w in words:
                if w.font == "FreeSerifBold" and re.match(r"^\d[\d.,\-–]*\.?$", w.text) and min(xs) - 2 <= w.x0 <= min(xs) + 14 and staff.top - 30 < w.y < staff.top + 2:
                    label = w.text
            sysm.voltas.append((label or "?", min(xs), max(xs)))
    for label, vx0, vx1 in sysm.voltas:
        if label == "?":
            doubts.append(f"p{page_no} system {index + 1}: volta bracket without a readable number")
        for m in sysm.measures:
            if m.x1 > vx0 + 3 and m.x0 < vx1 - 3:
                m.volta = label
    return sysm


# ---------------------------------------------------------------- the songs
TITLE_RE = re.compile(r"^[PПTТ][SС]\s*№?\s*(\d+)\s*(.*)$")  # "PS №5", "PS 419", and the typo "TS №647" in the PDF


def find_song_starts(doc: pymupdf.Document) -> list[dict]:
    """One entry per page that opens a song: page index, number, name (the big line after the number), tal line."""
    out = []
    for i, page in enumerate(doc):
        _, words = read_text(page)
        big = sorted((w for w in words if w.size >= 20 and w.font.startswith("FreeSerif")), key=lambda w: (round(w.y), w.x0))
        if not big:
            continue
        text = " ".join(w.text for w in big)
        m = TITLE_RE.match(text)
        if not m:
            continue
        sub = sorted((w for w in words if 12 < w.size < 16 and w.font == "FreeSerif" and w.y < big[0].y + 50), key=lambda w: w.x0)
        sub_text = " ".join(w.text for w in sub)
        name = m.group(2).strip()
        out.append({"page": i, "number": int(m.group(1)), "heading": text, "name": name or re.sub(r"\s*\(.*$", "", sub_text), "sub": sub_text})
    return out


CAPO_ORDINALS = {
    "первом": 1, "втором": 2, "третьем": 3, "четвертом": 4, "четвёртом": 4, "пятом": 5,
    "шестом": 6, "седьмом": 7, "восьмом": 8, "девятом": 9, "десятом": 10,
}


def parse_capo(words: list[Word], top_y: float) -> tuple[int | None, str | None]:
    line = " ".join(w.text for w in sorted((w for w in words if w.size < 12 and w.y < top_y), key=lambda w: (round(w.y), w.x0)))
    if re.search(r"без\s+каподастр", line, re.I):
        return 0, line
    m = re.search(r"каподастр\w*\s+на\s+(\d+)", line, re.I)
    if m:
        return int(m.group(1)), line
    m = re.search(r"каподастр\w*\s+на\s+(\w+)\s+ладу", line, re.I)
    if m and m.group(1).lower() in CAPO_ORDINALS:
        return CAPO_ORDINALS[m.group(1).lower()], line
    return None, line or None


def chord_root_sounding(symbol: str, capo: int) -> int | None:
    pc = pc_of_root(symbol)
    return None if pc is None else (pc + capo) % 12


def parse_song(doc: pymupdf.Document, first_page: int, last_page: int, info: dict) -> dict:
    doubts: list[str] = []
    systems: list[System] = []
    capo = None
    capo_text = None
    for pi in range(first_page, last_page + 1):
        page = doc[pi]
        glyphs, words = read_text(page)
        geo = Geometry(page)
        staves = find_staves(geo)
        staves.sort(key=lambda s: s.top)
        if pi == first_page and staves:
            capo, capo_text = parse_capo(words, staves[0].top - 8)
        if staves:
            below = staves[-1].bottom + 40
            lines: dict[int, list[Word]] = defaultdict(list)
            for w in words:
                if w.y > below and w.x0 < 290:
                    lines[round(w.y)].append(w)
            for y in sorted(lines):
                text = " ".join(w.text for w in sorted(lines[y], key=lambda w: w.x0))
                if "повтор" in text.lower():
                    info.setdefault("repeatInstructions", []).append(text)
        for staff in staves:
            time_in = systems[-1].time_out if systems else (4, 4)  # type: ignore[attr-defined]
            systems.append(parse_system(pi + 1, len(systems), staff, glyphs, words, geo, doubts, time_in))
    if capo is None:
        doubts.append("no capo line found")
    return assemble_song(info, capo, capo_text, first_page + 1, last_page + 1, systems, doubts)


def assemble_song(info: dict, capo, capo_text, first_page, last_page, systems: list[System], doubts: list[str]) -> dict:
    # ---- flatten into bars
    bars: list[Measure] = [m for s in systems for m in s.measures]
    key_counts = {s.key_count for s in systems}
    if len(key_counts) > 1:
        doubts.append(f"the key signature differs between systems: {sorted(key_counts)}")
    key_count = systems[0].key_count if systems else 0
    clefs = {s.clef for s in systems}
    if len(clefs) > 1:
        doubts.append("the clef differs between systems")

    # ---- ties across a system break
    flat_notes: list[tuple[Note, Measure]] = [(n, m) for m in bars for n in sorted(m.notes, key=lambda n: n.x)]
    # ---- bar lengths against the time signature. A short first bar (a pick-up) is fine when the bar that ends the
    # song, or the bar before a repeat, is short by the same amount; anything else goes to the doubts.
    bar_list = [(si, mi, m) for si, s in enumerate(systems) for mi, m in enumerate(s.measures)]
    short_total = 0.0
    problems: list[str] = []
    for idx, (si, mi, m) in enumerate(bar_list):
        s = systems[si]
        bar_len = m.time[0] * 4.0 / m.time[1]
        if not m.notes:
            problems.append(f"p{s.page_no} line {si + 1} bar {mi + 1}: an empty bar")
        elif abs(m.sum_beats - bar_len) > 1e-6:
            is_first, is_last = idx == 0, idx == len(bar_list) - 1
            msg = f"p{s.page_no} line {si + 1} bar {mi + 1}: lengths add to {m.sum_beats:g} quarters, the time signature wants {bar_len:g}"
            if (is_first or is_last) and m.sum_beats < bar_len:
                m.__dict__["pickup"] = bar_len - m.sum_beats
                short_total += bar_len - m.sum_beats
                problems.append(msg + " (pick-up or last bar; checked below)")
            else:
                problems.append(msg)
    first_short = bar_list[0][2].__dict__.get("pickup", 0.0) if bar_list else 0.0
    last_short = bar_list[-1][2].__dict__.get("pickup", 0.0) if bar_list and len(bar_list) > 1 else 0.0
    for msg in problems:
        if msg.endswith("(pick-up or last bar; checked below)"):
            if first_short and last_short and abs(first_short + last_short - bar_list[0][2].time[0] * 4.0 / bar_list[0][2].time[1]) < 1e-6:
                continue  # the pick-up and the last bar complete one bar
        doubts.append(msg)

    # words printed above the staff that are not chords ("переход к B", "(D)"): one text per system, in reading order
    annotations = [" ".join(s.__dict__["annotations"]) for s in systems if s.__dict__.get("annotations")]

    # grace notes are left out of the steps and ornaments are only marked: say so, never skip silently
    for si, system in enumerate(systems):
        graces = sum(1 for m in system.measures for n in m.notes if n.grace)
        ornaments = sum(1 for m in system.measures for n in m.notes if n.ornament)
        if graces:
            doubts.append(f"p{system.page_no} line {si + 1}: {graces} grace note(s) in the PDF are not in the steps")
        if ornaments:
            doubts.append(f"p{system.page_no} line {si + 1}: {ornaments} ornament sign(s) (mordent or turn) are marked on notes and not played")

    sounding = [n for n, _ in flat_notes if not n.is_rest and not n.grace]

    # ---- chords
    chords: list[str] = []
    for n, _ in flat_notes:
        if n.chord and (not chords or chords[-1] != n.chord):
            chords.append(n.chord)
    chord_set = list(dict.fromkeys(chords))

    # ---- Sa: the key signature gives two candidates (the major tonic and its relative minor); the last note and the
    # first/last chord (with the capo added) vote. Chords that disagree are reported, not trusted.
    major_pc = key_tonic_pc(key_count)
    minor_pc = (major_pc - 3) % 12
    basis: list[str] = [f"key signature {key_count:+d} ({'flats' if key_count < 0 else 'sharps' if key_count > 0 else 'none'}): major tonic {PC_NAMES[major_pc]}, relative minor {PC_NAMES[minor_pc]}"]
    last_pc = sounding[-1].midi % 12 if sounding else None
    capo_n = capo or 0
    first_chord_pc = chord_root_sounding(chords[0], capo_n) if chords else None
    last_chord_pc = chord_root_sounding(chords[-1], capo_n) if chords else None
    if chords:
        basis.append(f"first chord {chords[0]} and last chord {chords[-1]} with capo {capo_n}: sounding roots {PC_NAMES[first_chord_pc] if first_chord_pc is not None else '?'} and {PC_NAMES[last_chord_pc] if last_chord_pc is not None else '?'}")
    if last_pc is not None:
        basis.append(f"last note {PC_NAMES[last_pc]}")
    # votes: the key signature's two candidates 1.5, the first chord 1, the last chord 1, the last note 1. Any pitch class
    # may win (a song can sit on a tonic the key signature does not name); a winner outside the key signature, or a close
    # call, is a doubt.
    score = {pc: 0.0 for pc in range(12)}
    score[major_pc] += 1.5
    score[minor_pc] += 1.5
    for pc in (first_chord_pc, last_chord_pc, last_pc):
        if pc is not None:
            score[pc] += 1.0
    ranked = sorted(score, key=lambda pc: (-score[pc], pc not in (major_pc, minor_pc), pc != major_pc))
    sa_pc = ranked[0]
    margin = score[ranked[0]] - score[ranked[1]]
    sa_by = "key signature 1.5, first chord 1, last chord 1, last note 1: " + ", ".join(f"{PC_NAMES[pc]} {score[pc]:g}" for pc in ranked[:3] if score[pc] > 0)
    sa_uncertain = sa_pc not in (major_pc, minor_pc) or margin < 1.0
    if sa_pc not in (major_pc, minor_pc):
        doubts.append(f"Sa {PC_NAMES[sa_pc]} comes from the chords (capo {capo_n}) and the last note; the key signature names {PC_NAMES[major_pc]} / {PC_NAMES[minor_pc]}: check by ear")
    elif margin < 1.0:
        doubts.append(f"Sa {PC_NAMES[sa_pc]} is a close call ({sa_by}): check by ear")
    if last_pc is not None and last_pc != sa_pc and (last_pc - sa_pc) % 12 not in (0, 7, 4, 3, 2, 5, 9):
        doubts.append(f"the song ends on {SWARA[(last_pc - sa_pc) % 12]} above Sa {PC_NAMES[sa_pc]}")
    if first_chord_pc is not None and last_chord_pc is not None and {first_chord_pc, last_chord_pc} & {sa_pc} == set():
        doubts.append(f"the first and last chord (capo {capo_n}) are {PC_NAMES[first_chord_pc]} and {PC_NAMES[last_chord_pc]}, neither is Sa {PC_NAMES[sa_pc]}: chords and staff disagree; the staff and the last note are trusted")
    sa_name = PC_NAMES[sa_pc]

    # ---- octave: Sa is the tonic that puts the lowest note within 6 semitones of it (-6 .. +5 above Sa)
    if sounding:
        low = min(n.midi for n in sounding)
        sa_midi = next(t for t in range(low - 5, low + 7) if t % 12 == sa_pc)
    else:
        sa_midi = 60 + sa_pc

    # ---- ties across systems: a note that leaves the system and a first note of the same pitch
    ordered = flat_notes
    for i, (n, m) in enumerate(ordered):
        if n.__dict__.get("leaves") and not n.is_rest:
            nxt = next(((x, mm) for x, mm in ordered[i + 1 :] if not x.is_rest), None)
            if nxt and nxt[0].midi == n.midi and nxt[1] is not m:
                n.tie_next = True
                n.slur_next = False
            elif nxt:
                n.slur_next = True

    # ---- playing order: voltas and printed repeats expanded, cut into rows
    structure: list[str] = []
    chunks = play_chunks(systems, doubts, structure)
    rows: list[dict] = []
    for chunk in chunks:
        detail: list[dict] = []
        for m in chunk["bars"]:
            for n in sorted(m.notes, key=lambda n: n.x):
                if n.grace:
                    continue
                if n.is_rest:
                    detail.append({"k": [], "b": n.beats, "rest": True, "chord": n.chord})
                    continue
                k = n.midi - sa_midi
                detail.append({"k": [k], "b": n.beats, "pitch": f"{PC_NAMES[n.midi % 12]}{n.midi // 12 - 1}", "swara": swara_text(k), "syllable": n.syllable, "chord": n.chord, "tieNext": n.tie_next, "slurNext": n.slur_next, "ornament": n.ornament})
        rows.append({"label": chunk["label"], "bars": chunk["refs"], "detail": detail})
    merge_ties(rows)
    sheet_rows = [{"label": r["label"], "repeat": 1, "hand": "right", "steps": [{"k": d["k"], "b": d["b"]} for d in r["detail"]]} for r in rows]
    label_duplicates(sheet_rows)

    # ---- final checks
    ks = [d["k"][0] for r in rows for d in r["detail"] if d["k"]]
    if ks and (min(ks) < -12 or max(ks) > 30):
        doubts.append(f"range of the song is wide: {min(ks)}..{max(ks)} semitones above Sa")
    if not ks:
        doubts.append("no notes read")

    time_sigs = sorted({f"{m.time[0]}/{m.time[1]}" for m in bars})
    song = {
        "number": info["number"],
        "title": info["name"],
        "tal": (re.search(r"tal:?\s*([A-Za-z]+)", info["sub"]) or [None, None])[1],
        "heading": info["heading"],
        "pages": [first_page, last_page] if last_page != first_page else [first_page],
        "capo": capo,
        "capoText": capo_text,
        "keySignature": {"accidentals": key_count, "majorTonic": PC_NAMES[major_pc], "relativeMinor": PC_NAMES[minor_pc]},
        "timeSignature": time_sigs,
        "clef": "G8vb" if CLEF_G_8VB in clefs and CLEF_G not in clefs else "G",
        "sa": {"sounding": sa_name, "uncertain": sa_uncertain, "foundBy": sa_by, "basis": basis, "octaveRule": "the lowest note lies within 6 semitones of Sa (-6 .. +5)", "saMidiInWrittenPitch": sa_midi},
        "chords": chord_set,
        "bars": [
            {
                "page": s.page_no,
                "line": si + 1,
                "bar": mi + 1,
                "number": (s.first_number + mi) if s.first_number else None,
                "letter": m.letter,
                "volta": m.volta,
                "ends": m.ends,
                "time": f"{m.time[0]}/{m.time[1]}",
                "quarters": m.sum_beats,
                "notes": [
                    {
                        "pitch": None if n.is_rest else f"{PC_NAMES[n.midi % 12]}{n.midi // 12 - 1}",
                        "k": None if n.is_rest else n.midi - sa_midi,
                        "swara": None if n.is_rest else swara_text(n.midi - sa_midi),
                        "b": n.beats,
                        "rest": n.is_rest,
                        "tieNext": n.tie_next,
                        "slurNext": n.slur_next,
                        "syllable": n.syllable,
                        "chord": n.chord,
                        "grace": n.grace,
                        "ornament": n.ornament,
                        "tuplet": n.tuplet,
                        "x": round(n.x, 1),
                        "y": round(n.y, 1),
                    }
                    for n in sorted(m.notes, key=lambda n: n.x)
                ],
            }
            for si, s in enumerate(systems)
            for mi, m in enumerate(s.measures)
        ],
        "rows": sheet_rows,
        "rowsDetail": [{"label": sheet_rows[i]["label"], "bars": r["bars"], "steps": r["detail"]} for i, r in enumerate(rows)],
        "stepsCount": sum(len(r["steps"]) for r in sheet_rows),
        "structure": structure,
        "repeatInstructions": info.get("repeatInstructions", []),
        "annotations": annotations,
        "doubts": doubts,
    }
    return song


def play_chunks(systems: list[System], doubts: list[str], structure: list[str]) -> list[dict]:
    """The bars in the order they are played, cut into rows.

    A volta group (`1.` `2.` ...) is played once per volta, every time from the start of its segment: the bars since the
    last rehearsal letter or the last volta group. A printed repeat sign is followed as printed. A row never crosses a
    line of the page, so a row reads like one printed line."""
    flat = [(si, mi, m) for si, s in enumerate(systems) for mi, m in enumerate(s.measures)]
    letter_at: list[str | None] = []
    current = None
    for _, _, m in flat:
        current = m.letter or current
        letter_at.append(current)
    played: list[tuple[int, str, int]] = []  # (flat index, volta tag, pass id)
    pass_id = 0
    seg_start = 0  # where a volta's body starts: the last rehearsal letter, printed repeat start or volta group
    seg_mark = 0  # where those bars begin in `played`
    rep_start = 0  # where a printed end-repeat sign jumps back to
    i = 0
    while i < len(flat):
        si, mi, m = flat[i]
        if m.letter and i > seg_start:
            seg_start, seg_mark = i, len(played)
        if m.volta:
            groups: dict[str, list[int]] = {}
            j = i
            while j < len(flat) and flat[j][2].volta:
                groups.setdefault(flat[j][2].volta, []).append(j)
                j += 1
            body = list(range(seg_start, i))
            if not any(flat[k][2].ends in ("repeat_end", "repeat_both") for idxs in groups.values() for k in idxs):
                structure.append(f"p{systems[si].page_no} line {si + 1}: volta {', '.join(groups)} has no printed repeat sign; the {len(body)} bar(s) before the volta are played again before each volta (read from the volta brackets and the (2x) in the text)")
            del played[seg_mark:]  # the bars before the volta were queued once already: they come with each volta instead
            for tag, idxs in groups.items():
                pass_id += 1
                for k in body + idxs:
                    played.append((k, tag, pass_id))
            seg_start = rep_start = j
            seg_mark = len(played)
            i = j
            continue
        played.append((i, "", pass_id))
        if m.ends in ("repeat_start", "repeat_both"):
            seg_start = rep_start = i + 1
            seg_mark = len(played)
        if m.ends in ("repeat_end", "repeat_both"):
            structure.append(f"p{systems[si].page_no} line {si + 1} bar {mi + 1}: printed repeat sign, bars {rep_start + 1}-{i + 1} of the song played again")
            pass_id += 1
            for k in range(rep_start, i + 1):
                played.append((k, "", pass_id))
            pass_id += 1
            seg_start = rep_start = i + 1
            seg_mark = len(played)
        i += 1
    chunks: list[dict] = []
    for k, tag, pid in played:
        si, mi, m = flat[k]
        if chunks and chunks[-1]["system"] == si and chunks[-1]["pass"] == pid and chunks[-1]["tag"] == tag:
            chunks[-1]["bars"].append(m)
            chunks[-1]["refs"].append({"page": systems[si].page_no, "line": si + 1, "bar": mi + 1})
        else:
            label = (letter_at[k] or "") + (f" {tag.rstrip('.')}" if tag else "")
            chunks.append({"label": label.strip() or None, "system": si, "pass": pid, "tag": tag, "bars": [m], "refs": [{"page": systems[si].page_no, "line": si + 1, "bar": mi + 1}]})
    return chunks


def merge_ties(rows: list[dict]) -> None:
    """A tie joins two notes into one longer one, also across a row break (the second half is not struck again)."""
    prev_last: dict | None = None
    for r in rows:
        kept: list[dict] = []
        for d in r["detail"]:
            if prev_last is not None and prev_last.get("tieNext") and not d.get("k") == [] and d["k"] == prev_last["k"]:
                prev_last["b"] += d["b"]
                prev_last["tieNext"] = d.get("tieNext", False)
                continue
            kept.append(d)
            prev_last = d
        r["detail"] = kept
        if kept:
            prev_last = kept[-1]


def label_duplicates(rows: list[dict]) -> None:
    seen: dict[str, int] = defaultdict(int)
    for r in rows:
        base = r["label"] or ""
        seen[base] += 1
    counter: dict[str, int] = defaultdict(int)
    for r in rows:
        base = r["label"] or ""
        counter[base] += 1
        if seen[base] > 1 and base:
            r["label"] = f"{base} ({counter[base]})"[:40]
        elif not base:
            r["label"] = None


# ---------------------------------------------------------------- check pictures
def draw_overlay(pdf: Path, songs: list[dict], out_dir: Path) -> None:
    """One PNG per page: the page with the read notes written over it (red: swara and length in quarters, blue: rests)
    so a person can put the picture next to the printed page and compare."""
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf)
    for song in songs:
        by_page: dict[int, list[dict]] = defaultdict(list)
        for bar in song["bars"]:
            for n in bar["notes"]:
                by_page[bar["page"]].append({**n, "bar": bar})
        for page_no, notes in by_page.items():
            page = doc[page_no - 1]
            for n in notes:
                if n["grace"]:
                    continue
                label = f"{n['swara']} {n['b']:g}" if not n["rest"] else f"r{n['b']:g}"
                color = (0.8, 0.0, 0.0) if not n["rest"] else (0.0, 0.2, 0.9)
                y = n["y"] + (13 if not n["rest"] else 16)
                page.insert_text((n["x"] - 2, y), label, fontsize=5.5, color=color)
                if n["tieNext"]:
                    page.insert_text((n["x"] + 4, y - 6), "tie", fontsize=5, color=(0, 0.5, 0))
            pix = page.get_pixmap(dpi=130)
            pix.save(out_dir / f"ps{song['number']:04d}_p{page_no}.png")
            # remove the drawing again so the next song on the same page starts clean
            doc.close()
            doc = pymupdf.open(pdf)


# ---------------------------------------------------------------- CLI
def parse_pdf(pdf: Path, only: set[int] | None = None) -> list[dict]:
    doc = pymupdf.open(pdf)
    starts = find_song_starts(doc)
    songs = []
    for i, info in enumerate(starts):
        last = (starts[i + 1]["page"] - 1) if i + 1 < len(starts) else len(doc) - 1
        if only and info["number"] not in only:
            continue
        songs.append(parse_song(doc, info["page"], last, info))
    return songs


def index_of(songs: list[dict]) -> list[dict]:
    """One line per song for the app and for the report."""
    out = []
    for s in songs:
        out.append({
            "number": s["number"], "title": s["title"], "tal": s["tal"], "pages": s["pages"], "capo": s["capo"],
            "saSounding": s["sa"]["sounding"], "rows": len(s["rows"]), "steps": s["stepsCount"], "doubts": len(s["doubts"]),
        })
    return out


def app_bundle(songs: list[dict]) -> dict:
    """The compact file the app bundles: rows only, every step as [beats, key, key ...] (no keys = a rest)."""
    out: dict[str, dict] = {}
    for s in songs:
        out[str(s["number"])] = {
            "title": s["title"],
            "capo": s["capo"],
            "sa": s["sa"]["sounding"],
            "saUncertain": s["sa"]["uncertain"],
            "doubts": len(s["doubts"]),
            "rows": [
                {"label": r["label"], "repeat": r["repeat"], "steps": [[st["b"], *st["k"]] for st in r["steps"]]}
                for r in s["rows"]
            ],
        }
    return {"source": "50 PS с переводом.pdf", "songs": out}


def report_markdown(songs: list[dict], pdf_name: str) -> str:
    rows = sum(len(s["rows"]) for s in songs)
    steps = sum(s["stepsCount"] for s in songs)
    doubts = sum(len(s["doubts"]) for s in songs)
    lines = [
        "# Report: piano sheets read from the PDF",
        "",
        f"Source: `{pdf_name}`. Generated by `scripts/ps_piano_from_pdf.py` (do not edit by hand).",
        "",
        f"- songs read: {len(songs)}",
        f"- rows (one row = one printed line or one playing of a volta): {rows}",
        f"- steps (one step = one note, chord or rest): {steps}",
        f"- doubts: {doubts} in {sum(1 for s in songs if s['doubts'])} songs",
        "",
        "| PS | title | capo | Sa | rows | steps | doubts |",
        "|---:|---|---:|:--:|---:|---:|---:|",
    ]
    for s in songs:
        lines.append(f"| {s['number']} | {s['title'] or '(no title in the PDF)'} | {s['capo']} | {s['sa']['sounding']} | {len(s['rows'])} | {s['stepsCount']} | {len(s['doubts'])} |")
    lines += ["", "## Doubts, song by song", ""]
    for s in songs:
        if not s["doubts"]:
            continue
        lines.append(f"### PS {s['number']} {s['title']}".rstrip())
        lines.extend(f"- {d}" for d in s["doubts"])
        lines.append("")
    return "\n".join(lines) + "\n"


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pdf", required=True, type=Path)
    ap.add_argument("--out", type=Path, default=Path("data/curated/ps_piano_from_pdf"))
    ap.add_argument("--write", action="store_true", help="write the JSON files (default: dry run)")
    ap.add_argument("--songs", help="comma separated PS numbers (default: all)")
    ap.add_argument("--app-json", type=Path, help="with --write: also write the compact file the app bundles")
    ap.add_argument("--overlay", type=Path, help="write one PNG per page with the read notes drawn over the page")
    args = ap.parse_args(argv)
    only = {int(x) for x in args.songs.split(",")} if args.songs else None
    songs = parse_pdf(args.pdf, only)
    total_rows = sum(len(s["rows"]) for s in songs)
    total_doubts = sum(len(s["doubts"]) for s in songs)
    print(f"{len(songs)} songs, {total_rows} rows, {sum(s['stepsCount'] for s in songs)} steps, {total_doubts} doubts")
    for s in songs:
        print(f"PS {s['number']:>5} {s['title'][:34]:<34} capo {s['capo']} Sa {s['sa']['sounding']:<2} rows {len(s['rows'])} steps {s['stepsCount']:>3} doubts {len(s['doubts'])}")
    if args.overlay:
        draw_overlay(args.pdf, songs, args.overlay)
    if args.write:
        args.out.mkdir(parents=True, exist_ok=True)
        for s in songs:
            (args.out / f"ps_{s['number']:04d}.json").write_text(json.dumps(s, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (args.out / "index.json").write_text(json.dumps(index_of(songs), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if args.app_json:
            args.app_json.parent.mkdir(parents=True, exist_ok=True)
            args.app_json.write_text(json.dumps(app_bundle(songs), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        (args.out / "REPORT.md").write_text(report_markdown(songs, args.pdf.name), encoding="utf-8")
        print(f"wrote {len(songs)} files, index.json and REPORT.md to {args.out}")
    else:
        print("dry run: nothing written (use --write)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
