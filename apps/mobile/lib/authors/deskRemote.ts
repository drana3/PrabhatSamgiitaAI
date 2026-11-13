import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import { callFor } from "@/lib/recordingExtras/http"

import type { ClaimsDesk, DeskAction, DeskFailure, DeskList, DeskStatus, DeskSummary } from "./desk"

/** The phone's side of the team desk calls. The server decides who is the team: a refusal is "denied". */
const call = callFor("/api/v1/admin/authors/claims")

export function deskRemote(cfg: RemoteConfig): ClaimsDesk {
  return {
    demo: false,
    list: (status: DeskStatus, reason?: string | null) => call<DeskList>(cfg, "GET", `?status=${status}&limit=100${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`),
    summary: () => call<DeskSummary>(cfg, "GET", "/summary"),
    async decide(ids: readonly string[], action: DeskAction, note?: string) {
      const result = await call<{ changed: number }>(cfg, "POST", "/bulk", { action, ids: [...ids], ...(note?.trim() ? { note: note.trim() } : {}) })
      return result.changed
    },
  }
}

export function deskFailure(error: unknown): DeskFailure {
  if (error instanceof NetworkError) return "network"
  if (error instanceof RemoteError) {
    if (error.status === 401 || error.status === 403) return "denied"
    if (error.status === 409) return "conflict"
  }
  return "server"
}
