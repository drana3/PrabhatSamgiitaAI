import { parseChord } from "@/lib/songPage/chords"
import { SP_NOTES } from "@/lib/songPage/spChords"

import { shiftChord } from "./spelling"

/**
 * Chord names a member may enter. The grammar is the API's, piece for piece (`CHORD_PATTERN` in
 * apps/api/app/schemas/song_chords.py): a root A to G with an optional sharp or flat, up to ten pieces of a name that
 * musicians really write (maj, min, dim, aug, sus, add, m, M, the degree signs and digits, the degree and half-diminished
 * signs), then an optional bass note (G/B) or a second number (C6/9). "Cfoo" is not a chord name.
 * Anything else is refused here first, with a sentence, instead of by the server with a code.
 */
export const CHORD_NAME = /^[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M|°|ø|\+|-|#|b|\d|\(|\))*(?:\/(?:[A-G][#b]?|\d{1,2}))?$/

const MAX_PIECES = 10

/** How many pieces follow the root, counted the way the API counts them (the regexp above has no upper bound). */
function pieces(name: string): number {
  const rest = name.replace(/^[A-G][#b]?/, "").replace(/\/(?:[A-G][#b]?|\d{1,2})$/, "")
  return (rest.match(/maj|min|dim|aug|sus|add|m|M|°|ø|\+|-|#|b|\d|\(|\)/g) ?? []).length
}

export function isChordName(text: string): boolean {
  const name = text.trim()
  return name.length > 0 && name.length <= 16 && CHORD_NAME.test(name) && pieces(name) <= MAX_PIECES && parseChord(name) !== null
}

/** "am" is not a chord to the song page (a root is a capital letter): fix the obvious cases, keep the rest as typed. */
export function cleanChordName(text: string): string {
  const name = text.trim().replace(/[♯]/g, "#").replace(/[♭]/g, "b")
  if (!name) return ""
  return name[0].toUpperCase() + name.slice(1)
}

/** The twelve roots, spelled the way the song page spells them (C C# D Eb E F F# G Ab A Bb B). */
export const ROOTS: readonly string[] = SP_NOTES

/** The kinds offered under "More chords" (step 2, after the root): the suffix; the plain-English name is in the locale file. */
export const QUALITIES = ["", "m", "7", "m7", "maj7", "sus2", "sus4", "dim", "aug", "add9"] as const
export type Quality = (typeof QUALITIES)[number]

/** The locale key (chordOffer.kind.*) that names each kind in plain English, so the picker shows "minor", not just "m". */
export const QUALITY_KIND: Record<Quality, "major" | "minor" | "dom7" | "min7" | "maj7" | "sus2" | "sus4" | "dim" | "aug" | "add9"> = {
  "": "major",
  m: "minor",
  "7": "dom7",
  m7: "min7",
  maj7: "maj7",
  sus2: "sus2",
  sus4: "sus4",
  dim: "dim",
  aug: "aug",
  add9: "add9",
}

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
  const at = (semitones: number, suffix = "") => `${shiftChord(key, semitones)}${suffix}`
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
