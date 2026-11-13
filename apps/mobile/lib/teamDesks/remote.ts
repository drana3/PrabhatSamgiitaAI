import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import { callFor } from "@/lib/recordingExtras/http"

import type { DeskFailure, FlagAction, FlagItem, FlagStatus, TakedownItem, WordAction, WordField, WordItem } from "./types"

/**
 * The phone's side of the team desks (apps/api/app/api/v1/team_queues.py and value_suggestions.py). The server decides who
 * is the team: a refusal is "denied". Plain `fetch` through `callFor`, so a test runs it against a fake server.
 */
const team = callFor("/api/v1/team")
const words = callFor("/api/v1/recordings/value-suggestions")

export type TeamDesks = {
  words: {
    list(field?: WordField | null): Promise<WordItem[]>
    decide(id: string, action: WordAction, options?: { mergeInto?: string; label?: string }): Promise<WordItem>
  }
  takedowns: {
    list(statuses: string, limit?: number, offset?: number): Promise<{ items: TakedownItem[]; total: number }>
    link(id: string, recording: string): Promise<TakedownItem>
    takeDown(id: string, note?: string): Promise<TakedownItem>
    reject(id: string, reason: string): Promise<TakedownItem>
    forward(id: string): Promise<TakedownItem>
    restore(id: string, claimantWithdrew: boolean): Promise<TakedownItem>
    close(id: string, reason: string): Promise<TakedownItem>
  }
  flags: {
    list(status: FlagStatus): Promise<FlagItem[]>
    decide(item: Pick<FlagItem, "recording_id" | "day">, action: FlagAction): Promise<FlagItem>
  }
}

const enc = encodeURIComponent

export function teamDesksRemote(cfg: RemoteConfig): TeamDesks {
  return {
    words: {
      async list(field) {
        const out = await words<{ items: WordItem[] }>(cfg, "GET", `?status=pending${field ? `&field=${field}` : ""}`)
        return out.items ?? []
      },
      decide: (id, action, options) =>
        words<WordItem>(cfg, "POST", `/${enc(id)}/decision`, {
          action,
          ...(options?.mergeInto ? { merge_into: options.mergeInto } : {}),
          ...(options?.label?.trim() ? { label: options.label.trim() } : {}),
        }),
    },
    takedowns: {
      list: (statuses, limit = 50, offset = 0) => team<{ items: TakedownItem[]; total: number }>(cfg, "GET", `/takedowns?status=${enc(statuses)}&limit=${limit}&offset=${offset}`),
      link: (id, recording) => team<TakedownItem>(cfg, "POST", `/takedowns/${enc(id)}/link`, { recording }),
      takeDown: (id, note) => team<TakedownItem>(cfg, "POST", `/takedowns/${enc(id)}/take-down`, note?.trim() ? { note: note.trim() } : {}),
      reject: (id, reason) => team<TakedownItem>(cfg, "POST", `/takedowns/${enc(id)}/reject`, { reason: reason.trim() }),
      forward: (id) => team<TakedownItem>(cfg, "POST", `/takedowns/${enc(id)}/forward`),
      restore: (id, claimantWithdrew) => team<TakedownItem>(cfg, "POST", `/takedowns/${enc(id)}/restore`, { claimant_withdrew: claimantWithdrew }),
      close: (id, reason) => team<TakedownItem>(cfg, "POST", `/takedowns/${enc(id)}/close`, { reason: reason.trim() }),
    },
    flags: {
      list: (status) => team<FlagItem[]>(cfg, "GET", `/play-flags?status=${status}&limit=200`),
      decide: (item, action) => team<FlagItem>(cfg, "POST", `/play-flags/${enc(item.recording_id)}/${enc(item.day)}/${action}`),
    },
  }
}

/** What went wrong, in the few words a screen needs. 404/409 mean someone else decided it first or it is gone. */
export function deskFailure(error: unknown): DeskFailure {
  if (error instanceof NetworkError) return "network"
  if (error instanceof RemoteError) {
    if (error.status === 401 || error.status === 403) return "denied"
    if (error.status === 404) return "gone"
    if (error.status === 409) return "conflict"
    if (error.status === 422) return "invalid"
  }
  return "server"
}

/** The server's own sentence for a refusal the team should read (a 409 or 422 carries the reason), or null. */
export function deskDetail(error: unknown): string | null {
  if (error instanceof RemoteError && (error.status === 409 || error.status === 422 || error.status === 404) && error.message && !/^Request failed/.test(error.message)) return error.message
  return null
}
