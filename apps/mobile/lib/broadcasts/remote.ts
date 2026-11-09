import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import { callFor } from "@/lib/recordingExtras/http"

import type { Broadcast, BroadcastFailure, BroadcastLinkStatus, BroadcastList, BroadcastPhase, BroadcastProvider, BroadcastReportReason, BroadcastsBackend } from "./types"

/** The phone's side of the broadcasts API (apps/api `/api/v1/broadcasts`). */
const call = callFor("/api/v1/broadcasts")

/** `BroadcastOut` of the API. */
export type WireBroadcast = {
  id: string
  provider: BroadcastProvider
  url: string
  host: string
  title: string
  description: string | null
  organizer: string | null
  starts_at: string | null
  timezone: string | null
  ends_at: string
  phase: BroadcastPhase
  archived: boolean
  thumbnail_url: string | null
  link_status: BroadcastLinkStatus
  status: "published" | "removed"
  mine: boolean
  can_end: boolean
  can_remove: boolean
  created_at: string
  reports_count?: number | null
}

const PROVIDERS: readonly BroadcastProvider[] = ["youtube", "zoom", "facebook", "instagram", "other"]
const LINK_STATUSES: readonly BroadcastLinkStatus[] = ["unknown", "ok", "no_embed", "unavailable"]

/** Wire to app. A provider or a status the phone does not know is read as the safest one: "other", "unknown". */
export function broadcastFromWire(w: WireBroadcast): Broadcast {
  return {
    id: w.id,
    provider: PROVIDERS.includes(w.provider) ? w.provider : "other",
    url: w.url,
    host: w.host,
    title: w.title,
    description: w.description ?? null,
    organizer: w.organizer ?? null,
    startsAt: w.starts_at ?? null,
    timezone: w.timezone ?? null,
    endsAt: w.ends_at,
    phase: w.phase === "upcoming" || w.phase === "now" ? w.phase : "ended",
    archived: Boolean(w.archived),
    thumbnailUrl: w.thumbnail_url ?? null,
    linkStatus: LINK_STATUSES.includes(w.link_status) ? w.link_status : "unknown",
    status: w.status === "removed" ? "removed" : "published",
    mine: Boolean(w.mine),
    canEnd: Boolean(w.can_end),
    canRemove: Boolean(w.can_remove),
    createdAt: w.created_at,
    reportsCount: typeof w.reports_count === "number" ? w.reports_count : null,
  }
}

const toList = (page: { items: WireBroadcast[]; total: number }): BroadcastList => ({ items: page.items.map(broadcastFromWire), total: page.total })

export function broadcastsRemote(cfg: RemoteConfig): BroadcastsBackend {
  return {
    async list(which, limit = 20) {
      return toList(await call(cfg, "GET", `?which=${which}&limit=${limit}`))
    },
    async mine() {
      return toList(await call(cfg, "GET", "/mine"))
    },
    async get(id) {
      return broadcastFromWire(await call<WireBroadcast>(cfg, "GET", `/${encodeURIComponent(id)}`))
    },
    async create(draft) {
      return broadcastFromWire(
        await call<WireBroadcast>(cfg, "POST", "", {
          url: draft.url,
          title: draft.title,
          description: draft.description,
          organizer: draft.organizer,
          starts_at: draft.startsAt,
          timezone: draft.timezone,
        }),
      )
    },
    async end(id) {
      return broadcastFromWire(await call<WireBroadcast>(cfg, "POST", `/${encodeURIComponent(id)}/end`))
    },
    async remove(id) {
      await call<void>(cfg, "DELETE", `/${encodeURIComponent(id)}`)
    },
    async report(id, report: { reason: BroadcastReportReason; note?: string | null }) {
      return call<{ status: "received" | "already_reported" }>(cfg, "POST", `/${encodeURIComponent(id)}/report`, { reason: report.reason, note: report.note ?? null })
    },
  }
}

/** Any error of the real backend as a failure the screens have a sentence for. */
export function broadcastFailureFromError(error: unknown): BroadcastFailure {
  if (error instanceof NetworkError) return "network"
  if (error instanceof RemoteError) {
    switch (error.code) {
      case "broadcast_bad_link":
        return "badLink"
      case "broadcast_daily_limit":
        return "dailyLimit"
      case "broadcast_live_limit":
        return "liveLimit"
      case "broadcast_duplicate":
        return "duplicate"
    }
    if (error.status === 401) return "signin"
    if (error.status === 404) return "gone"
    if (error.status === 429) return "slowDown"
    if (error.status === 422) return "refused"
  }
  return "server"
}
