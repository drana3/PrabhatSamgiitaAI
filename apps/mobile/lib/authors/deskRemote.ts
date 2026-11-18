import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import { callFor } from "@/lib/recordingExtras/http"

import type { ClaimsDesk, DeskAction, DeskFailure, DeskList, DeskPage, DeskProofList, DeskStatus, DeskSummary, ProofAction } from "./desk"

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
    proofs: (status = "waiting") => call<DeskProofList>(cfg, "GET", `/proofs?status=${encodeURIComponent(status)}&limit=100`),
    page: (profileId: string) => call<DeskPage>(cfg, "GET", `/pages/${encodeURIComponent(profileId)}`),
    async decideProof(proofId: string, action: ProofAction, input?: { note?: string; approveWaiting?: boolean }) {
      await call<unknown>(cfg, "POST", `/proofs/${encodeURIComponent(proofId)}/${action}`, {
        ...(input?.note?.trim() ? { note: input.note.trim() } : {}),
        ...(action === "ok" && input?.approveWaiting ? { approve_waiting: true } : {}),
      })
    },
    sendCode: (proofId: string) => call<{ sent: boolean }>(cfg, "POST", `/proofs/${encodeURIComponent(proofId)}/send-code`, {}),
    async askMore(profileId: string, note: string) {
      await call<unknown>(cfg, "POST", `/pages/${encodeURIComponent(profileId)}/ask-more`, { note: note.trim() })
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
