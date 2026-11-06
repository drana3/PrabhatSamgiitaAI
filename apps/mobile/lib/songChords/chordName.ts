import { parseChord } from "@/lib/songPage/chords"
import { SP_NOTES, spTranspose } from "@/lib/songPage/spChords"

/**
 * Chord names a member may enter. The shape is the API's (`CHORD_PATTERN` in apps/api/app/schemas/song_chords.py): a
 * root A to G with an optional sharp or flat, a short suffix of letters and digits, an optional slash bass.
 * Anything else is refused here first, with a sentence, instead of by the server with a code.
 */
export const CHORD_NAME = /^[A-G][#b]?[A-Za-z0-9#()+-]{0,10}(?:\/[A-G][#b]?)?$/

export function isChordName(text: string): boolean {
  const name = text.trim()
  return name.length > 0 && name.length <= 16 && CHORD_NAME.test(name) && parseChord(name) !== null
}

/** "am" is not a chord to the song page (a root is a capital letter): fix the obvious cases, keep the rest as typed. */
export function cleanChordName(text: string): string {
  const name = text.trim().replace(/[♯]/g, "#").replace(/[♭]/g, "b")
  if (!name) return ""
  return name[0].toUpperCase() + name.slice(1)
}

/** The twelve roots, spelled the way the song page spells them (C C# D Eb E F F# G Ab A Bb B). */
export const ROOTS: readonly string[] = SP_NOTES

/** The qualities offered under "another chord": suffix, then the plain-English name is in the locale file. */
export const QUALITIES = ["", "m", "7", "m7", "maj7", "sus4", "sus2", "dim", "add9", "6"] as const
export type Quality = (typeof QUALITIES)[number]

export function buildChord(root: string, quality: Quality): string {
  return `${root}${quality}`
}

/**
 * The chords a song in `key` most often uses, in the order a player reaches for them:
 * I, IV, V, vi, ii, iii and the dominant seventh. `key` is the key the member plays in (the shapes for a guitar with a
 * capo, Sa for a harmonium).
 */
export function suggestedChords(key: string): string[] {
  const root = parseChord(key)
  if (!root) return []
  const at = (semitones: number, suffix = "") => `${spTranspose(key, semitones)}${suffix}`
  const names = [at(0), at(5), at(7), at(9, "m"), at(2, "m"), at(4, "m"), at(7, "7")]
  return Array.from(new Set(names))
}

/** Chords already used in the chart, most used first (the palette's "used in this chart" row). */
export function usedChords(lines: ReadonlyArray<ReadonlyArray<{ chord: string }>>): string[] {
  const counts = new Map<string, number>()
  for (const line of lines) for (const p of line) counts.set(p.chord, (counts.get(p.chord) ?? 0) + 1)
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([chord]) => chord)
}
