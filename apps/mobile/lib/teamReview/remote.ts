import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import { callFor } from "@/lib/recordingExtras/http"

import type { Counts, ReviewFailure, ReviewItem, ReviewList, ReviewPage, ReviewSource, ReviewTab, TeamReviewBackend } from "./types"

/** The phone's side of the team review calls. Each area keeps its own address; this file only maps them to one item shape. */
const sheets = callFor("/api/v1/recording-chords")
const songComments = callFor("/api/v1/song-comments")
const recordingComments = callFor("/api/v1/recording-comments")
const videos = callFor("/api/v1/video-links")

type Paged<W> = { items: W[]; total: number }

export type WireSheetAdmin = {
  id: string
  recording_id: string
  instrument: "guitar" | "harmonium" | "piano"
  body: string
  note?: string | null
  created_at: string
  is_anonymous: boolean
  author_name: string
  reports_count: number
  status: "pending" | "published" | "rejected"
  rejected_reason?: string | null
}
export type WireCommentAdmin = {
  id: string
  song_id?: number
  recording_id?: string
  body: string
  created_at: string
  is_anonymous: boolean
  author_name: string
  reports_count: number
  removed_reason?: string | null
  parent_id?: string | null
}
export type WireVideoAdmin = {
  id: string
  song_id: number | null
  recording_id: string | null
  url: string
  title: string | null
  created_at: string
  is_anonymous: boolean
  author_name: string
  reports_count: number
  removed_reason?: string | null
}

export function sheetItem(w: WireSheetAdmin, list: ReviewList): ReviewItem {
  return {
    key: `recordingSheet:${w.id}`,
    id: w.id,
    source: "recordingSheet",
    tab: "sheets",
    place: { kind: "recording", id: w.recording_id },
    text: w.body,
    heading: w.instrument,
    authorName: w.author_name,
    isAnonymous: Boolean(w.is_anonymous),
    reportsCount: w.reports_count ?? 0,
    createdAt: w.created_at,
    isReply: false,
    reason: w.rejected_reason ?? null,
    list,
  }
}

export function commentItem(w: WireCommentAdmin, source: "songComment" | "recordingComment", list: ReviewList): ReviewItem {
  return {
    key: `${source}:${w.id}`,
    id: w.id,
    source,
    tab: "comments",
    place: source === "songComment" ? { kind: "song", number: w.song_id ?? 0 } : { kind: "recording", id: w.recording_id ?? "" },
    text: w.body,
    heading: null,
    authorName: w.author_name,
    isAnonymous: Boolean(w.is_anonymous),
    reportsCount: w.reports_count ?? 0,
    createdAt: w.created_at,
    isReply: Boolean(w.parent_id),
    reason: w.removed_reason ?? null,
    list,
  }
}

export function videoItem(w: WireVideoAdmin, list: ReviewList): ReviewItem {
  return {
    key: `video:${w.id}`,
    id: w.id,
    source: "video",
    tab: "videos",
    place: w.song_id != null ? { kind: "song", number: w.song_id } : { kind: "recording", id: w.recording_id ?? "" },
    text: w.url,
    heading: w.title ?? null,
    authorName: w.author_name,
    isAnonymous: Boolean(w.is_anonymous),
    reportsCount: w.reports_count ?? 0,
    createdAt: w.created_at,
    isReply: false,
    reason: w.removed_reason ?? null,
    list,
  }
}

const byNewest = (a: ReviewItem, b: ReviewItem): number => b.createdAt.localeCompare(a.createdAt)

export function teamReviewRemote(cfg: RemoteConfig): TeamReviewBackend {
  const list = async (tab: ReviewTab, which: ReviewList): Promise<ReviewPage> => {
    if (tab === "sheets") {
      const filter = which === "open" ? "pending" : "rejected"
      const page = await sheets<Paged<WireSheetAdmin>>(cfg, "GET", `/review/queue?filter=${filter}&limit=50`)
      return { items: page.items.map((w) => sheetItem(w, which)), total: page.total }
    }
    if (tab === "videos") {
      const filter = which === "open" ? "reported" : "removed"
      const page = await videos<Paged<WireVideoAdmin>>(cfg, "GET", `/review?filter=${filter}&limit=50`)
      return { items: page.items.map((w) => videoItem(w, which)), total: page.total }
    }
    const filter = which === "open" ? "reported" : "removed"
    const [song, recording] = await Promise.all([
      songComments<Paged<WireCommentAdmin>>(cfg, "GET", `/review?filter=${filter}&limit=50`),
      recordingComments<Paged<WireCommentAdmin>>(cfg, "GET", `/review?filter=${filter}&limit=50`),
    ])
    const items = [...song.items.map((w) => commentItem(w, "songComment", which)), ...recording.items.map((w) => commentItem(w, "recordingComment", which))].sort(byNewest)
    return { items, total: song.total + recording.total }
  }
  return {
    list,
    async counts(): Promise<Counts> {
      const [s, c, v] = await Promise.all([list("sheets", "open"), list("comments", "open"), list("videos", "open")])
      return { sheets: s.total, comments: c.total, videos: v.total }
    },
    async act(item, action, reason) {
      const id = encodeURIComponent(item.id)
      const text = (reason ?? "").trim()
      switch (item.source) {
        case "recordingSheet":
          if (action === "approve") return void (await sheets(cfg, "POST", `/review/${id}/approve`))
          if (action === "restore") return void (await sheets(cfg, "POST", `/review/${id}/restore`))
          return void (await sheets(cfg, "POST", `/review/${id}/reject`, { reason: text }))
        case "video":
          if (action === "approve") return void (await videos(cfg, "POST", `/${id}/keep`))
          if (action === "restore") return void (await videos(cfg, "POST", `/${id}/restore`))
          return void (await videos(cfg, "DELETE", `/${id}`, { reason: text }))
        default: {
          const call = item.source === "songComment" ? songComments : recordingComments
          if (action === "approve") return void (await call(cfg, "POST", `/${id}/keep`))
          if (action === "restore") return void (await call(cfg, "POST", `/${id}/restore`))
          return void (await call(cfg, "DELETE", `/${id}`, { reason: text }))
        }
      }
    },
  }
}

export function reviewFailureFromError(error: unknown): ReviewFailure {
  if (error instanceof NetworkError) return "network"
  if (error instanceof RemoteError) {
    if (error.status === 401 || error.status === 403) return "denied"
    if (error.status === 404) return "gone"
    if (error.status === 409) return "conflict"
    if (error.status === 422) return "reasonNeeded"
  }
  return "server"
}

export type { ReviewSource }
