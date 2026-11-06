import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"

import { COMMENT_PAGE_SIZE } from "./rules"
import type { CommentFailure, CommentPage, CommentReportReason, CommentsBackend, SongComment } from "./types"

/**
 * The phone's side of the song comments API (apps/api `/api/v1/song-comments`). Plain `fetch`, no React: the base URL,
 * the member headers and `fetch` are passed in so tests run it against a fake server. The real wiring is
 * lib/kirtan/api.ts (`remoteConfig`). The error classes are the recordings module's, so one error shape serves both.
 */

/** `SongCommentOut` of the API. */
export type WireComment = {
  id: string
  song_id: number
  body: string
  created_at: string
  is_anonymous: boolean
  author: { name: string; avatar_url: string | null } | null
  mine: boolean
  can_remove: boolean
}

export type WirePage = { items: WireComment[]; total: number; limit: number; offset: number; has_more: boolean }

/** Wire to app. An anonymous comment keeps `author: null` whatever else the answer carries. */
export function commentFromWire(w: WireComment): SongComment {
  return {
    id: w.id,
    songId: w.song_id,
    body: w.body,
    createdAt: w.created_at,
    isAnonymous: w.is_anonymous,
    author: w.is_anonymous || !w.author ? null : { name: w.author.name, avatarUrl: w.author.avatar_url ?? null },
    mine: Boolean(w.mine),
    canRemove: Boolean(w.can_remove),
  }
}

export function pageFromWire(w: WirePage): CommentPage {
  return { items: w.items.map(commentFromWire), total: w.total, hasMore: w.has_more }
}

function url(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/api/v1/song-comments${path}`
}

async function readError(response: Response): Promise<RemoteError> {
  let detail: unknown = null
  try {
    detail = ((await response.json()) as { detail?: unknown }).detail
  } catch {
    detail = null
  }
  const code = response.headers?.get?.("X-Error-Code") ?? null
  if (typeof detail === "string" && detail) return new RemoteError(response.status, detail, { code })
  if (Array.isArray(detail) && detail.length) {
    return new RemoteError(response.status, (detail[0] as { msg?: string })?.msg ?? `Request failed (${response.status})`, { code })
  }
  return new RemoteError(response.status, `Request failed (${response.status})`, { code })
}

async function call<T>(cfg: RemoteConfig, method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await (cfg.fetch ?? fetch)(url(cfg.baseUrl, path), {
      method,
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...cfg.headers() },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined)
  }
  if (!response.ok) throw await readError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function remoteBackend(cfg: RemoteConfig): CommentsBackend {
  return {
    async list(songId, query) {
      const params = new URLSearchParams({ limit: String(query.limit || COMMENT_PAGE_SIZE), offset: String(query.offset) })
      return pageFromWire(await call<WirePage>(cfg, "GET", `/songs/${songId}?${params.toString()}`))
    },
    async post(songId, draft) {
      return commentFromWire(await call<WireComment>(cfg, "POST", `/songs/${songId}`, { body: draft.body, is_anonymous: draft.isAnonymous }))
    },
    async remove(commentId) {
      await call<void>(cfg, "DELETE", `/${commentId}`)
    },
    async report(commentId, report: { reason: CommentReportReason }) {
      return call<{ status: "received" | "already_reported" }>(cfg, "POST", `/${commentId}/report`, { reason: report.reason })
    },
  }
}

/** What went wrong, as one of the failures the section has a sentence for. */
export function failureFromError(error: unknown): CommentFailure {
  if (error instanceof NetworkError) return "network"
  if (error instanceof RemoteError) {
    if (error.status === 401) return "signin"
    if (error.status === 429) return error.code === "comment_daily_limit" ? "dailyLimit" : "slowDown"
    if (error.status === 409) return "duplicate"
    if (error.status === 404) return "gone"
    if (error.status === 422) {
      if (/at most two links/i.test(error.message)) return "links"
      if (/write something/i.test(error.message)) return "empty"
      if (/at most \d+ characters|too long/i.test(error.message)) return "tooLong"
    }
  }
  return "server"
}
