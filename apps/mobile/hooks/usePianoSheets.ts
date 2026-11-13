import { useCallback, useEffect, useRef, useState } from "react"

import { localPianoSheet } from "@/lib/pianoNotes/local"
import { pianoBackend, pianoFailure } from "@/lib/pianoNotes/backend"
import { visibleSheets } from "@/lib/pianoNotes/rules"
import type { PianoDraft, PianoFailure, PianoReportReason, PianoSheet, PianoTarget } from "@/lib/pianoNotes/types"

export type PianoSheetsState = { status: "loading" | "ready" | "error" | "offline"; items: PianoSheet[] }

export type PianoSheetsController = {
  state: PianoSheetsState
  reload: () => Promise<void>
  remove: (id: string) => Promise<PianoFailure | null>
  report: (id: string, reason: PianoReportReason) => Promise<{ ok: true; status: "received" | "already_reported" } | { ok: false; failure: PianoFailure }>
  offer: (draft: PianoDraft) => Promise<{ ok: true; sheet: PianoSheet } | { ok: false; failure: PianoFailure }>
}

const keyOf = (target: PianoTarget) => (target.kind === "recording" ? `r:${target.id}` : `s:${target.number}`)

/**
 * The piano sheets of one recording or song: the live ones plus the member's own waiting ones. The notes that ship in
 * the app come first, whatever the server says: the booklet's for songs 1, 2 and 27, the collection "50 PS" for its
 * other songs. A reply that comes after the target changed or the page closed is dropped. The backend is read when
 * called, never captured.
 */
export function usePianoSheets(target: PianoTarget | null): PianoSheetsController {
  const key = target ? keyOf(target) : ""
  const local = target?.kind === "song" ? localPianoSheet(target.number) : null
  const localItems = local ? [local] : []
  const [state, setState] = useState<PianoSheetsState>({ status: "loading", items: localItems })
  const current = useRef(key)
  current.current = key
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const fresh = (k: string) => alive.current && current.current === k
  const merge = (items: PianoSheet[]) => [...(local ? [local] : []), ...visibleSheets(items)]

  const reload = useCallback(async () => {
    if (!target) return
    setState((s) => ({ status: "loading", items: s.items }))
    try {
      const items = await pianoBackend().list(target)
      if (fresh(key)) setState({ status: "ready", items: merge(items) })
    } catch (error) {
      if (!fresh(key)) return
      setState((s) => ({ status: pianoFailure(error) === "network" ? "offline" : "error", items: s.items }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    void reload()
  }, [reload])

  const offer = useCallback(
    async (draft: PianoDraft) => {
      if (!target) return { ok: false as const, failure: "gone" as const }
      try {
        const sheet = await pianoBackend().offer(target, draft)
        if (fresh(key)) setState((s) => ({ status: "ready", items: [...s.items.filter((x) => x.id !== sheet.id), sheet] }))
        return { ok: true as const, sheet }
      } catch (error) {
        return { ok: false as const, failure: pianoFailure(error) }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  const remove = useCallback(async (id: string) => {
    try {
      await pianoBackend().remove(id)
    } catch (error) {
      const failure = pianoFailure(error)
      if (failure !== "gone") return failure
    }
    if (alive.current) setState((s) => ({ ...s, items: s.items.filter((x) => x.id !== id) }))
    return null
  }, [])

  const report = useCallback(async (id: string, reason: PianoReportReason) => {
    try {
      return { ok: true as const, status: (await pianoBackend().report(id, reason)).status }
    } catch (error) {
      return { ok: false as const, failure: pianoFailure(error) }
    }
  }, [])

  return { state, reload, remove, report, offer }
}
