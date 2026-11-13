/**
 * Short words for a set of tune numbers, for the "which tunes have chords" step of the chord cycle screen
 * (docs/kiirtan-cycle.md): [1, 2, 3, 7, 9, 10] is "1–3, 7, 9–10". The inverse of `parseTuneRange` for what a person sees.
 * Pure; numbers are the tune numbers (from 1), in any order, duplicates ignored.
 */
export function compactRanges(numbers: readonly number[]): string {
  const sorted = Array.from(new Set(numbers)).sort((a, b) => a - b)
  const parts: string[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j += 1
    parts.push(j - i >= 2 ? `${sorted[i]}–${sorted[j]}` : sorted.slice(i, j + 1).join(", "))
    i = j + 1
  }
  return parts.join(", ")
}

/** The height (dp) of one row of the number list in the pop-up, and how many rows show at once. */
export const TUNE_ROW = 52
export const TUNE_ROWS_SHOWN = 5

/** Where the list scrolls so the chosen number sits in the middle of the rows that show. */
export function scrollOffsetFor(value: number, total: number): number {
  const first = Math.min(Math.max(0, value - 1 - Math.floor(TUNE_ROWS_SHOWN / 2)), Math.max(0, total - TUNE_ROWS_SHOWN))
  return first * TUNE_ROW
}
