/**
 * Kirtans: devotional group chanting, shared as YouTube links and played ONLY in the official
 * YouTube embedded player. Nothing here downloads, extracts or caches YouTube audio or video.
 * Pure types and constants, no React, no I/O.
 */

export const KIRTAN_TYPES = [
  { id: "bnk", label: "Baba Nam Kevalam" },
  { id: "lila", label: "Lila kiirtan" },
  { id: "festival", label: "Festival" },
  { id: "other", label: "Other" },
] as const

export type KirtanTypeId = (typeof KIRTAN_TYPES)[number]["id"]
export type KirtanTypeFilter = KirtanTypeId | "all"

/** Chips of the list: All, then the four types. */
export const KIRTAN_CHIPS: readonly { id: KirtanTypeFilter; label: string }[] = [{ id: "all", label: "All" }, ...KIRTAN_TYPES]

export type KirtanStatus = "pending" | "approved" | "rejected"

export type Kirtan = {
  id: string
  /** the 11-character YouTube video id */
  videoId: string
  title: string
  /** YouTube channel name (oEmbed author_name) */
  author: string
  /** seconds; null while unknown (oEmbed does not give a length) */
  durationSec: number | null
  type: KirtanTypeId
  /** oEmbed thumbnail_url; null makes the gradient show */
  thumbnailUrl: string | null
  /** display name of the person who added it */
  addedBy: string
  status: KirtanStatus
  /** ms since epoch */
  addedAt: number
}

export function isKirtanType(value: unknown): value is KirtanTypeId {
  return KIRTAN_TYPES.some((t) => t.id === value)
}

export function kirtanTypeLabel(id: KirtanTypeId): string {
  return KIRTAN_TYPES.find((t) => t.id === id)?.label ?? "Other"
}

export const STATUS_LABEL: Record<KirtanStatus, string> = {
  pending: "In review",
  approved: "Approved",
  rejected: "Not accepted",
}
