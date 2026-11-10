import { spBestCapo, uniqueChords } from "./spChords"

/**
 * Small rules of the Chords tab card (decision of 10 November 2026): the two badges ("Sounds in D", "Capo 2"), the hint
 * "Easier: capo 5", and the words of the two rows that open a sheet. Pure, no React.
 */

/** The key the song sounds in: the chart's own key when it names one, else its first chord. Null when there is nothing to say. */
export function soundsInKey(baseKey: string | undefined, sounding: readonly string[]): string | null {
  const key = (baseKey ?? "").trim() || sounding[0] || ""
  return key || null
}

/** The capo that gives the easiest shapes, when it is not the one set now; null when the set capo is already the easiest. */
export function easierCapo(sounding: readonly string[], capo: number): number | null {
  const best = spBestCapo(uniqueChords([...sounding]))
  return best === capo ? null : best
}

/** What the capo badge says: the fret, or that there is none (key `songChords.capo` with {capo}, or `songChords.capoOff`). */
export function capoBadgeKey(capo: number): "songChords.capo" | "songChords.capoOff" {
  return capo > 0 ? "songChords.capo" : "songChords.capoOff"
}

/** Which key a row's title uses by its count: a row with nothing behind it says only its name and what to do. */
export function membersRowKey(count: number): "songChords.members.row" | "songChords.members.none" {
  return count > 0 ? "songChords.members.row" : "songChords.members.none"
}

export function pianoRowKey(count: number): "songChords.piano.row" | "songChords.piano.none" {
  return count > 0 ? "songChords.piano.row" : "songChords.piano.none"
}
