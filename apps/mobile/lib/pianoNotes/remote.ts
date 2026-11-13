import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import { callFor } from "@/lib/recordingExtras/http"

import { draftToWire } from "./rules"
import type { PianoBackend, PianoDraft, PianoFailure, PianoReviewFilter, PianoReviewItem, PianoRow, PianoSheet, PianoTarget } from "./types"

/** The phone's side of the piano notes API (apps/api `/api/v1/piano-notes`). */
const call = callFor("/api/v1/piano-notes")

/** `PianoSheetOut` and `AdminPianoSheetOut` of the API. */
export type WireSheet = {
  id: string
  recording_id?: string | null
  song_number?: number | null
  sa_key: string
  level: PianoSheet["level"]
  rows: Array<{ label?: string | null; repeat?: number; hand?: "right" | "left"; steps: Array<{ k: number[]; b: number }> }>
  steps_count: number
  link_url?: string | null
  note?: string | null
  created_at: string
  is_anonymous: boolean
  author?: { name: string } | null
  by_recording_author?: boolean
  based_on?: { id: string | null; name: string | null } | null
  archived?: boolean
  replaced_by?: string | null
  replaces?: string | null
  mine?: boolean
  status: PianoSheet["status"]
  rejected_reason?: string | null
  can_review?: boolean
  recording_title?: string | null
  author_name?: string
  reports_count?: number
}

function rowsFromWire(rows: WireSheet["rows"]): PianoRow[] {
  return rows.map((row) => ({
    label: row.label ?? null,
    repeat: row.repeat ?? 1,
    hand: row.hand ?? "right",
    steps: row.steps.map((step) => ({ k: [...step.k], b: step.b })),
  }))
}

/** Wire to app. An anonymous sheet keeps `author: null` whatever else the answer carries. */
export function sheetFromWire(w: WireSheet): PianoSheet {
  const target: PianoTarget = w.recording_id ? { kind: "recording", id: w.recording_id } : { kind: "song", number: w.song_number ?? 0 }
  return {
    id: w.id,
    target,
    saKey: w.sa_key,
    level: w.level,
    rows: rowsFromWire(w.rows),
    stepsCount: w.steps_count,
    linkUrl: w.link_url ?? null,
    note: w.note ?? null,
    createdAt: w.created_at,
    isAnonymous: Boolean(w.is_anonymous),
    author: w.is_anonymous || !w.author ? null : { name: w.author.name },
    byRecordingAuthor: Boolean(w.by_recording_author),
    basedOn: w.based_on ? { id: w.based_on.id ?? null, name: w.based_on.name ?? null } : null,
    archived: Boolean(w.archived),
    replacedBy: w.replaced_by ?? null,
    replaces: w.replaces ?? null,
    mine: Boolean(w.mine),
    status: w.status,
    rejectedReason: w.rejected_reason ?? null,
    canReview: Boolean(w.can_review),
    recordingTitle: w.recording_title ?? null,
  }
}

function reviewFromWire(w: WireSheet): PianoReviewItem {
  return { ...sheetFromWire(w), authorName: w.author_name ?? "", reportsCount: w.reports_count ?? 0 }
}

function targetPath(target: PianoTarget): string {
  return target.kind === "recording" ? `/recordings/${encodeURIComponent(target.id)}` : `/songs/${target.number}`
}

export function pianoRemote(cfg: RemoteConfig): PianoBackend {
  const review = async (path: string, body?: unknown) => reviewFromWire(await call<WireSheet>(cfg, "POST", path, body))
  return {
    async list(target) {
      const page = await call<{ items: WireSheet[] }>(cfg, "GET", targetPath(target))
      return page.items.map(sheetFromWire)
    },
    async mine() {
      const page = await call<{ items: WireSheet[] }>(cfg, "GET", "/mine")
      return page.items.map(sheetFromWire)
    },
    async offer(target, draft: PianoDraft) {
      return sheetFromWire(await call<WireSheet>(cfg, "POST", targetPath(target), draftToWire(draft)))
    },
    async update(sheetId, draft: PianoDraft) {
      return sheetFromWire(await call<WireSheet>(cfg, "PUT", `/${encodeURIComponent(sheetId)}`, draftToWire(draft)))
    },
    async remove(sheetId) {
      await call<void>(cfg, "DELETE", `/${encodeURIComponent(sheetId)}`)
    },
    async report(sheetId, reason) {
      return call<{ status: "received" | "already_reported" }>(cfg, "POST", `/${encodeURIComponent(sheetId)}/report`, { reason })
    },
    async recordingIds() {
      return (await call<{ recording_ids: string[] }>(cfg, "GET", "/recordings")).recording_ids
    },
    async reviewQueue(filter: PianoReviewFilter) {
      const page = await call<{ items: WireSheet[] }>(cfg, "GET", `/review/queue?filter=${filter}`)
      return page.items.map(reviewFromWire)
    },
    approve: (id) => review(`/review/${encodeURIComponent(id)}/approve`),
    reject: (id, reason) => review(`/review/${encodeURIComponent(id)}/reject`, { reason }),
    restore: (id) => review(`/review/${encodeURIComponent(id)}/restore`),
  }
}

/** Any error of the real backend as a failure the screens have a sentence for. */
export function pianoFailureFromError(error: unknown): PianoFailure {
  if (error instanceof NetworkError) return "network"
  if (error instanceof RemoteError) {
    if (error.code === "piano_daily_limit") return "dailyLimit"
    if (error.code === "piano_duplicate") return "duplicate"
    if (error.code === "piano_open_limit") return "tooMany"
    if (error.code === "piano_not_editable") return "notEditable"
    if (error.status === 401) return "signin"
    if (error.status === 403) return "forbidden"
    if (error.status === 404) return "gone"
    if (error.status === 422) {
      if (/at least two notes/i.test(error.message)) return "tooFew"
      if (/web links/i.test(error.message)) return "links"
      if (/link must|link is too long/i.test(error.message)) return "badLink"
      if (/too many notes|too long/i.test(error.message)) return "tooLong"
      return "invalid"
    }
    if (error.status === 429) return "slowDown"
  }
  return "server"
}
