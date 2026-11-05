/**
 * Kiirtans and Bhajans: devotional recordings, uploaded as audio files by their authors (and by the
 * team). They are ONE recordings system with two KINDS (`kind`): a Kiirtan is group chanting, a Bhajan
 * a devotional song. Both play in the same player as a Prabhat Samgiita song (lib/kirtan/track.ts),
 * just without lyrics, words, chords or versions. Pure types and constants, no React, no I/O.
 * Visible words for a kind come from lib/kirtan/kind.ts.
 */

/** The two kinds of one recording. Old data without a kind is a Kiirtan. */
export const RECORDING_KINDS = ["kiirtan", "bhajan"] as const
export type RecordingKind = (typeof RECORDING_KINDS)[number]
export type KindFilter = RecordingKind | "all"

export const KIRTAN_TYPES = [
  { id: "bnk", label: "Baba Nam Kevalam" },
  { id: "lila", label: "Lila kiirtan" },
  { id: "festival", label: "Festival" },
  { id: "other", label: "Other" },
] as const

/** Types of a Bhajan: the time it is sung, devotional, or something else. "other" exists in both kinds. */
export const BHAJAN_TYPES = [
  { id: "morning", label: "Morning" },
  { id: "evening", label: "Evening" },
  { id: "devotional", label: "Devotional" },
  { id: "other", label: "Other" },
] as const

export type KiirtanKindTypeId = (typeof KIRTAN_TYPES)[number]["id"]
export type BhajanTypeId = (typeof BHAJAN_TYPES)[number]["id"]
/** Any type id of either kind. Read it together with `kind` ("other" is in both). */
export type KirtanTypeId = KiirtanKindTypeId | BhajanTypeId
export type KirtanTypeFilter = KirtanTypeId | "all"

/** Chips of the list: All, then the four types. */
export const KIRTAN_CHIPS: readonly { id: KirtanTypeFilter; label: string }[] = [{ id: "all", label: "All" }, ...KIRTAN_TYPES]

export type KirtanStatus = "pending" | "approved" | "rejected"

export type Kirtan = {
  id: string
  /** Kiirtan or Bhajan. Old stored items have none and count as "kiirtan" (see lib/kirtan/kind.ts). */
  kind: RecordingKind
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
  return KIRTAN_TYPES.some((t) => t.id === value) || BHAJAN_TYPES.some((t) => t.id === value)
}

/** Label of a type; pass the kind so "Other" of a Bhajan and of a Kiirtan stay what they are. */
export function kirtanTypeLabel(id: KirtanTypeId, kind: RecordingKind = "kiirtan"): string {
  const list: readonly { id: string; label: string }[] = kind === "bhajan" ? BHAJAN_TYPES : KIRTAN_TYPES
  return list.find((t) => t.id === id)?.label ?? "Other"
}

export const STATUS_LABEL: Record<KirtanStatus, string> = {
  pending: "In review",
  approved: "Approved",
  rejected: "Not accepted",
}
