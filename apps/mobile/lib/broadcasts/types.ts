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
/** where the live state comes from: YouTube's own word about the video, or the organizer's clock (no key, a private video, YouTube unreachable) */
export type BroadcastLiveSource = "clock" | "youtube"
export type BroadcastRecordingSource = "author" | "team" | "member" | "youtube"
/** what the viewer may do about the recording of an ended broadcast: add it (the author, the team), suggest it (another member), or nothing */
export type BroadcastRecordingAction = "add" | "suggest"

/** A recording of an ended broadcast: a link opened by the person (YouTube may play inside the app), or a recording of the library. */
export type BroadcastRecording = {
  id: string
  kind: "link" | "file"
  provider: string | null
  url: string | null
  host: string | null
  /** a library recording: its id, and its title */
  recordingId: string | null
  recordingTitle: string | null
  /** a suggestion waits for the team and is seen only by its sender and the team */
  status: "accepted" | "pending"
  source: BroadcastRecordingSource
  mine: boolean
  createdAt: string
}

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
  /** the end: "it is over", the end YouTube reported, the announced end, or (nothing said) 14 days after the start */
  endsAt: string
  /** the organizer announced the end (a broadcast with none is on until "It is over", at most 14 days) */
  endsDeclared: boolean
  liveSource: BroadcastLiveSource
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
  /** the team hid it from the lists; only the author and the team still read it */
  hidden: boolean | null
  recordings: BroadcastRecording[]
  recordingAction: BroadcastRecordingAction | null
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
  /** local date and time like `startsAt`, up to 14 days after the start; null: it is on until "It is over", at most 14 days */
  endsAt: string | null
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
  | "endBad"
  | "endPast"
  | "endBeforeStart"
  | "endFar"
  | "notEnded" // a recording is added to an ended broadcast only
  | "recordingSite" // not a YouTube video, a Zoom cloud recording, Vimeo or archive.org
  | "recordingMeeting" // the link of a Zoom meeting, not of its recording
  | "recordingFull"
  | "recordingDuplicate"
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
  /** the author and the team add the link of a recording, anybody else suggests it (the team decides) */
  addRecording(id: string, url: string): Promise<BroadcastRecording>
  removeRecording(id: string, linkId: string): Promise<void>
}
