import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import { callFor } from "@/lib/recordingExtras/http"

import { safeThumbnailUrl } from "./thumbnail"
import type { VideoFailure, VideoLink, VideoLinkStatus, VideoList, VideoPreview, VideoProvider, VideoReportReason, VideoTarget, VideosBackend } from "./types"

/** The phone's side of the video links API (apps/api `/api/v1/video-links`). */
const call = callFor("/api/v1/video-links")

/** `VideoOut` of the API. */
export type WireVideo = {
  id: string
  provider: VideoProvider
  url: string
  title: string | null
  created_at: string
  is_anonymous: boolean
  author: { name: string; avatar_url: string | null } | null
  mine: boolean
  can_remove: boolean
  link_status?: VideoLinkStatus
  thumbnail_url?: string | null
}

/** `VideoPreview` of the API. */
export type WirePreview = { provider: VideoProvider; url: string; title: string | null; thumbnail_url: string | null; link_status?: VideoLinkStatus }

const statusOf = (value: unknown): VideoLinkStatus => (value === "ok" || value === "no_embed" || value === "unavailable" ? value : "unknown")

export function previewFromWire(w: WirePreview): VideoPreview {
  return { provider: w.provider, url: w.url, title: w.title ?? null, thumbnailUrl: safeThumbnailUrl(w.provider, w.thumbnail_url), linkStatus: statusOf(w.link_status) }
}

/** Wire to app. An anonymous link keeps `author: null` whatever else the answer carries. */
export function videoFromWire(w: WireVideo): VideoLink {
  return {
    id: w.id,
    provider: w.provider,
    url: w.url,
    title: w.title ?? null,
    createdAt: w.created_at,
    isAnonymous: Boolean(w.is_anonymous),
    author: w.is_anonymous || !w.author ? null : { name: w.author.name, avatarUrl: w.author.avatar_url ?? null },
    mine: Boolean(w.mine),
    canRemove: Boolean(w.can_remove),
    linkStatus: statusOf(w.link_status),
    thumbnailUrl: safeThumbnailUrl(w.provider, w.thumbnail_url),
  }
}

export function targetPath(target: VideoTarget): string {
  return target.kind === "song" ? `/songs/${target.id}` : `/recordings/${encodeURIComponent(target.id)}`
}

export function videosRemote(cfg: RemoteConfig): VideosBackend {
  return {
    async list(target): Promise<VideoList> {
      const page = await call<{ items: WireVideo[]; total: number; room: number }>(cfg, "GET", targetPath(target))
      return { items: page.items.map(videoFromWire), total: page.total, room: page.room }
    },
    async add(target, draft) {
      return videoFromWire(await call<WireVideo>(cfg, "POST", targetPath(target), { url: draft.url, title: draft.title, is_anonymous: draft.isAnonymous }))
    },
    async remove(videoId) {
      await call<void>(cfg, "DELETE", `/${encodeURIComponent(videoId)}`)
    },
    async preview(url) {
      return previewFromWire(await call<WirePreview>(cfg, "GET", `/preview?url=${encodeURIComponent(url)}`))
    },
    async report(videoId, report: { reason: VideoReportReason }) {
      return call<{ status: "received" | "already_reported" }>(cfg, "POST", `/${encodeURIComponent(videoId)}/report`, { reason: report.reason })
    },
  }
}

/** Any error of the real backend as a failure the screens have a sentence for. */
export function videoFailureFromError(error: unknown): VideoFailure {
  if (error instanceof NetworkError) return "network"
  if (error instanceof RemoteError) {
    switch (error.code) {
      case "video_provider":
        return "provider"
      case "video_duplicate":
        return "duplicate"
      case "video_team_removed":
        return "teamRemoved"
      case "video_target_full":
        return "targetFull"
      case "video_member_full":
        return "memberFull"
      case "video_daily_limit":
        return "dailyLimit"
      case "video_bad_link":
        return /https/i.test(error.message) ? "notHttps" : "badLink"
    }
    if (error.status === 401) return "signin"
    if (error.status === 404) return "gone"
    if (error.status === 429) return "slowDown"
    if (error.status === 422) {
      if (/characters/i.test(error.message)) return "titleTooLong"
      if (/links out of the title/i.test(error.message)) return "titleLink"
      return "badLink"
    }
  }
  return "server"
}
