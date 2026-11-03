/** The three segments of Songs (spec SCR-11 item 3). */
export const SONG_SEGMENTS = [
  { id: "catalog", label: "Catalog" },
  { id: "collections", label: "Collections" },
  { id: "mine", label: "Mine" },
] as const

export type SongSegmentId = (typeof SONG_SEGMENTS)[number]["id"]

export function isSegmentId(value: unknown): value is SongSegmentId {
  return SONG_SEGMENTS.some((s) => s.id === value)
}

export function segmentIndex(id: SongSegmentId): number {
  return SONG_SEGMENTS.findIndex((s) => s.id === id)
}

/** Width of one segment cell inside the control; the indicator is one cell wide. */
export function segmentCellWidth(totalWidth: number, inset = 0): number {
  return Math.max(0, (totalWidth - inset * 2) / SONG_SEGMENTS.length)
}

/** Indicator offset in dp for a segment (or a fractional position while dragging). */
export function indicatorOffset(position: number, totalWidth: number, inset = 0): number {
  const max = SONG_SEGMENTS.length - 1
  const clamped = Math.min(max, Math.max(0, position))
  return inset + clamped * segmentCellWidth(totalWidth, inset)
}

/** Query parameter `?segment=` -> a valid segment, default Catalog. */
export function parseSegment(value: string | string[] | undefined): SongSegmentId {
  const raw = Array.isArray(value) ? value[0] : value
  return isSegmentId(raw) ? raw : "catalog"
}
