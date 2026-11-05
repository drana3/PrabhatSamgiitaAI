/**
 * Kiirtans: devotional group chanting, uploaded as audio files by their authors (and by the team).
 * A Kiirtan plays in the same player as a Prabhat Samgiita song (lib/kirtan/track.ts), just without
 * lyrics, words, chords or versions. Pure types and constants, no React, no I/O.
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
  title: string
  /** performer or group, as the author wrote it */
  author: string
  /** seconds; null while unknown (the server reads it from the file after the upload) */
  durationSec: number | null
  type: KirtanTypeId
  /**
   * The audio file the author uploaded. null for the preview samples (no real audio yet) and while a
   * submission has only been picked on the phone. TODO(api): the upload endpoint returns the stream URL.
   */
  audioUrl: string | null
  /** cover picture; null makes the type gradient show */
  thumbnailUrl: string | null
  /** display name of the person who added it */
  addedBy: string
  status: KirtanStatus
  /** ms since epoch */
  addedAt: number
  /** how often it was played; orders the artist page's "Popular" list. TODO(api): comes from the server. */
  plays?: number
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
