import type { ListRow, RailGroup } from "./sort"

/**
 * Measurements of the Songs screen, copied from the prototype CSS (Main.dc.html, `.scr`, `.head`,
 * `.t-page-h1`, `.pstk`, `.seg`, `.spbar`, `.listbar`, `.song`, `.ghdr`). Every number here is a
 * pixel value of the 390 x 844 board. Positions are in scroll-content coordinates, so the
 * safe-area top inset (54 on the board) is added by the functions below.
 */
export const SONGS_LAYOUT = {
  /** logo row */
  head: 56,
  /** h1 block: 12 top + two 45px lines + 20 bottom */
  title: 122,
  /** search pill 56 + 8 bottom padding */
  pillBlock: 64,
  /** margin under the pill block */
  pillGap: 4,
  /** the chips row (All, Saved, Downloaded, Playlists): the only sticky row under the search pill */
  chips: 56,
  /** the Collections shelf: 24 top + 30 heading + 14 gap + 112 cards + 20 bottom */
  shelf: 200,
  /** the "All songs" heading above the sort bar */
  allHead: 52,
  /** sort / count / Play all bar: 12 + 40 + 12 */
  listbar: 64,
  /** song card min-height and the gap between list children */
  row: 76,
  gap: 10,
  /** letter header: 20 top + 30 + 2 bottom */
  header: 52,
  /** the chips row pins this far below the pinned search pill (`.spbar.under{top:64px}`) */
  stripPin: 64,
  /** the pill narrows by this much when it sticks (board: 370 wide, 312 stuck) */
  pillNarrow: 58,
  /** the pill starts narrowing this far before it sticks */
  narrowLead: 50,
  /** scroll content bottom padding */
  bottom: 190,
} as const

export type SongsSpots = {
  pillTop: number
  /** natural top of the chips row */
  chipsTop: number
  /** top of the Collections shelf (the "all" chip) or of the Saved / Downloaded / Playlists body */
  shelfTop: number
  /** bottom of the header block in the list, where rows begin (the "all" chip) */
  listTop: number
}

export function songsSpots(inset: number): SongsSpots {
  const L = SONGS_LAYOUT
  const pillTop = inset + L.head + L.title
  const chipsTop = pillTop + L.pillBlock + L.pillGap
  const shelfTop = chipsTop + L.chips
  return {
    pillTop,
    chipsTop,
    shelfTop,
    listTop: shelfTop + L.shelf + L.allHead + L.listbar,
  }
}

/** Where a sticky block sits for a scroll offset: it follows its place until it reaches `pin`. */
export function stickyY(natural: number, scroll: number, pin: number): number {
  "worklet"
  return Math.max(natural - scroll, pin)
}

/** The chips row is "stuck" once it reached its pin and the list moved at all. */
export function isStripStuck(scroll: number, chipsTop: number, pin: number): boolean {
  "worklet"
  return scroll > 4 && chipsTop - scroll <= pin + 0.5
}

export type RowMetrics = {
  /** height of each list row including its gap */
  heights: number[]
  /** top of each row in list coordinates, after `offset` */
  offsets: number[]
  total: number
}

/** Offsets of every row; song cards are 76 high, letter headers 52, each followed by the 10px gap. */
export function rowMetrics(rows: readonly ListRow[], offset = 0): RowMetrics {
  const heights: number[] = new Array(rows.length)
  const offsets: number[] = new Array(rows.length)
  let y = offset
  for (let i = 0; i < rows.length; i++) {
    const h = (rows[i].kind === "header" ? SONGS_LAYOUT.header : SONGS_LAYOUT.row) + SONGS_LAYOUT.gap
    heights[i] = h
    offsets[i] = y
    y += h
  }
  return { heights, offsets, total: y - offset }
}

/**
 * Scroll offset that puts a row right under the pinned header (status area, pill and chips row),
 * like the prototype's `scrollTop = target.offsetTop - 54 - 112`.
 */
export function scrollOffsetForRow(rowTop: number, inset: number): number {
  const L = SONGS_LAYOUT
  return Math.max(0, rowTop - (inset + L.stripPin + L.chips - 4))
}

/** The rail: one tick per group (letter or category), or five dots when the order has no groups. */
export type RailTick = { label: string; y: number; dot: boolean }

export function railTicks(groups: readonly RailGroup[], grouped: boolean, category: boolean): RailTick[] {
  if (!grouped) return [4, 27, 50, 73, 96].map((y) => ({ label: "", y, dot: true }))
  const n = Math.max(1, groups.length)
  return groups.map((group, k) => ({
    label: category ? group.label.slice(0, 3) : group.label,
    y: ((k + 0.5) / n) * 100,
    dot: false,
  }))
}

export type RailJump = { index: number; label: string }

/**
 * Finger position on the rail (0 to 1) to the row it jumps to and the bubble text.
 * Grouped orders jump to a group header; the others spread the whole list over the rail.
 */
export function railJump(fraction: number, rows: readonly ListRow[], groups: readonly RailGroup[], grouped: boolean): RailJump {
  const f = Math.min(1, Math.max(0, fraction))
  if (grouped && groups.length) {
    const k = Math.min(groups.length - 1, Math.floor(f * groups.length))
    return { index: groups[k].rowIndex, label: groups[k].label }
  }
  if (!rows.length) return { index: 0, label: "" }
  const index = Math.min(rows.length - 1, Math.round(f * (rows.length - 1)))
  const row = rows[index]
  return { index, label: row.kind === "header" ? row.label : row.railLabel }
}
