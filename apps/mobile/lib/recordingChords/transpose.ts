import { isChordName } from "@/lib/songChords/chordName"
import { shiftChord } from "@/lib/songChords/spelling"

import { chordLineCount } from "./rules"

/**
 * Showing and transposing a plain-text chord sheet. The sheet is kept exactly as typed; moving it up or down is done
 * on the way to the screen and never stored. Chord names are shifted by `shiftChord` (the song chords' own, so G#m
 * stays G#m a semitone away) and a chord line keeps its columns where it can: a longer name takes the space after it.
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

/** One line moved by `semitones`; 0 returns it unchanged. */
export function transposeLine(line: string, semitones: number): string {
  if (semitones === 0) return line
  const kind = lineKind(line)
  if (kind === "blank") return line
  if (kind === "words") return line.replace(/\[([^\][\s]{1,16})\]/g, (whole, name: string) => (isChordName(name) ? `[${shiftChord(name, semitones)}]` : whole))
  let out = ""
  for (const match of line.matchAll(/\S+/g)) {
    const start = match.index ?? 0
    const token = isChordName(match[0]) ? shiftChord(match[0], semitones) : match[0]
    if (out.length < start) out += " ".repeat(start - out.length)
    else if (out.length > 0) out += " "
    out += token
  }
  return out
}

export function transposeSheet(body: string, semitones: number): string {
  return semitones === 0 ? body : body.split("\n").map((line) => transposeLine(line, semitones)).join("\n")
}

/** The key label after moving, or null when the player did not give one. */
export function shiftedKey(key: string | null, semitones: number): string | null {
  return key ? shiftChord(key, semitones) : null
}

export const MAX_SHIFT = 11

/** The steps stay inside one octave: -11 to +11 (twelve is the same chord again). */
export function clampShift(value: number): number {
  return Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, Math.trunc(value)))
}
