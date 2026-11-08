import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import { callFor } from "@/lib/recordingExtras/http"

import { chartToWire, draftToWire } from "./rules"
import type { RecordingSheet, SheetChartPayload, SheetDraft, SheetFailure, SheetInstrument, SheetReportReason, SheetsBackend } from "./types"

/** The phone's side of the recording chord sheets API (apps/api `/api/v1/recording-chords`). */
const call = callFor("/api/v1/recording-chords")

/** `SheetOut` of the API. */
export type WireSheet = {
  id: string
  recording_id: string
  instrument: SheetInstrument
  chart_key: string | null
  body: string
  lines?: Array<{ text: string; placements: Array<{ word: number; chord: string }> }> | null
  capo?: number
  strum?: string | null
  based_on?: { id: string | null; name: string | null } | null
  archived?: boolean
  replaced_by?: string | null
  replaces?: string | null
  chords_count: number
  note: string | null
  played_it: boolean
  created_at: string
  is_anonymous: boolean
  author: { name: string } | null
  mine: boolean
  status: RecordingSheet["status"]
  rejected_reason: string | null
  can_review: boolean
  recording_title?: string | null
}

/** Wire to app. An anonymous sheet keeps `author: null` whatever else the answer carries. */
export function sheetFromWire(w: WireSheet): RecordingSheet {
  return {
    id: w.id,
    recordingId: w.recording_id,
    instrument: w.instrument,
    chartKey: w.chart_key ?? null,
    body: w.body,
    lines: w.lines ? w.lines.map((l) => ({ text: l.text, placements: l.placements.map((p) => ({ word: p.word, chord: p.chord })) })) : null,
    capo: w.capo ?? 0,
    strum: w.strum ?? null,
    basedOn: w.based_on ? { id: w.based_on.id ?? null, name: w.based_on.name ?? null } : null,
    archived: Boolean(w.archived),
    replacedBy: w.replaced_by ?? null,
    replaces: w.replaces ?? null,
    chordsCount: w.chords_count,
    note: w.note ?? null,
    playedIt: Boolean(w.played_it),
    createdAt: w.created_at,
    isAnonymous: Boolean(w.is_anonymous),
    author: w.is_anonymous || !w.author ? null : { name: w.author.name },
    mine: Boolean(w.mine),
    status: w.status,
    rejectedReason: w.rejected_reason ?? null,
    canReview: Boolean(w.can_review),
    recordingTitle: w.recording_title ?? null,
  }
}

export function sheetsRemote(cfg: RemoteConfig): SheetsBackend {
  return {
    async list(recordingId, instrument) {
      const query = instrument ? `?instrument=${instrument}` : ""
      const page = await call<{ items: WireSheet[] }>(cfg, "GET", `/recordings/${encodeURIComponent(recordingId)}${query}`)
      return page.items.map(sheetFromWire)
    },
    async mine() {
      const page = await call<{ items: WireSheet[] }>(cfg, "GET", "/mine")
      return page.items.map(sheetFromWire)
    },
    async offer(recordingId, draft: SheetDraft) {
      return sheetFromWire(await call<WireSheet>(cfg, "POST", `/recordings/${encodeURIComponent(recordingId)}`, draftToWire(draft)))
    },
    async update(sheetId, draft: SheetDraft) {
      return sheetFromWire(await call<WireSheet>(cfg, "PUT", `/${encodeURIComponent(sheetId)}`, draftToWire(draft)))
    },
    async offerChart(recordingId, chart: SheetChartPayload) {
      return sheetFromWire(await call<WireSheet>(cfg, "POST", `/recordings/${encodeURIComponent(recordingId)}`, chartToWire(chart)))
    },
    async updateChart(sheetId, chart: SheetChartPayload) {
      return sheetFromWire(await call<WireSheet>(cfg, "PUT", `/${encodeURIComponent(sheetId)}`, chartToWire(chart)))
    },
    async remove(sheetId) {
      await call<void>(cfg, "DELETE", `/${encodeURIComponent(sheetId)}`)
    },
    async report(sheetId, reason: SheetReportReason) {
      return call<{ status: "received" | "already_reported" }>(cfg, "POST", `/${encodeURIComponent(sheetId)}/report`, { reason })
    },
  }
}

/** Any error of the real backend as a failure the screens have a sentence for. */
export function sheetFailureFromError(error: unknown): SheetFailure {
  if (error instanceof NetworkError) return "network"
  if (error instanceof RemoteError) {
    if (error.code === "chords_daily_limit") return "dailyLimit"
    if (error.code === "chords_duplicate") return "duplicate"
    if (error.code === "chords_open_limit") return "tooMany"
    if (error.code === "chords_not_editable") return "notEditable"
    if (error.status === 401) return "signin"
    if (error.status === 403) return "forbidden"
    if (error.status === 404) return "gone"
    if (error.status === 422) {
      if (/single plain letter/i.test(error.message)) return "fewChords"
      if (/at least one chord|write the chords|over a word/i.test(error.message)) return "noChords"
      if (/web links/i.test(error.message)) return "links"
      if (/too long|lines at most|longer than|too many chords/i.test(error.message)) return "tooLong"
      return "invalid"
    }
    if (error.status === 429) return "slowDown"
  }
  return "server"
}
