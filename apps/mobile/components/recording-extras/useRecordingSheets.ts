import { useCallback, useEffect, useRef, useState } from "react"

import { sheetFailure, sheetsBackend } from "@/lib/recordingChords/backend"
import type { RecordingSheet, SheetDraft, SheetFailure, SheetReportReason } from "@/lib/recordingChords/types"

export type SheetsState = { status: "loading" | "ready" | "error" | "offline"; items: RecordingSheet[] }

export type SheetsController = {
  state: SheetsState
  reload: () => Promise<void>
  offer: (draft: SheetDraft) => Promise<{ ok: true; sheet: RecordingSheet } | { ok: false; failure: SheetFailure }>
  remove: (id: string) => Promise<SheetFailure | null>
  report: (id: string, reason: SheetReportReason) => Promise<{ ok: true; status: "received" | "already_reported" } | { ok: false; failure: SheetFailure }>
}

/**
 * The chord sheets of one recording: the published ones plus the viewer's own waiting ones. A reply that comes after
 * the recording changed or the page closed is dropped. The backend is read when called, never captured.
 */
export function useRecordingSheets(recordingId: string): SheetsController {
  const [state, setState] = useState<SheetsState>({ status: "loading", items: [] })
  const current = useRef(recordingId)
  current.current = recordingId
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const fresh = (id: string) => alive.current && current.current === id

  const reload = useCallback(async () => {
    setState((s) => ({ status: "loading", items: s.items }))
    try {
      const items = await sheetsBackend().list(recordingId)
      if (fresh(recordingId)) setState({ status: "ready", items })
    } catch (error) {
      if (!fresh(recordingId)) return
      setState((s) => ({ status: sheetFailure(error) === "network" ? "offline" : "error", items: s.items }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId])

  useEffect(() => {
    void reload()
  }, [reload])

  const offer = useCallback(
    async (draft: SheetDraft) => {
      try {
        const sheet = await sheetsBackend().offer(recordingId, draft)
        if (fresh(recordingId)) setState((s) => ({ status: "ready", items: [sheet, ...s.items.filter((x) => x.id !== sheet.id)] }))
        return { ok: true as const, sheet }
      } catch (error) {
        return { ok: false as const, failure: sheetFailure(error) }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recordingId],
  )

  const remove = useCallback(async (id: string) => {
    try {
      await sheetsBackend().remove(id)
    } catch (error) {
      const failure = sheetFailure(error)
      if (failure !== "gone") return failure
    }
    if (alive.current) setState((s) => ({ ...s, items: s.items.filter((x) => x.id !== id) }))
    return null
  }, [])

  const report = useCallback(async (id: string, reason: SheetReportReason) => {
    try {
      const result = await sheetsBackend().report(id, reason)
      return { ok: true as const, status: result.status }
    } catch (error) {
      return { ok: false as const, failure: sheetFailure(error) }
    }
  }, [])

  return { state, reload, offer, remove, report }
}
