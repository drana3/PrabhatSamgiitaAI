import type { RemoteRecording } from "@/lib/kirtan/remote"

/**
 * Shapes of the author-profile API (apps/api/app/schemas/author_profiles.py, docs/author-profiles.md).
 * Plain data, no React.
 */

export type AuthorType = "solo" | "group"
export type IncludeMode = "all" | "chosen"
export type ProfileStatus = "draft" | "published" | "suspended"
export type LinkKind =
  | "youtube"
  | "instagram"
  | "facebook"
  | "telegram"
  | "spotify"
  | "soundcloud"
  | "bandcamp"
  | "apple_music"
  | "x"
  | "website"
export type ReportReason = "impersonation" | "offensive" | "spam" | "copyright" | "wrong_info" | "other"
export type StatsPeriod = 7 | 30 | 90
export type DirectorySort = "listeners" | "new" | "name"
/** The recording kinds the directory can filter by (the server's list). */
export const DIRECTORY_KINDS = ["kiirtan", "bhajan", "prabhat_samgiita", "spiritual_song", "dance_song"] as const
export type DirectoryKind = (typeof DIRECTORY_KINDS)[number]
export type DirectoryQuery = { q?: string; sort?: DirectorySort; kind?: DirectoryKind; language?: string; offset?: number; limit?: number }

export type AuthorLink = { kind: LinkKind; url: string }
export type PublicLink = AuthorLink & { rel: string }

export type PublicStats = {
  enough_data: boolean
  counting_since: string | null
  monthly_listeners: number | null
  total_plays: number | null
}

export type KindCount = { kind: string; count: number }

export type AuthorCardData = {
  slug: string
  display_name: string
  author_type: AuthorType
  bio: string
  verified: boolean
  photo_url: string | null
  country?: string | null
  monthly_listeners?: number | null
  recordings_count: number
}

export type AuthorList = { items: AuthorCardData[]; total: number; limit: number; offset: number; has_more: boolean }

export type AuthorProfilePublic = {
  slug: string
  display_name: string
  author_type: AuthorType
  bio: string
  about: string
  country: string | null
  city: string | null
  languages: string[]
  links: PublicLink[]
  verified: boolean
  kinds: KindCount[]
  recordings_count: number
  collections_count: number
  photo_url: string | null
  published_at: string | null
  updated_at: string
  stats: PublicStats | null
  indexable: boolean
}

export type AuthorProfileOwner = {
  id: string
  slug: string
  display_name: string
  author_type: AuthorType
  bio: string
  about: string
  country: string | null
  city: string | null
  languages: string[]
  links: AuthorLink[]
  claimed_name: string | null
  status: ProfileStatus
  review_needed: boolean
  review_reason: string | null
  verified: boolean
  suspended_reason: string | null
  include_uploads: IncludeMode
  show_stats: boolean
  photo_url: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  recordings_count: number
  indexable: boolean
  slug_change_wait_days: number
  reports_count: number
  share_path: string
}

export type OwnerResponse = {
  profile: AuthorProfileOwner | null
  can_create: boolean
  suspended_reason: string | null
}

export type CreateInput = {
  slug: string
  display_name: string
  author_type: AuthorType
  bio: string
  about: string
  country: string | null
  city: string | null
  languages: string[]
  links: AuthorLink[]
  claimed_name: string | null
  include_uploads: IncludeMode
  show_stats: boolean
  publish: boolean
}

export type PatchInput = Partial<Omit<CreateInput, "publish">>

export type SlugCheck = {
  slug: string
  available: boolean
  /** too_short, too_long, characters, needs_letter, reserved, taken, quarantined, cooldown */
  problem: string | null
  held_for_review: boolean
  suggestions: string[]
}

export type CollectionBrief = {
  id: string
  title: string
  place: string | null
  starts_on: string
  ends_on: string | null
  cover_url: string | null
  tracks_count: number
}

export type RecordingPage = { items: RemoteRecording[]; total: number; limit: number; offset: number; has_more: boolean }

export type OwnerRecording = { recording: RemoteRecording; shown: boolean; exception: boolean }

export type DayPoint = { day: string; plays: number; listeners: number }

export type OwnerStats = {
  period_days: number
  counting_since: string | null
  monthly_listeners: number
  total_plays: number
  plays_in_period: number
  public_enough_data: boolean
  public_visible: boolean
  series: DayPoint[]
  top_recordings: { recording_id: string; title: string; kind: string; plays: number }[]
  by_kind: KindCount[]
  countries: { country: string; listeners: number }[] | null
  notes: string[]
}

export type ReportOutcome = { status: "received" | "already_reported"; message: string }

/**
 * One counted listen for `POST /plays`: of a recording (`recording_id`, the server's id) or of a Prabhat Samgiita song of the
 * catalogue (`song_number`, 1 to 5018). Exactly one of the two is set; the server refuses an event with both or neither.
 */
export type PlayEventOut = {
  recording_id?: string
  song_number?: number
  played_at: string
  listened_sec: number
  duration_sec: number | null
}
export type PlayBatchResult = { accepted: number; duplicates: number; rejected: Record<string, number> }

/** The one thing the screens talk to: the real client or, in the preview, the demo. */
export interface AuthorsApi {
  /** true: invented data (the preview). Screens show a "Demo" label. */
  readonly demo: boolean
  mine(): Promise<OwnerResponse>
  checkSlug(slug: string): Promise<SlugCheck>
  create(input: CreateInput): Promise<AuthorProfileOwner>
  update(patch: PatchInput): Promise<AuthorProfileOwner>
  publish(): Promise<AuthorProfileOwner>
  unpublish(): Promise<AuthorProfileOwner>
  remove(): Promise<void>
  putPhoto(bytes: Blob, contentType: string): Promise<AuthorProfileOwner>
  removePhoto(): Promise<AuthorProfileOwner>
  myRecordings(offset?: number): Promise<{ items: OwnerRecording[]; total: number }>
  setShown(recordingId: string, shown: boolean): Promise<void>
  myStats(days: StatsPeriod): Promise<OwnerStats>
  directory(query: DirectoryQuery): Promise<AuthorList>
  profile(slug: string): Promise<AuthorLookup>
  recordings(slug: string, query: { kind?: string; collectionId?: string; exclude?: string; offset?: number; limit?: number }): Promise<RecordingPage>
  collections(slug: string): Promise<CollectionBrief[]>
  byRecording(recordingId: string): Promise<AuthorCardData | null>
  report(slug: string, report: { reason: ReportReason; comment?: string }): Promise<ReportOutcome>
}

/** A public lookup: a page, a moved address, a deleted page or nothing. */
export type AuthorLookup =
  | { kind: "profile"; profile: AuthorProfilePublic }
  | { kind: "moved"; slug: string }
  | { kind: "gone" }
  | { kind: "missing" }
