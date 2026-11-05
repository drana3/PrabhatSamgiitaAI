import type { Kirtan } from "@/lib/kirtan/types"

/**
 * "By length": the three chips of the Kiirtan tab. The first two are open on the upper side: a
 * Kiirtan of exactly 15 minutes is "15 to 60", exactly 60 minutes is "1 hour +". Pure.
 */
export const LENGTH_BUCKETS = [
  { id: "short", label: "Under 15 min", minSec: 0, maxSec: 15 * 60 },
  { id: "mid", label: "15 to 60", minSec: 15 * 60, maxSec: 60 * 60 },
  { id: "long", label: "1 hour +", minSec: 60 * 60, maxSec: Infinity },
] as const

export type LengthBucketId = (typeof LENGTH_BUCKETS)[number]["id"]

/** The bucket of a length in seconds; null while the length is unknown. */
export function lengthBucketOf(seconds: number | null | undefined): LengthBucketId | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null
  return LENGTH_BUCKETS.find((b) => seconds >= b.minSec && seconds < b.maxSec)?.id ?? null
}

/** Kiirtans of one length bucket, or all of them when `bucket` is null. Unknown lengths never match a bucket. */
export function filterByLength<T extends Pick<Kirtan, "durationSec">>(list: readonly T[], bucket: LengthBucketId | null): T[] {
  return bucket == null ? [...list] : list.filter((k) => lengthBucketOf(k.durationSec) === bucket)
}

/** "Long kiirtans" shelf: one hour and more, longest first. */
export function longKirtans<T extends Pick<Kirtan, "durationSec">>(list: readonly T[], limit = 6): T[] {
  return filterByLength(list, "long")
    .sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0))
    .slice(0, limit)
}
