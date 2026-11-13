import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import { broadcastFromWire, recordingFromWire, type WireBroadcast, type WireRecording } from "@/lib/broadcasts/remote"
import { callFor } from "@/lib/recordingExtras/http"

import type { BroadcastReviewBackend, Decision, DecisionAction, ReportsSummary, ReviewedBroadcast, ReviewFailure, ReviewState, Suggestion } from "./types"

/** The phone's side of the team's broadcast desk (apps/api `/api/v1/broadcasts/*`). Every call is checked again by the server. */
const call = callFor("/api/v1/broadcasts")

type Paged<W> = { items: W[]; total: number }

type WireSummary = { counted?: number; open?: number; anonymous?: number; cleared?: number; by_reason?: Record<string, number>; notes?: string[] }
export type WireReviewed = WireBroadcast & {
  state: ReviewState
  reports: WireSummary
  reviewed_at?: string | null
  reviewed_by?: string | null
  reviewed_reports?: number
  hidden_at?: string | null
  hidden_by?: string | null
  hidden_reason?: string | null
  removed_at?: string | null
  removed_by?: string | null
  removed_reason?: string | null
}
export type WireDecision = { id: string; broadcast_id: string; broadcast_title: string; action: DecisionAction; reason?: string | null; decided_by: string; reports_total: number; reports_counted: number; created_at: string }
export type WireSuggestion = { id: string; broadcast_id: string; broadcast_title: string; recording: WireRecording }

const STATES: readonly ReviewState[] = ["reported", "auto_hidden", "hidden", "removed", "kept"]
const num = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

export function summaryFromWire(w: WireSummary | null | undefined): ReportsSummary {
  return {
    counted: num(w?.counted),
    open: num(w?.open),
    anonymous: num(w?.anonymous),
    cleared: num(w?.cleared),
    byReason: Object.fromEntries(Object.entries(w?.by_reason ?? {}).filter(([, count]) => num(count) > 0).map(([reason, count]) => [reason, num(count)])),
    notes: (w?.notes ?? []).filter((note) => typeof note === "string" && note.trim() !== ""),
  }
}

export function reviewedFromWire(w: WireReviewed): ReviewedBroadcast {
  return {
    ...broadcastFromWire(w),
    state: STATES.includes(w.state) ? w.state : "reported",
    reports: summaryFromWire(w.reports),
    reviewedAt: w.reviewed_at ?? null,
    reviewedBy: w.reviewed_by ?? null,
    reviewedReports: num(w.reviewed_reports),
    hiddenAt: w.hidden_at ?? null,
    hiddenBy: w.hidden_by ?? null,
    hiddenReason: w.hidden_reason ?? null,
    removedAt: w.removed_at ?? null,
    removedBy: w.removed_by ?? null,
    removedReason: w.removed_reason ?? null,
  }
}

export const decisionFromWire = (w: WireDecision): Decision => ({
  id: w.id,
  broadcastId: w.broadcast_id,
  broadcastTitle: w.broadcast_title,
  action: w.action === "hide" || w.action === "remove" ? w.action : "keep",
  reason: w.reason ?? null,
  decidedBy: w.decided_by,
  reportsTotal: num(w.reports_total),
  reportsCounted: num(w.reports_counted),
  createdAt: w.created_at,
})

export const suggestionFromWire = (w: WireSuggestion): Suggestion => ({ id: w.id, broadcastId: w.broadcast_id, broadcastTitle: w.broadcast_title, recording: recordingFromWire(w.recording) })

const id = (value: string) => encodeURIComponent(value)

export function broadcastReviewRemote(cfg: RemoteConfig): BroadcastReviewBackend {
  return {
    async queue(which) {
      const page = await call<Paged<WireReviewed>>(cfg, "GET", `/review?which=${which}&limit=50`)
      return { items: page.items.map(reviewedFromWire), total: page.total }
    },
    async decisions() {
      const page = await call<Paged<WireDecision>>(cfg, "GET", "/decisions?limit=50")
      return { items: page.items.map(decisionFromWire), total: page.total }
    },
    async suggestions() {
      const page = await call<Paged<WireSuggestion>>(cfg, "GET", "/recording-suggestions?limit=50")
      return { items: page.items.map(suggestionFromWire), total: page.total }
    },
    async keep(broadcastId) {
      await call<void>(cfg, "POST", `/${id(broadcastId)}/keep`)
    },
    async hide(broadcastId, reason) {
      await call<void>(cfg, "POST", `/${id(broadcastId)}/hide`, { reason })
    },
    async remove(broadcastId, reason) {
      await call<void>(cfg, "POST", `/${id(broadcastId)}/remove`, { reason })
    },
    async acceptSuggestion(linkId) {
      await call<void>(cfg, "POST", `/recording-suggestions/${id(linkId)}/accept`)
    },
    async rejectSuggestion(linkId) {
      await call<void>(cfg, "POST", `/recording-suggestions/${id(linkId)}/reject`)
    },
  }
}

export function reviewFailureFromError(error: unknown): ReviewFailure {
  if (error instanceof NetworkError) return "network"
  if (error instanceof RemoteError) {
    if (error.code === "broadcast_reason_needed") return "reasonNeeded"
    if (error.status === 401 || error.status === 403) return "denied"
    if (error.status === 404) return "gone"
    if (error.status === 409) return "conflict"
    if (error.status === 422) return "reasonNeeded"
  }
  return "server"
}
