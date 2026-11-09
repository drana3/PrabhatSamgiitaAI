import { spShape } from "@/lib/songPage/spChords"

import type { SheetInstrument } from "./types"

/**
 * The instruments a person can add chords for, in the order Dada asked for them: Harmonium, Piano, Guitar. Every kind of
 * recording that takes chords (Kiirtan, Bhajan, Spiritual song, Prabhat Samgiita) offers the same three. The chosen one is
 * stored with the chords and shown to everyone who opens them (docs/chord-instruments.md). Pure, so it is tested.
 */
export const CHORD_INSTRUMENT_CHOICES: readonly SheetInstrument[] = ["harmonium", "piano", "guitar"]

export function isSheetInstrument(value: unknown): value is SheetInstrument {
  return value === "guitar" || value === "harmonium" || value === "piano"
}

/** An address parameter or a stored word turned into an instrument; anything else is the fallback (guitar, the old default). */
export function sheetInstrumentOf(value: unknown, fallback: SheetInstrument = "guitar"): SheetInstrument {
  return isSheetInstrument(value) ? value : fallback
}

/** Only a guitar has a capo and a strum pattern; a harmonium and a piano write the chords as they sound. */
export function instrumentHasCapo(instrument: SheetInstrument): boolean {
  return instrument === "guitar"
}

/** Every different chord of a chart (or of a Prabhat Samgiita chart) in the order it first appears. */
export function chartChords(lines: ReadonlyArray<{ placements: ReadonlyArray<{ chord: string }> }>): string[] {
  const out: string[] = []
  for (const line of lines) for (const p of line.placements) if (p.chord && !out.includes(p.chord)) out.push(p.chord)
  return out
}

/**
 * The chords of a chart as the ONE chord card draws them. A chart stores the chords as they SOUND; a guitar player reads them
 * as the shapes of the capo the author used, so a guitar card shows `spShape(chord, capo)`. A harmonium and a piano card show
 * the chord as it sounds.
 */
export function cardChords(chart: { instrument: SheetInstrument; capo?: number | null; lines?: ReadonlyArray<{ placements: ReadonlyArray<{ chord: string }> }> | null }): string[] {
  const sounding = chartChords(chart.lines ?? [])
  return chart.instrument === "guitar" ? sounding.map((c) => spShape(c, chart.capo ?? 0)) : sounding
}
