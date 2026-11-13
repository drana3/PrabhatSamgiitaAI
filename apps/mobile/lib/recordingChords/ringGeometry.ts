/**
 * The measures of a chord-cycle ring (docs/kiirtan-cycle.md), kept apart from the React component so tests can run them.
 * Pure arithmetic.
 */

/** Centres of `count` places on a circle of radius `r` around (cx, cy), the first at the top, going clockwise. */
export function ringPoints(count: number, r: number, cx: number, cy: number): Array<{ x: number; y: number; angle: number }> {
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle }
  })
}

/**
 * Disc size for a ring: a little smaller when there are more places, never under the 44 touch target. The discs are large
 * enough for a name like "Asus4" or "F#m7", and the ring is wide (see `ringSizeFor`), so two neighbours never touch: with
 * eight places on a 390 px phone the gap between two discs is about 60 px.
 */
export function discSize(count: number): number {
  return count <= 5 ? 64 : count <= 6 ? 60 : 56
}

export const RING_TAG_ROOM = 20

/** The width a ring may take: the whole row between the page gutters, never more than 340 so it stays a circle on a tablet. */
export function ringSizeFor(windowWidth: number, side: number): number {
  // the ring's box is `size` plus the room for the "Start" tag, so that room is taken off here
  return Math.max(240, Math.min(340, Math.min(windowWidth, 640) - 2 * side - RING_TAG_ROOM))
}

/** Font of a chord name in a disc: shorter names are larger, so "Asus4" and "C#maj7" still fit a disc whole. */
export function chordFont(chord: string | null): number {
  const n = chord?.length ?? 1
  return n <= 2 ? 19 : n <= 3 ? 18 : n <= 4 ? 16 : n <= 5 ? 14 : 12
}
