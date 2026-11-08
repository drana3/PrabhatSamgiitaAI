import { t } from "@/lib/i18n"
/**
 * Devotional recordings, uploaded as audio files by their authors (and by the team). They are ONE recordings
 * system with six KINDS (`kind`, shown as "Type" in the add form): a Kiirtan is group chanting of Baba Nam Kevalam
 * (the library has this one mantra only), a Bhajan is a devotional song, a Prabhat Samgiita recording is another
 * performance of one of the 5018 songs (`psSong` names it), a Spiritual song is any other song of the spiritual path
 * (its LANGUAGE is required), a Dance music is music for Tandava or Kaoshiki (its DANCE is required) and Baba's Audio
 * Discourses are spoken talks of Baba (LANGUAGE required, no performer: the speaker is Baba; place and discourse name optional).
 * "Devotional song" was a kind once; a Bhajan already is one, so it is gone (old stored items and old server rows with
 * it read as a Bhajan: lib/kirtan/kind.ts normalizeKind). It is NOT the same as "Spiritual song".
 * All play in the same player as a Prabhat Samgiita song (lib/kirtan/track.ts). Pure types and constants, no React,
 * no I/O. Visible words for a kind come from lib/kirtan/kind.ts.
 */

/** The six kinds of one recording. Old data without a kind is a Kiirtan. */
export const RECORDING_KINDS = ["kiirtan", "bhajan", "prabhat_samgiita", "spiritual_song", "dance_song", "baba_audio"] as const
export type RecordingKind = (typeof RECORDING_KINDS)[number]
/** Kinds that were removed but may still sit in stored data or in old server rows, and the kind they now read as. */
export const LEGACY_KINDS: Readonly<Record<string, RecordingKind>> = { devotional_song: "bhajan" }
/** How a kind treats the sung language: not asked, asked but optional, or REQUIRED (the form, the queue and the API refuse without it). */
export type LanguageRule = "none" | "optional" | "required"
/**
 * ONE table for the language rule of every kind (the API keeps the same table in `KIND_LANGUAGE_RULE`).
 * Kiirtan: none (always Baba Nam Kevalam). Bhajan and Spiritual song: REQUIRED (for new uploads; a Bhajan stored
 * earlier without a language stays valid). Prabhat Samgiita: optional.
 * Dance music: language optional (the dance is what is required, see DANCES).
 * Baba's Audio Discourses: REQUIRED (a talk is given in a language).
 */
export const KIND_LANGUAGE_RULE: Readonly<Record<RecordingKind, LanguageRule>> = {
  kiirtan: "none",
  bhajan: "required",
  prabhat_samgiita: "optional",
  spiritual_song: "required",
  dance_song: "optional",
  baba_audio: "required",
}
/** The kinds whose add form asks for the sung language (everything but Kiirtan). */
export const LANGUAGE_KINDS: readonly RecordingKind[] = RECORDING_KINDS.filter((kind) => KIND_LANGUAGE_RULE[kind] !== "none")
/**
 * The dances a Dance music names (REQUIRED for that kind). ONE list: to add a dance, add its id here, the same id in the
 * API (`DANCES` in app/models/recordings.py) and a `dance.<id>` label in the three dictionaries.
 */
export const DANCES = ["tandava", "kaoshiki"] as const
export type DanceId = (typeof DANCES)[number]
/** The kinds that name a dance. */
export const DANCE_KINDS: readonly RecordingKind[] = ["dance_song"]
/** Baba's Audio Discourses: the speaker is always Baba, so no performer is asked and this name is stored (the API stores the same). */
export const BABA_AUTHOR = "Shrii Shrii Anandamurti"
/** The kinds that ask for the optional place and discourse name/number instead of a performer. */
export const DISCOURSE_KINDS: readonly RecordingKind[] = ["baba_audio"]
export type KindFilter = RecordingKind | "all"

/** A language code of the catalog (lib/kirtan/languages.ts: ISO 639) or "other" (then `languageOther` names it). */
export type RecordingLanguage = string

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
  | "setDailyLimit"
  | "setFull"
  | "fields"
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
  /** One of the six kinds. Old stored items have none and count as "kiirtan" (see lib/kirtan/kind.ts). */
  kind: RecordingKind
  title: string
  /** performer or group, as the author wrote it */
  author: string
  /** seconds; null while unknown (the server reads it from the file after the upload) */
  durationSec: number | null
  /** Measured loudness of the audio file (volume leveling); absent when the server has not measured it. */
  loudnessLufs?: number
  truePeakDb?: number
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
  /** language of the words (an ISO code, or "other"), when the uploader named it */
  language?: RecordingLanguage
  /** the uploader's own name for the language, when `language` is "other" */
  languageOther?: string
  /** Kiirtan only: the Indian Kiirtan style (a KIIRTAN_STYLES id or "other"), when named (lib/kirtan/styles.ts) */
  style?: string
  /** the uploader's own name for the style, when `style` is "other" */
  styleOther?: string
  /** Kiirtan only: the practice it is for ("avarta" = Avarta Kiirtan), when marked (lib/kirtan/practice.ts) */
  practice?: string
  /** how it was recorded: studio, live, home or ai (lib/kirtan/recordingInfo.ts); required for a new Kiirtan, absent on older items */
  recordingType?: string
  /** slow, medium or fast, when named */
  tempo?: string
  /** solo or group, when named */
  performance?: string
  /** Dance music: which dance (a DANCES id) */
  dance?: DanceId
  /** Baba's Audio Discourses: where it was given (optional) */
  place?: string
  /** Baba's Audio Discourses: the name or number of the discourse (optional) */
  discourse?: string
  /** the playlist from an event this recording belongs to (a server id) */
  collectionId?: string
  /** place in that playlist, 1 first */
  position?: number
  /** the day it was recorded, YYYY-MM-DD (a playlist track may differ from the playlist's first day) */
  recordedOn?: string
  /** words and music by, as the uploader wrote it (Bhajan) */
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
