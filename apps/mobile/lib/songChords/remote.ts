import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"

import type { ChordFailure, ChordProposal, ChordReportReason, ChordsBackend, ProposalPayload, ReviewFilter, ReviewItem } from "./types"

/**
 * The phone's side of the chord proposals API (apps/api `/api/v1/song-chords`). Plain `fetch`, no React: the base URL,
 * the member headers and `fetch` are passed in so tests run it against a fake server. The real wiring is
 * lib/kirtan/api.ts (`remoteConfig`). The error classes are the recordings module's, so one error shape serves all.
 */

/** `ChordProposalOut` of the API. */
export type WireProposal = {
  id: string
  song_id: number
  instrument: "guitar" | "harmonium"
  base_key: string
  capo: number
  strum: string | null
  lines: Array<{ placements: Array<{ word: number; chord: string }> }>
  note: string | null
  played_it: boolean
  created_at: string
  is_anonymous: boolean
  author: { name: string } | null
  mine: boolean
  status: "pending" | "published" | "rejected"
  rejected_reason: string | null
  can_review: boolean
  based_on?: { id: string | null; name: string | null } | null
  archived?: boolean
  replaced_by?: string | null
  replaces?: string | null
}

/** `AdminChordProposalOut`: the team's shape, which knows the author. */
export type WireReviewItem = WireProposal & { author_id: string; author_name: string; reports_count: number }

/** Wire to app. An anonymous proposal keeps `author: null` whatever else the answer carries. */
export function proposalFromWire(w: WireProposal): ChordProposal {
  return {
    id: w.id,
    songId: w.song_id,
    instrument: w.instrument,
    baseKey: w.base_key,
    capo: w.capo,
    strum: w.strum ?? null,
    lines: w.lines.map((line) => ({ placements: line.placements.map((p) => ({ word: p.word, chord: p.chord })) })),
    note: w.note ?? null,
    playedIt: Boolean(w.played_it),
    createdAt: w.created_at,
    isAnonymous: w.is_anonymous,
    author: w.is_anonymous || !w.author ? null : { name: w.author.name },
    mine: Boolean(w.mine),
    status: w.status,
    rejectedReason: w.rejected_reason ?? null,
    canReview: Boolean(w.can_review),
    basedOn: w.based_on ? { id: w.based_on.id ?? null, name: w.based_on.name ?? null } : null,
    archived: Boolean(w.archived),
    replacedBy: w.replaced_by ?? null,
    replaces: w.replaces ?? null,
  }
}

export function reviewItemFromWire(w: WireReviewItem): ReviewItem {
  return { ...proposalFromWire(w), authorId: w.author_id, authorName: w.author_name, reportsCount: w.reports_count }
}

export function payloadToWire(p: ProposalPayload): Record<string, unknown> {
  return {
    song_id: p.songId,
    instrument: p.instrument,
    base_key: p.baseKey,
    capo: p.capo,
    strum: p.strum,
    lines: p.lines,
    played_it: p.playedIt,
    note: p.note,
    is_anonymous: p.isAnonymous,
    ...(p.replacesId ? { replaces_id: p.replacesId } : {}),
    ...(p.basedOnId ? { based_on_id: p.basedOnId } : {}),
  }
}

function url(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/api/v1/song-chords${path}`
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

export function remoteBackend(cfg: RemoteConfig): ChordsBackend {
  return {
    async listForSong(songId) {
      const page = await call<{ items: WireProposal[] }>(cfg, "GET", `/songs/${songId}`)
      return page.items.map(proposalFromWire)
    },
    async mine() {
      const page = await call<{ items: WireProposal[] }>(cfg, "GET", "/mine")
      return page.items.map(proposalFromWire)
    },
    async offer(payload) {
      return proposalFromWire(await call<WireProposal>(cfg, "POST", "", payloadToWire(payload)))
    },
    async update(id, payload) {
      return proposalFromWire(await call<WireProposal>(cfg, "PUT", `/${encodeURIComponent(id)}`, payloadToWire(payload)))
    },
    async remove(id) {
      await call<void>(cfg, "DELETE", `/${encodeURIComponent(id)}`)
    },
    async report(id, reason: ChordReportReason) {
      return call<{ status: "received" | "already_reported" }>(cfg, "POST", `/${encodeURIComponent(id)}/report`, { reason })
    },
    async reviewQueue(filter: ReviewFilter) {
      const page = await call<{ items: WireReviewItem[]; total: number }>(cfg, "GET", `/review/queue?filter=${filter}`)
      return { items: page.items.map(reviewItemFromWire), total: page.total }
    },
    async approve(id) {
      return reviewItemFromWire(await call<WireReviewItem>(cfg, "POST", `/review/${encodeURIComponent(id)}/approve`, {}))
    },
    async reject(id, reason) {
      return reviewItemFromWire(await call<WireReviewItem>(cfg, "POST", `/review/${encodeURIComponent(id)}/reject`, { reason }))
    },
    async restore(id) {
      return reviewItemFromWire(await call<WireReviewItem>(cfg, "POST", `/review/${encodeURIComponent(id)}/restore`, {}))
    },
  }
}

/** Any error of the real backend as a failure the screens have a sentence for. */
export function failureFromError(error: unknown): ChordFailure {
  if (error instanceof NetworkError) return "network"
  if (error instanceof RemoteError) {
    if (error.code === "chords_daily_limit") return "dailyLimit"
    if (error.code === "chords_duplicate") return "duplicate"
    if (error.code === "chords_open_limit") return "tooMany"
    if (error.code === "chords_not_editable") return "notEditable"
    if (error.status === 401) return "signin"
    if (error.status === 403) return "forbidden"
    if (error.status === 404) return "gone"
    if (error.status === 422) return "invalid"
    if (error.status === 429) return "slowDown"
    return "server"
  }
  return "server"
}
