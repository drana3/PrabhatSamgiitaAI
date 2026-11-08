import type { PublicStats, WeekPlays } from "@/lib/authors/types"

/**
 * What the statistics block of a public page shows (variant A, falling back to D; docs/author-profiles.md, "Statistics").
 *
 * - `none`   the owner hid the numbers: nothing at all.
 * - `quiet`  under the threshold of counted plays: one quiet line, "counting since <date>", never a number.
 * - `line`   variant D: one plain line of two numbers. Used when there are enough plays but a line would say too little.
 * - `chart`  variant A: the big number and the weekly line.
 */
export type StatsMode = "none" | "quiet" | "line" | "chart"

/** A line needs at least this many weeks of data (counting began that long ago) ... */
export const MIN_CHART_WEEKS = 3
/** ... and at least this many of them with a play in them (all zeros is a flat line, not a story). */
export const MIN_ACTIVE_WEEKS = 2

export function statsMode(stats: PublicStats | null | undefined): StatsMode {
  if (!stats) return "none"
  if (!stats.enough_data || stats.monthly_listeners == null || stats.total_plays == null) return "quiet"
  const weeks = stats.weeks ?? []
  const active = weeks.filter((w) => w.plays > 0).length
  return weeks.length >= MIN_CHART_WEEKS && active >= MIN_ACTIVE_WEEKS ? "chart" : "line"
}

export type Point = { x: number; y: number }

/** Screen points of the weekly line: evenly spread across `width`, zero at the bottom, the busiest week at the top. */
export function sparkPoints(weeks: readonly WeekPlays[], width: number, height: number, pad = 6): Point[] {
  if (!weeks.length || width <= 0 || height <= 0) return []
  const peak = Math.max(1, ...weeks.map((w) => w.plays))
  const span = weeks.length > 1 ? (width - 2 * pad) / (weeks.length - 1) : 0
  return weeks.map((w, i) => ({
    x: weeks.length > 1 ? pad + i * span : width / 2,
    y: pad + (1 - w.plays / peak) * (height - 2 * pad),
  }))
}

const n = (value: number): string => String(Math.round(value * 10) / 10)

export function linePath(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${n(p.x)} ${n(p.y)}`).join(" ")
}

/** The filled area under the line, down to the bottom edge. */
export function areaPath(points: readonly Point[], height: number): string {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return ""
  return `${linePath(points)} L${n(last.x)} ${n(height)} L${n(first.x)} ${n(height)} Z`
}
