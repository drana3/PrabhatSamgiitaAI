import { CATEGORY_FALLBACK, formatDuration, type CatalogEntry } from "./entry"
import { t } from "@/lib/i18n"
import type { RailTick } from "./layout"
import type { ListRow } from "./sort"

/**
 * Row styles of the song lists (Songs tab, Mine, collections and All songs).
 *  - tracklist: no card, 56px rows, the PS number in a column on the left, hairline between rows (default)
 *  - compact:   44px tiles, number and title only, 6px apart, no group headers
 *  - cards:     the first design, 76px white cards with an eyebrow over the title
 * The choice is stored per device (stores/listViewStore.ts).
 */
export type RowStyle = "tracklist" | "compact" | "cards"

export const DEFAULT_ROW_STYLE: RowStyle = "tracklist"

export const ROW_STYLE_OPTIONS: readonly { id: RowStyle; label: string }[] = [
  { id: "tracklist", get label() { return t("songs.rows.tracklist") } },
  { id: "compact", get label() { return t("songs.rows.compact") } },
  { id: "cards", get label() { return t("songs.rows.cards") } },
]

export function isRowStyle(value: unknown): value is RowStyle {
  return value === "tracklist" || value === "compact" || value === "cards"
}

/** A stored value that is not one of the three falls back to the default. */
export function normalizeRowStyle(value: unknown): RowStyle {
  return isRowStyle(value) ? value : DEFAULT_ROW_STYLE
}

export type RowGeometry = {
  /** height of the row itself */
  row: number
  /** space under each row (inside its slot) */
  gap: number
  /** slot height of a letter header (A to Z, Category orders); 0 = the style draws none */
  header: number
  /** padding of the slot, left and right (the right one leaves room for the rail) */
  padLeft: number
  padRight: number
}

export const ROW_GEOMETRY: Record<RowStyle, RowGeometry> = {
  cards: { row: 76, gap: 10, header: 52 + 10, padLeft: 10, padRight: 34 },
  tracklist: { row: 56, gap: 0, header: 56, padLeft: 10, padRight: 24 },
  compact: { row: 44, gap: 6, header: 0, padLeft: 10, padRight: 24 },
}

/** Slot height of one list entry: the row plus its gap, or the header's own height. */
export function slotHeight(style: RowStyle, kind: "song" | "header"): number {
  const g = ROW_GEOMETRY[style]
  return kind === "header" ? g.header : g.row + g.gap
}

/**
 * Height of one row on the playlist-style list pages (All songs, a collection). Their "Cards" look is
 * the 64px picture row, so only Tracklist and Compact take the slot heights above.
 */
export const LIST_PAGE_CARDS_ROW = 64

export function listPageRowHeight(style: RowStyle): number {
  return style === "cards" ? LIST_PAGE_CARDS_ROW : slotHeight(style, "song")
}

/** Compact has no group headers: the rows are one plain run. */
export function rowsForStyle(rows: readonly ListRow[], style: RowStyle): readonly ListRow[] {
  if (style !== "compact") return rows
  return rows.some((row) => row.kind === "header") ? rows.filter((row) => row.kind === "song") : rows
}

/** The A-Z rail jumps to group headers only when the style draws them. */
export function groupedForStyle(grouped: boolean, style: RowStyle): boolean {
  return grouped && ROW_GEOMETRY[style].header > 0
}

/* ---------------------------------------------------------------- rail marks */

/** 1 -> "1", 480 -> "480", 1004 -> "1k", 4980 -> "5k": at most three characters for the 12px rail. */
export function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return ""
  const whole = Math.round(n)
  if (whole < 1000) return String(whole)
  return `${Math.round(whole / 1000)}k`
}

const MARKS = 6

/**
 * Number marks for the quiet rail: `1, 1k, 2k ...`, each at the place of its row. Only for an order
 * that follows the book (rows run up or down by number) and long enough to need them; otherwise null
 * and the rail keeps its dots. Ticks sit where `railJump` lands (row index / (count - 1)).
 */
export function numberRailMarks(rows: readonly ListRow[], marks = MARKS): RailTick[] | null {
  const songs: number[] = []
  for (const row of rows) if (row.kind === "song") songs.push(row.entry.number)
  const n = songs.length
  if (n < 40) return null
  const dir = songs[n - 1] > songs[0] ? 1 : -1
  for (let k = 0; k < 24; k++) {
    // spot check that the whole list runs the same way; a sort by length or title will fail this
    const a = songs[Math.floor((k / 24) * (n - 1))]
    const b = songs[Math.floor(((k + 1) / 24) * (n - 1))]
    if ((b - a) * dir < 0) return null
  }
  const ticks: RailTick[] = []
  for (let k = 0; k < marks; k++) {
    const f = k / (marks - 1)
    const index = Math.round(f * (n - 1))
    ticks.push({ label: compactNumber(songs[index]), y: k === 0 ? 3 : k === marks - 1 ? 97 : f * 100, dot: false })
  }
  return ticks
}

/* ---------------------------------------------------------------- row text */

/**
 * The quiet second line of a Tracklist row: `3:58 · Offline · Mine`. The catalogue does not send lengths
 * yet, so without a duration the song's category stands in (never the "Other" fallback). Markers come last.
 */
export function rowMeta(
  entry: Pick<CatalogEntry, "durationSeconds" | "category">,
  flags: { offline?: boolean; saved?: boolean } = {},
): string {
  const parts: string[] = []
  const duration = formatDuration(entry.durationSeconds)
  if (duration) parts.push(duration)
  else if (entry.category && entry.category !== CATEGORY_FALLBACK) parts.push(entry.category)
  if (flags.offline) parts.push(t("songs.offline"))
  if (flags.saved) parts.push(t("songs.mine"))
  return parts.join(" \u00b7 ")
}
