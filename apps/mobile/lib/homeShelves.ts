/**
 * Pure logic of the shelf-style Home (Today tab) and of the Search browse view. No React, no I/O.
 * Which shelves a filter chip shows, how songs fill the paged "Start listening" shelf, and which
 * cover a song gets (the app has no per-song art yet, so a cover is picked from the photo set).
 */

export const HOME_FILTERS = [
  { id: "all", label: "All" },
  { id: "songs", label: "Songs" },
  { id: "kiirtan", label: "Kiirtan" },
  { id: "stories", label: "Stories" },
  { id: "learn", label: "Learn" },
  { id: "downloaded", label: "Downloaded" },
] as const
export type HomeFilterId = (typeof HOME_FILTERS)[number]["id"]

export type HomeShelfId = "today" | "start" | "kmixes" | "kiirtan" | "mixes" | "because" | "trending" | "stories" | "learn" | "downloaded"

const SHELVES: Record<HomeFilterId, readonly HomeShelfId[]> = {
  all: ["today", "start", "kmixes", "kiirtan", "mixes", "because", "trending", "stories", "learn"],
  songs: ["today", "start", "mixes", "because", "trending"],
  kiirtan: ["kiirtan", "kmixes"],
  stories: ["stories"],
  learn: ["learn"],
  downloaded: ["downloaded"],
}

/** The shelves a chip shows, in order. A shelf with no data is dropped by the caller. */
export function shelvesFor(filter: HomeFilterId): readonly HomeShelfId[] {
  return SHELVES[filter]
}

export function isHomeFilter(value: unknown): value is HomeFilterId {
  return HOME_FILTERS.some((f) => f.id === value)
}

/** Split rows into pages of `size` (the last page may be shorter). */
export function chunk<T>(rows: readonly T[], size: number): T[][] {
  if (size < 1) return []
  const pages: T[][] = []
  for (let i = 0; i < rows.length; i += size) pages.push(rows.slice(i, i + size))
  return pages
}

export type StartRow = { number: number; title: string; sub: string }

/**
 * "Start listening": where you stopped first, then what you played lately, then today's songs.
 * A song shows once; the shelf holds at most `limit` rows.
 */
export function mergeStartRows(groups: readonly (readonly StartRow[])[], limit = 9): StartRow[] {
  const seen = new Set<number>()
  const out: StartRow[] = []
  for (const group of groups) {
    for (const row of group) {
      if (seen.has(row.number)) continue
      seen.add(row.number)
      out.push(row)
      if (out.length >= limit) return out
    }
  }
  return out
}

export const HOME_COVER_IDS = ["lake", "garland", "portrait", "lotus", "seated", "guitar"] as const
export type HomeCoverId = (typeof HOME_COVER_IDS)[number]

/** A stable cover for a song number: the same song always gets the same picture. */
export function coverFor(number: number): HomeCoverId {
  const n = Math.abs(Math.trunc(number)) || 0
  return HOME_COVER_IDS[(n * 7 + 3) % HOME_COVER_IDS.length]
}

/** `PS 3 · 4:31`, or `PS 3` while the length is not known. */
export function songSub(number: number, duration?: string | null): string {
  return duration ? `PS ${number} · ${duration}` : `PS ${number}`
}

export type StripTone = "orange" | "sage" | "gold" | "forest"

/** Label strip colours: text is always legible on its strip (ink on orange and gold, white on greens). */
export function stripColors(tone: StripTone, dark: boolean): { bg: string; fg: string } {
  switch (tone) {
    case "orange":
      return { bg: "#F67931", fg: "#1E1E1E" }
    case "gold":
      return { bg: "#F5C253", fg: "#1E1E1E" }
    case "sage":
      return { bg: "#3C5535", fg: "#FFFFFF" }
    case "forest":
      return { bg: dark ? "#2C3A27" : "#20281A", fg: "#FFFFFF" }
  }
}
