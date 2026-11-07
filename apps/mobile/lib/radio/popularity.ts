/**
 * Counted plays (all time) by track key, as the server's Top Played list reports them (lib/topPlayed/*). The Radio
 * reads it for the popularity boost (lib/radio/mix.ts). Kept in memory only: it is a cache of a public list, not
 * a record of this person. Empty means "no signal yet", and the mix then behaves as a plain shuffle.
 */

let plays: ReadonlyMap<string, number> = new Map()

export function setPopularity(next: ReadonlyMap<string, number>): void {
  plays = next
}

export function getPopularity(): ReadonlyMap<string, number> {
  return plays
}

/** Fold a list of Top Played rows into the map the mix reads. Later rows never lower an earlier count. */
export function popularityFromRows(
  rows: readonly { ref: "ps" | "rec"; id: string; plays: number }[],
): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) {
    if (!Number.isFinite(r.plays) || r.plays <= 0) continue
    const key = `${r.ref}:${r.id}`
    out.set(key, Math.max(out.get(key) ?? 0, Math.floor(r.plays)))
  }
  return out
}
