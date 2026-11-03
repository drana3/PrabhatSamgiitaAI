import type { ListRow } from "./sort"

/**
 * Fast-scroll rail (spec SCR-30): a 22px rail on the right edge. Touch down
 * anywhere or drag the thumb and the list jumps 1:1 to the matching row.
 */
export const RAIL = {
  width: 22,
  topInset: 190,
  bottomInset: 176,
  bubbleSize: 56,
  /** rows keep this much padding on the right so none sit under the rail */
  listPaddingRight: 34,
} as const

/** Finger y (in the rail's own coordinates) to 0..1, clamped. */
export function railFraction(y: number, railHeight: number): number {
  if (!(railHeight > 0)) return 0
  return Math.min(1, Math.max(0, y / railHeight))
}

/** 0..1 to a row index in a list of `rowCount` rows. */
export function railRowIndex(fraction: number, rowCount: number): number {
  if (rowCount <= 0) return 0
  const clamped = Math.min(1, Math.max(0, fraction))
  return Math.min(rowCount - 1, Math.round(clamped * (rowCount - 1)))
}

/** Row index back to 0..1, used to place the thumb while the list scrolls normally. */
export function rowFraction(index: number, rowCount: number): number {
  if (rowCount <= 1) return 0
  return Math.min(1, Math.max(0, index / (rowCount - 1)))
}

/** Bubble text for the row under the finger: letter, category, PS number or length. */
export function railLabelAt(rows: readonly ListRow[], index: number): string {
  const row = rows[Math.min(Math.max(index, 0), rows.length - 1)]
  if (!row) return ""
  return row.kind === "header" ? row.label : row.railLabel
}

/** True when the finger crossed into another group, which is when a haptic tick fires. */
export function groupChanged(rows: readonly ListRow[], from: number, to: number): boolean {
  const a = rows[from]
  const b = rows[to]
  if (!a || !b) return false
  return a.groupIndex !== b.groupIndex
}

/** The rail has nothing to jump over in a short list. */
export function railVisible(rowCount: number, minRows = 20): boolean {
  return rowCount >= minRows
}
