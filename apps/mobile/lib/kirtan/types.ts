import { t } from "@/lib/i18n"
/**
 * Devotional recordings, uploaded as audio files by their authors (and by the team). They are ONE recordings
 * system with four KINDS (`kind`, shown as "Type" in the add form): a Kiirtan is group chanting of Baba Nam Kevalam
 * (the library has this one mantra only), a Bhajan a devotional song, a Devotional song any other song of devotion,
 * and a Prabhat Samgiita recording is another performance of one of the 5018 songs (`psSong` names it).
 * All play in the same player as a Prabhat Samgiita song (lib/kirtan/track.ts). Pure types and constants, no React,
 * no I/O. Visible words for a kind come from lib/kirtan/kind.ts.
 */

/** The four kinds of one recording. Old data without a kind is a Kiirtan. */
export const RECORDING_KINDS = ["kiirtan", "bhajan", "devotional_song", "prabhat_samgiita"] as const
export type RecordingKind = (typeof RECORDING_KINDS)[number]
export type KindFilter = RecordingKind | "all"

/** Languages the uploader can name (the API's list). Optional. */
export const RECORDING_LANGUAGES = ["bengali", "sanskrit", "hindi", "english", "other"] as const
export type RecordingLanguage = (typeof RECORDING_LANGUAGES)[number]

/** The Prabhat Samgiita catalogue has 5018 songs; a Prabhat Samgiita recording names one of them. */
export const PS_SONG_COUNT = 5018

export const KIRTAN_TYPES = [
  { id: "bnk", get label() { return t("kt.type.bnk") } },
  { id: "lila", get label() { return t("kt.type.lila") } },
  { id: "festival", get label() { return t("kt.type.festival") } },
  { id: "other", get label() { return t("kt.type.other") } },
] as const

/** Types of a Bhajan: the time it is sung, devotional, or something else. "other" exists in both kinds. */
export const BHAJAN_TYPES = [
  { id: "morning", get label() { return t("kt.btype.morning") } },
  { id: "evening", get label() { return t("kt.btype.evening") } },
  { id: "devotional", get label() { return t("kt.btype.devotional") } },
  { id: "other", get label() { return t("kt.type.other") } },
] as const

export type KiirtanKindTypeId = (typeof KIRTAN_TYPES)[number]["id"]
export type BhajanTypeId = (typeof BHAJAN_TYPES)[number]["id"]
/** Any type id of either kind. Read it together with `kind` ("other" is in both). */
export type KirtanTypeId = KiirtanKindTypeId | BhajanTypeId
export type KirtanTypeFilter = KirtanTypeId | "all"

/** Chips of the list: All, then the four types. */
export const KIRTAN_CHIPS: readonly { id: KirtanTypeFilter; label: string }[] = [
  { id: "all", get label() { return t("kt.chip.all") } },
  ...KIRTAN_TYPES.map((type) => ({ id: type.id as KirtanTypeFilter, get label() { return type.label } })),
]

/**
 * Where a recording is in its life. There is NO waiting for review: a person who uploads gets the recording
 * `published` the moment the upload succeeds. The team looks afterwards and may mark it `removed` (with a reason).
 * `uploading` and `failed` only describe the transport on this phone.
 */
export type KirtanStatus = "uploading" | "published" | "failed" | "removed"

/** Why an upload did not finish; the person sees a plain sentence for each (lib/kirtan/rules.ts `uploadErrorText`). */
export type UploadFailureCode =
  | "network"
  | "signin"
  | "format"
  | "size"
  | "duplicate"
  | "removedDuplicate"
  | "dailyLimit"
  | "ownDuplicate"
  | "rules"
  | "gone"
  | "server"

/** A recording that is already in the library: what the "already there" and "removed as a copy" cards point at. */
export type KirtanOriginal = { id: string; title: string; author: string }

/** `original` is set when the file (or the same performance) is already in the library; the form offers to play it. */
export type UploadFailure = { code: UploadFailureCode; message?: string; original?: KirtanOriginal & { audioUrl: string } }

export type Kirtan = {
  id: string
  /** One of the four kinds. Old stored items have none and count as "kiirtan" (see lib/kirtan/kind.ts). */
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
  /** the person who added it said they are the author or perform it themselves; absent on older items */
  byAuthor?: boolean
  status: KirtanStatus
  /** ms since epoch */
  addedAt: number
  /** name of the picked audio file, kept so a failed upload can be sent again */
  fileName?: string
  /** the picker's content type, kept for the same reason */
  fileType?: string
  /** the server's id once the upload succeeded (a UUID); absent for the sample catalog and for uploads that never finished */
  serverId?: string
  /** the uploader's account id on the server; "Block this author" uses it. Absent for the sample catalog. */
  authorId?: string | null
  /** why the team removed it (status `removed`); empty when the reason is not known */
  removedReason?: string
  /** when it was removed, ms since epoch */
  removedAt?: number
  /** why the upload failed (status `failed`) */
  failure?: UploadFailure
  /** how often it was played; orders the artist page's "Popular" list. TODO(api): comes from the server. */
  plays?: number
  /** year of the performance, when known */
  year?: number
  /** language of the words, when the uploader named it */
  language?: RecordingLanguage
  /** words and music by, as the uploader wrote it (Bhajan and Devotional song) */
  credits?: string
  /** a short note from the uploader */
  notes?: string
  /** Prabhat Samgiita recordings only: the number of the song (1 to 5018) this is a performance of */
  psSong?: number
  /** the team removed this as a copy of that recording (status `removed`); the card offers to open the original */
  duplicateOf?: KirtanOriginal
}

export function isKirtanType(value: unknown): value is KirtanTypeId {
  return KIRTAN_TYPES.some((t) => t.id === value) || BHAJAN_TYPES.some((t) => t.id === value)
}

/** Label of a type; pass the kind so "Other" of a Bhajan and of a Kiirtan stay what they are. */
export function kirtanTypeLabel(id: KirtanTypeId, kind: RecordingKind = "kiirtan"): string {
  const list: readonly { id: string; label: string }[] = kind === "bhajan" ? BHAJAN_TYPES : KIRTAN_TYPES
  return list.find((t) => t.id === id)?.label ?? t("kt.type.other")
}

export const STATUS_LABEL: Record<KirtanStatus, string> = {
  get uploading() { return t("ugc.status.uploading") },
  get published() { return t("ugc.status.published") },
  get failed() { return t("ugc.status.failed") },
  get removed() { return t("ugc.status.removed") },
}
