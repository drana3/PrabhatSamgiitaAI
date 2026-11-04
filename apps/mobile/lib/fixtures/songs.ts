import type { CatalogEntry } from "@/lib/songsV2/entry"

/**
 * TODO(api): the catalog API does not send a length, an added date or a play counter yet.
 * The design prototype (Main.dc.html, `_songs()` and `renderVals`) shows all three, and Sort has
 * nine orders that need them, so until the API has them the Songs screen fills them from the
 * prototype's own sample formulas. Flip this flag to false (or delete the file) when the API
 * sends real values; the screen then falls back to "PS 3" rows and hides the orders it cannot do.
 */
export const SONGS_FIXTURE_STATS = true

/** Lengths the prototype gives PS 1 to 7. */
const SAMPLE_SECONDS: Record<number, number> = { 1: 238, 2: 252, 3: 271, 4: 305, 5: 226, 6: 300, 7: 284 }

export function fixtureSeconds(number: number): number {
  return SAMPLE_SECONDS[number] ?? 180 + ((number * 53) % 170)
}

/** Higher = added later. The prototype uses (i * 37) % length. */
export function fixtureAddedRank(number: number): number {
  return (number * 37) % 5018
}

/** The prototype's `plays`: (n * 7919) % 1000. */
export function fixturePlays(number: number): number {
  return (number * 7919) % 1000
}

/** Fills the three fields only where the API left them empty. */
export function withFixtureStats(entry: CatalogEntry): CatalogEntry {
  if (!SONGS_FIXTURE_STATS) return entry
  return {
    ...entry,
    durationSeconds: entry.durationSeconds ?? fixtureSeconds(entry.number),
    addedRank: entry.addedRank ?? fixtureAddedRank(entry.number),
    plays: entry.plays ?? fixturePlays(entry.number),
  }
}
