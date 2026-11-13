/**
 * Pure logic of the shelf-style Home (Today tab) and of the Search browse view. No React, no I/O.
 * Which shelves a filter chip shows, how songs fill the paged "Start listening" shelf, and which
 * cover a song gets (the app has no per-song art yet, so a cover is picked from the photo set).
 */

import { t } from "@/lib/i18n"

export const HOME_FILTERS = [
  { id: "all", get label() { return t("home.filter.all") } },
  { id: "songs", get label() { return t("tabs.songs") } },
  { id: "kiirtan", get label() { return t("tabs.kiirtan") } },
  { id: "festivals", get label() { return t("home.filter.festivals") } },
  { id: "stories", get label() { return t("home.filter.stories") } },
  { id: "learn", get label() { return t("tabs.learn") } },
] as const
export type HomeFilterId = (typeof HOME_FILTERS)[number]["id"]

/**
 * `festcard` is the festival card (first block, only near a festival with songs), `mixes` the ONE shelf of mixes
 * (Prabhat Samgiita mixes and Kiirtan mixes together), `spiritual` and `spiritualNew` the two spiritual-song shelves.
 * `mostPlayed` is the "Most played this week" shelf (the top of the last 7 days, under All only, hidden until it has five rows).
 * There is no "Downloaded" chip and no downloaded shelf (Dada, 10 Nov 2026): downloaded is a state of a saved song, seen in Saved on Songs.
 */
export type HomeShelfId = "festcard" | "today" | "start" | "mixes" | "mostPlayed" | "kiirtan" | "spiritual" | "spiritualNew" | "because" | "trending" | "stories" | "learn" | "festivals"

const SHELVES: Record<HomeFilterId, readonly HomeShelfId[]> = {
  // everything mixed: Prabhat Samgiita, Kiirtan and spiritual songs side by side, not on separate tabs
  all: ["festcard", "today", "start", "mixes", "mostPlayed", "kiirtan", "because", "spiritual", "trending", "spiritualNew", "stories", "festivals", "learn"],
  songs: ["festcard", "today", "start", "mixes", "because", "trending", "festivals"],
  kiirtan: ["kiirtan", "mixes", "spiritual", "spiritualNew"],
  festivals: ["festcard", "festivals"],
  stories: ["stories"],
  learn: ["learn"],
}

/** The shelves a chip shows, in order. A shelf with no data is dropped by the caller. */
export function shelvesFor(filter: HomeFilterId): readonly HomeShelfId[] {
  return SHELVES[filter]
}

/** Which kinds of mix the one "Mixes for you" shelf holds under a chip: Songs the Prabhat Samgiita mixes, Kiirtan the Kiirtan mixes, All both. */
export function mixKindsFor(filter: HomeFilterId): { songs: boolean; kiirtan: boolean } {
  return { songs: filter !== "kiirtan", kiirtan: filter !== "songs" }
}

/** Two lists in turns (a, b, a, b ...), the longer one's rest at the end: "everything mixed" for one shelf. */
export function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const out: T[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]!)
    if (i < b.length) out.push(b[i]!)
  }
  return out
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

/**
 * Flat tile colours (Search tiles, collection tiles). Never for a label over a photo: those use the
 * neutral dark-glass chip. Light tints carry dark ink (peach, gold300), deep fills carry white (sage,
 * forest). No mid-tone orange fill: "orange" is the peach tint, so no text ever sits on bright orange.
 */
export function stripColors(tone: StripTone, dark: boolean): { bg: string; fg: string } {
  switch (tone) {
    case "orange":
      return dark ? { bg: "#3A2418", fg: "#F4F1EC" } : { bg: "#FFDCC5", fg: "#1E1E1E" }
    case "gold":
      return { bg: "#F5C253", fg: "#1E1E1E" }
    case "sage":
      return { bg: "#3C5535", fg: "#FFFFFF" }
    case "forest":
      return { bg: dark ? "#2C3A27" : "#20281A", fg: "#FFFFFF" }
  }
}
