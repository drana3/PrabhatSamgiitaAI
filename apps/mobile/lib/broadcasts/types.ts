/**
 * Broadcasts: a link to something that is on the air or announced (Zoom, YouTube Live, Facebook or Instagram Live,
 * any other site). apps/api `/api/v1/broadcasts`, docs/broadcasts.md. The app never fetches the link: a YouTube one
 * plays through the site's own embed like a video link (lib/recordingVideos/embed.ts); every other site is only
 * ever opened outside the app with "Open".
 */
export type BroadcastProvider = "youtube" | "zoom" | "facebook" | "instagram" | "other"
export type BroadcastPhase = "upcoming" | "now" | "ended"
export type BroadcastLinkStatus = "unknown" | "ok" | "no_embed" | "unavailable"
export type BroadcastReportReason = "broken" | "not_a_broadcast" | "offensive" | "spam" | "other"

export type Broadcast = {
  id: string
  provider: BroadcastProvider
  url: string
  host: string
  title: string
  description: string | null
  organizer: string | null
  /** null: no start was given, the broadcast counts as live from the moment it was posted */
  startsAt: string | null
  timezone: string | null
  endsAt: string
  phase: BroadcastPhase
  archived: boolean
  thumbnailUrl: string | null
  linkStatus: BroadcastLinkStatus
  status: "published" | "removed"
  mine: boolean
  canEnd: boolean
  canRemove: boolean
  createdAt: string
  /** only for the author and the team */
  reportsCount: number | null
}

export type BroadcastList = { items: Broadcast[]; total: number }
export type BroadcastWhich = "shelf" | "recent"

export type BroadcastDraft = {
  url: string
  title: string
  description: string | null
  organizer: string | null
  /** local date and time without an offset, `YYYY-MM-DDTHH:MM`, with the device's zone name; both null when there is no start */
  startsAt: string | null
  timezone: string | null
}

/** What a person can be told when something goes wrong. Each has a sentence in locales/broadcasts.ts. */
export type BroadcastFailure =
  | "signin"
  | "empty" // no link
  | "badLink" // not one link
  | "notHttps"
  | "notPublic" // an address of a machine or a private network, an IP number, a non-ASCII name
  | "channel" // a YouTube link that is not one video
  | "bareSite" // only the name of a site
  | "tooLong"
  | "titleShort"
  | "titleLong"
  | "titleLatin"
  | "titleLink"
  | "textLink"
  | "startBad"
  | "startPast"
  | "startFar"
  | "dailyLimit"
  | "liveLimit"
  | "duplicate"
  | "slowDown"
  | "refused" // the server said no with a sentence of its own
  | "network"
  | "gone"
  | "server"

export interface BroadcastsBackend {
  list(which: BroadcastWhich, limit?: number): Promise<BroadcastList>
  mine(): Promise<BroadcastList>
  get(id: string): Promise<Broadcast>
  create(draft: BroadcastDraft): Promise<Broadcast>
  end(id: string): Promise<Broadcast>
  remove(id: string): Promise<void>
  report(id: string, report: { reason: BroadcastReportReason; note?: string | null }): Promise<{ status: "received" | "already_reported" }>
}
