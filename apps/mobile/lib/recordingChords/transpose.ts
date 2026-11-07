import { isChordName } from "@/lib/songChords/chordName"
import { parseChord, transposeChord, type Spelling } from "@/lib/songPage/chords"

import { chordLineCount } from "./rules"

/**
 * Showing and transposing a plain-text chord sheet. The sheet is kept exactly as typed; moving it up or down is done
 * on the way to the screen and never stored. A chart is respelled with ONE convention, flats or sharps (`chartSpelling`),
 * so a moved chart never mixes C# with Bb; at zero nothing changes, so a chart keeps its author's own spelling until it is
 * moved. A chord line keeps its columns where it can: a longer name takes the space after it.
 */
export type LineKind = "blank" | "chords" | "words"

export function lineKind(line: string): LineKind {
  if (!line.trim()) return "blank"
  return chordLineCount(line) > 0 ? "chords" : "words"
}

export type Piece = { text: string; chord: boolean }

/** A line as pieces for drawing: chord names (or `[Am]` marks in words) are flagged so they can be set in the accent. */
export function piecesOf(line: string, kind: LineKind = lineKind(line)): Piece[] {
  if (kind === "blank") return [{ text: line, chord: false }]
  const out: Piece[] = []
  const push = (text: string, chord: boolean) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.chord === chord) last.text += text
    else out.push({ text, chord })
  }
  if (kind === "chords") {
    for (const part of line.split(/(\s+)/)) push(part, part.trim() !== "" && isChordName(part))
    return out
  }
  for (const part of line.split(/(\[[^\][\s]{1,16}\])/)) push(part, /^\[[^\][\s]{1,16}\]$/.test(part) && isChordName(part.slice(1, -1)))
  return out
}

/** Flat keys by convention, as pitch classes: F Bb Eb Ab Db Gb major; Dm Gm Cm Fm Bbm Ebm minor. */
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6])
const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3])

const isMinorName = (suffix: string) => /^m(?!aj)/.test(suffix) || /^min/.test(suffix)

/** Every chord name of a sheet, in order: the chord lines' tokens and the `[Am]` marks in words. */
function chordNamesOf(body: string): string[] {
  const names: string[] = []
  for (const line of body.split("\n")) {
    const kind = lineKind(line)
    if (kind === "chords") for (const token of line.split(/\s+/)) if (token && isChordName(token)) names.push(token)
    if (kind === "words") for (const m of line.matchAll(/\[([^\][\s]{1,16})\]/g)) if (isChordName(m[1] as string)) names.push(m[1] as string)
  }
  return names
}

const writtenWithFlat = (name: string) => /^[A-G][b♭]/.test(name) || /\/[A-G][b♭]/.test(name)

/**
 * The one convention a moved chart is written in: flats when the key or any chord of the chart is written with a flat, or
 * when the key it lands in is a flat key by convention (F, Bb, Eb, Ab, Db, Gb, and Dm, Gm, Cm, Fm, Bbm, Ebm); sharps
 * otherwise. The landing key is the given key moved, or, with no key, the first chord moved.
 */
export function chartSpelling(body: string, key: string | null, semitones: number): Spelling {
  const names = chordNamesOf(body)
  if ((key && writtenWithFlat(key)) || names.some(writtenWithFlat)) return "flat"
  const home = key ? parseChord(key) : parseChord(names[0] ?? "")
  if (!home) return "sharp"
  const landing = (((home.root + semitones) % 12) + 12) % 12
  return (isMinorName(home.suffix) ? FLAT_MINOR : FLAT_MAJOR).has(landing) ? "flat" : "sharp"
}

const shift = (name: string, semitones: number, spelling: Spelling) => transposeChord(name, semitones, spelling)

/** One line moved by `semitones` in the given spelling; 0 returns it unchanged. */
export function transposeLine(line: string, semitones: number, spelling: Spelling = "sharp"): string {
  if (semitones === 0) return line
  const kind = lineKind(line)
  if (kind === "blank") return line
  if (kind === "words") return line.replace(/\[([^\][\s]{1,16})\]/g, (whole, name: string) => (isChordName(name) ? `[${shift(name, semitones, spelling)}]` : whole))
  let out = ""
  for (const match of line.matchAll(/\S+/g)) {
    const start = match.index ?? 0
    const token = isChordName(match[0]) ? shift(match[0], semitones, spelling) : match[0]
    if (out.length < start) out += " ".repeat(start - out.length)
    else if (out.length > 0) out += " "
    out += token
  }
  return out
}

/** The whole sheet moved, in ONE spelling for every chord (`chartSpelling`); `key` is the chart's key when it has one. */
export function transposeSheet(body: string, semitones: number, key: string | null = null): string {
  if (semitones === 0) return body
  const spelling = chartSpelling(body, key, semitones)
  return body.split("\n").map((line) => transposeLine(line, semitones, spelling)).join("\n")
}

/** The key label after moving, in the same spelling as the chart, or null when the player did not give one. */
export function shiftedKey(key: string | null, semitones: number, body = ""): string | null {
  if (!key) return null
  if (semitones === 0) return key
  return shift(key, semitones, chartSpelling(body, key, semitones))
}

export const MAX_SHIFT = 11

/** The steps stay inside one octave: -11 to +11 (twelve is the same chord again). */
export function clampShift(value: number): number {
  return Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, Math.trunc(value)))
}
