import type { CommentAuthor } from "@/lib/songComments/types"

/**
 * Video links members attach to a recording or to a Prabhat Samgiita song (apps/api `/api/v1/video-links`,
 * docs/recording-extras.md). A link opens on the video's own site, or inside the app through the site's OWN embed when the site allows it (lib/recordingVideos/embed.ts). The app never downloads a video and never plays one in the background.
 * `author` is null for an anonymous link: the server never sends a name or an avatar for it.
 */
export type VideoProvider = "youtube" | "vimeo" | "archive"

/**
 * What the server's automatic look at the link found (apps/api services/video_checks.py). A soft hint, never a block:
 * `unknown` (not looked at yet), `ok` (exists, may be shown inside the app), `no_embed` (exists, but its owner does not let
 * other apps show it: only "Open"), `unavailable` (gone or private, seen twice in a row: a soft note, "Open" stays).
 */
export type VideoLinkStatus = "unknown" | "ok" | "no_embed" | "unavailable"

export type VideoTarget = { kind: "song"; id: number } | { kind: "recording"; id: string }

export type VideoLink = {
  id: string
  provider: VideoProvider
  /** the address the server rebuilt from the provider and the video's id: always https */
  url: string
  title: string | null
  createdAt: string
  isAnonymous: boolean
  author: CommentAuthor | null
  mine: boolean
  /** the viewer is on the team (may remove any link) */
  canRemove: boolean
  /** what the last automatic look found; "unknown" when the server did not say (an older server) */
  linkStatus: VideoLinkStatus
}

export type VideoList = { items: VideoLink[]; total: number; room: number }

export type VideoReportReason = "broken" | "not_about_this" | "offensive" | "spam" | "other"

/** What a person can be told when something goes wrong. Each has a sentence in locales/recordingExtras.ts. */
export type VideoFailure =
  | "signin"
  | "badLink" // not a link to one video
  | "notHttps" // http or another scheme
  | "provider" // a site that is not on the list
  | "duplicate" // already on the list
  | "teamRemoved" // the team took this link down
  | "targetFull" // the list is full
  | "memberFull" // this member added the most they may here
  | "dailyLimit"
  | "slowDown"
  | "titleTooLong"
  | "titleLink"
  | "network"
  | "gone"
  | "server"

export type VideoDraft = { url: string; title: string; isAnonymous: boolean }

export type AddOutcome = { ok: true; video: VideoLink } | { ok: false; failure: VideoFailure }

export interface VideosBackend {
  list(target: VideoTarget): Promise<VideoList>
  add(target: VideoTarget, draft: { url: string; title: string | null; isAnonymous: boolean }): Promise<VideoLink>
  remove(videoId: string): Promise<void>
  report(videoId: string, report: { reason: VideoReportReason }): Promise<{ status: "received" | "already_reported" }>
}
